/* Все изменения состояния собраны здесь.
 *
 * Состояние редьюсера шире сохраняемого: кроме `game` — того, что уходит
 * в localStorage по разделу 6.1, — оно держит обратную связь интерфейса
 * (всплывающее сообщение, окно нового уровня, признак новичка). В файл
 * и в хранилище попадает только `game`, поэтому лишнее туда не утечёт.
 *
 * Действия работают с копией состояния и меняют её на месте: перенос из
 * v0.2 остаётся дословным, а копия не даёт задеть прежний объект.
 */

import {
  DAILY_LIMIT,
  DIFFICULTY,
  MAX_HABITS,
  MAX_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  STATS,
  TEMPLATES,
  disciplineFor,
  streakMultiplier,
  xpToNextLevel,
} from './rules.js';
import { normalizeSchedule, previousScheduledDay } from './schedule.js';
import { rebuildStreak } from './streaks.js';
import { createInitialState, makeHabit } from './schema.js';
import { activeHabits, findHabit, isDoneToday, today, xpToday } from './selectors.js';

let toastSeq = 0;

function withToast(next, text) {
  toastSeq += 1;
  return { ...next, toast: { text, seq: toastSeq } };
}

function copy(game) {
  return structuredClone(game);
}

/**
 * Повышает уровень, пока хватает опыта, и возвращает число новых уровней.
 * Цикл, а не условие: за одно действие можно взять несколько порогов (FR-2.5).
 * Остаток опыта переносится на следующий уровень (FR-2.4).
 */
function applyLevelUps(character) {
  let gained = 0;

  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level);
    character.level += 1;
    gained += 1;
  }

  return gained;
}

/** Точная обратная операция к applyLevelUps. */
function applyLevelDowns(character) {
  while (character.xp < 0 && character.level > 1) {
    character.level -= 1;
    character.xp += xpToNextLevel(character.level);
  }

  // На первом уровне отрицательного остатка быть не может.
  if (character.xp < 0) character.xp = 0;
}

function complete(prev, id) {
  const game = copy(prev.game);
  const habit = findHabit(game, id);

  if (!habit || isDoneToday(game, habit)) return prev;

  const day = today(game);
  /* «Вчера» для привычки с расписанием — это её предыдущий день, а не
     календарное вчера: пропущенный вторник у привычки на пн-ср-пт
     пропуском не считается (FR-4.10). */
  const continues = habit.lastDone === previousScheduledDay(habit.schedule, day);

  /* Множитель заслужен вчерашними днями, а не сегодняшним нажатием,
     поэтому считаем по серии ДО начисления. Оборванная серия множителя
     не даёт, даже если её число ещё висит на карточке. */
  const gain = Math.round(
    DIFFICULTY[habit.difficulty].xp * streakMultiplier(continues ? habit.streak : 0)
  );

  /* Раздел 7.3: лимит блокирующий, но ничего не отнимает. Проверяем до
     любых изменений — иначе пришлось бы откатывать серию. */
  if (xpToday(game) + gain > DAILY_LIMIT) {
    return withToast(
      prev,
      'Дневной лимит в ' +
        DAILY_LIMIT +
        ' опыта исчерпан. Заработанное осталось при вас, начисление продолжится завтра.'
    );
  }

  const discipline = disciplineFor(gain);

  // FR-7.2 и FR-7.3: пропуск сбрасывает серию до единицы, а не до нуля —
  // сегодняшний день уже засчитан.
  habit.streak = continues ? habit.streak + 1 : 1;
  habit.lastDone = day;
  habit.bestStreak = Math.max(habit.bestStreak, habit.streak);

  game.character.xp += gain;
  game.character.totalXp += gain;
  game.character.stats[habit.stat] += gain;
  game.character.stats.discipline += discipline;

  game.history.push({ date: day, habitId: habit.id, xp: gain, source: 'manual' });

  const levelsGained = applyLevelUps(game.character);

  if (levelsGained > 0) return { ...prev, game, levelUp: levelsGained };

  return withToast(
    { ...prev, game },
    '+' +
      gain +
      ' в характеристику «' +
      STATS[habit.stat].label +
      '», +' +
      discipline +
      ' к дисциплине'
  );
}

/**
 * Отменяет сегодняшнее выполнение (FR-4.9).
 *
 * Закрывает разрыв между NFR-4.4 и принципом 1.1: обратимость нужна, но
 * подтверждение на ежедневное действие сломало бы отметку в два действия.
 * Отменить можно только текущие сутки — вчерашний день уже закрыт.
 */
function undo(prev, id) {
  const game = copy(prev.game);
  const habit = findHabit(game, id);

  if (!habit || !isDoneToday(game, habit)) return prev;

  const day = today(game);

  /* Запись за сутки одна (FR-4.5), но ищем с конца: свежая запись там. */
  let at = -1;
  for (let i = game.history.length - 1; i >= 0; i -= 1) {
    if (game.history[i].date === day && game.history[i].habitId === id) {
      at = i;
      break;
    }
  }
  if (at < 0) return prev;

  /* Опыт снимаем ровно тот, что был начислен: множитель за серию с тех пор
     мог измениться, и пересчёт по текущей формуле вернул бы другое число. */
  const gain = game.history[at].xp;
  game.history.splice(at, 1);

  game.character.xp -= gain;
  game.character.totalXp -= gain;
  game.character.stats[habit.stat] -= gain;
  game.character.stats.discipline -= disciplineFor(gain);

  applyLevelDowns(game.character);
  rebuildStreak(game.history, habit);

  return withToast(
    { ...prev, game },
    'Выполнение «' + habit.title + '» отменено, ' + gain + ' опыта снято'
  );
}

function add(prev, { title, stat, difficulty, schedule }) {
  const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!clean) return withToast(prev, 'Введите название привычки');

  // FR-4.7: список ограничен двадцатью привычками.
  if (activeHabits(prev.game).length >= MAX_HABITS) {
    return withToast(
      prev,
      'Больше ' + MAX_HABITS + ' привычек не получится — список перестаёт помогать'
    );
  }

  const game = copy(prev.game);
  game.habits.push(makeHabit(clean, stat, difficulty, game.settings.dayResetHour, schedule));

  return withToast({ ...prev, game }, 'Привычка «' + clean + '» добавлена');
}

/**
 * Меняет название, характеристику и сложность привычки (FR-4.8).
 *
 * История не переписывается: начисленный опыт остаётся там, куда попал, и
 * в том размере, в каком был начислен. Новая сложность и характеристика
 * действуют со следующего выполнения — иначе правка задним числом меняла
 * бы закрытые сутки, а отмена снимала бы не то, что начисляла.
 *
 * Серия и рекорд не трогаются: смена названия — не пропуск дня.
 */
function update(prev, { id, title, stat, difficulty, schedule }) {
  const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!clean) return withToast(prev, 'Введите название привычки');

  const game = copy(prev.game);
  const habit = findHabit(game, id);
  if (!habit) return prev;

  habit.title = clean;
  habit.stat = stat;
  habit.difficulty = difficulty;

  /* Расписание не передали — значит не меняем. Иначе правка названия
     молча переводила бы привычку на ежедневную. */
  const wasSchedule = JSON.stringify(normalizeSchedule(habit.schedule));
  habit.schedule =
    schedule === undefined ? normalizeSchedule(habit.schedule) : normalizeSchedule(schedule);

  /* Смена расписания — единственная правка, которая трогает серию: серия
     считается шагами по расписанию, и при новом наборе дней прежнее число
     означает уже не то. Пересчёт идёт по истории и потому ничего не
     выдумывает — просто перечитывает то, что было. */
  if (JSON.stringify(habit.schedule) !== wasSchedule) rebuildStreak(game.history, habit);

  return withToast({ ...prev, game }, 'Привычка «' + clean + '» изменена');
}

/**
 * Переставляет привычку на место другой (FR-4.12).
 *
 * Порядок хранится самим порядком массива — отдельного поля не заводится:
 * лишнее число пришлось бы держать согласованным при каждом создании и
 * удалении, а массив и так упорядочен.
 *
 * Адресуемся идентификаторами, а не номерами: на экране список может быть
 * отфильтрован расписанием (FR-4.11), и номер видимой карточки не совпал
 * бы с номером в массиве.
 */
function reorder(prev, { id, targetId }) {
  if (id === targetId) return prev;

  const game = copy(prev.game);
  const from = game.habits.findIndex((habit) => habit.id === id);
  const to = game.habits.findIndex((habit) => habit.id === targetId);
  if (from < 0 || to < 0) return prev;

  const [moved] = game.habits.splice(from, 1);
  game.habits.splice(to, 0, moved);

  /* Без сообщения: перестановка видна сама по себе, а всплывающая
     подсказка на каждый шаг стрелкой превратилась бы в мельтешение. */
  return { ...prev, game };
}

/**
 * Удаляет привычку. Записи в истории остаются: они уже принесли опыт,
 * и стирать их значило бы задним числом отнять заработанное.
 */
function remove(prev, id) {
  const habit = findHabit(prev.game, id);
  if (!habit) return prev;

  const game = copy(prev.game);
  game.habits = game.habits.filter((item) => item.id !== id);

  return withToast({ ...prev, game }, 'Привычка «' + habit.title + '» удалена');
}

/** Завершает знакомство: имя и выбранные шаблоны переносятся в состояние. */
function finishOnboarding(prev, { name, indexes }) {
  const game = copy(prev.game);
  const clean = name.trim().slice(0, MAX_NAME_LENGTH);
  if (clean) game.character.name = clean;

  indexes.forEach((index) => {
    const template = TEMPLATES[index];
    game.habits.push(
      makeHabit(template.title, template.stat, template.difficulty, game.settings.dayResetHour)
    );
  });

  return withToast(
    { ...prev, game, isNewPlayer: false },
    indexes.length > 0
      ? 'Готово, ' + game.character.name + '. Отмечайте выполненное — персонаж будет расти.'
      : 'Готово. Добавьте первую привычку, когда будете готовы.'
  );
}

export function reducer(prev, action) {
  switch (action.type) {
    case 'complete':
      return complete(prev, action.id);
    case 'undo':
      return undo(prev, action.id);
    case 'add':
      return add(prev, action);
    case 'update':
      return update(prev, action);
    case 'remove':
      return remove(prev, action.id);
    case 'reorder':
      return reorder(prev, action);

    /* Сброс возвращает в начало целиком, включая знакомство (FR-15.1). */
    case 'reset':
      return { ...prev, game: createInitialState(), isNewPlayer: true, levelUp: null };

    /* Замена содержимым файла (FR-15.3). */
    case 'replace':
      return withToast(
        { ...prev, game: action.game, isNewPlayer: false },
        'Прогресс загружен из файла'
      );

    case 'finishOnboarding':
      return finishOnboarding(prev, action);
    case 'dismissLevelUp':
      return { ...prev, levelUp: null };
    case 'notice':
      return withToast(prev, action.text);

    /* Отложенное предупреждение о непригодном сохранении: показывается,
       когда экран освободился от знакомства. */
    case 'flushNotice':
      return prev.pendingNotice
        ? withToast({ ...prev, pendingNotice: null }, prev.pendingNotice)
        : prev;
    case 'clearToast':
      return prev.toast && prev.toast.seq === action.seq ? { ...prev, toast: null } : prev;
    default:
      return prev;
  }
}

export function initialReducerState({ game, isNewPlayer, notice }) {
  toastSeq += 1;
  return {
    game,
    isNewPlayer,
    levelUp: null,
    /* Предупреждение о непригодном сохранении ждёт, пока освободится
       экран: во время онбординга всплывающую подсказку не видно. */
    pendingNotice: notice,
    toast: null,
  };
}
