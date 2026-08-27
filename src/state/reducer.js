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
import { dayBefore, nextDay } from './day.js';
import { createInitialState, makeHabit } from './schema.js';
import {
  activeHabits,
  findHabit,
  isDoneToday,
  today,
  xpToday,
} from './selectors.js';

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

/**
 * Пересчитывает серию и рекорд привычки по истории.
 *
 * Вычесть единицу из habit.streak нельзя: после пропуска дня серия была
 * сброшена до единицы, и прежнюю дату выполнения знает только история.
 * По ней же восстанавливается рекорд — отменяемый день мог его и поставить.
 */
function rebuildStreak(game, habit) {
  const days = {};
  let last = null;

  game.history.forEach((entry) => {
    if (entry.habitId !== habit.id) return;
    days[entry.date] = true;
    // Ключи вида ГГГГ-ММ-ДД сравниваются как строки без разбора даты.
    if (last === null || entry.date > last) last = entry.date;
  });

  habit.lastDone = last;

  let current = 0;
  let cursor = last;
  while (cursor && days[cursor]) {
    current += 1;
    cursor = dayBefore(cursor);
  }
  habit.streak = current;

  let best = 0;
  Object.keys(days).forEach((date) => {
    // Считаем только от начала серии, иначе один отрезок пройдём многократно.
    if (days[dayBefore(date)]) return;

    let run = 0;
    let walk = date;
    while (days[walk]) {
      run += 1;
      walk = nextDay(walk);
    }
    if (run > best) best = run;
  });
  habit.bestStreak = best;
}

function complete(prev, id) {
  const game = copy(prev.game);
  const habit = findHabit(game, id);

  if (!habit || isDoneToday(game, habit)) return prev;

  const day = today(game);
  const continues = habit.lastDone === dayBefore(day);

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
    '+' + gain + ' в характеристику «' + STATS[habit.stat].label + '», +' + discipline + ' к дисциплине'
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
  rebuildStreak(game, habit);

  return withToast(
    { ...prev, game },
    'Выполнение «' + habit.title + '» отменено, ' + gain + ' опыта снято'
  );
}

function add(prev, { title, stat, difficulty }) {
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
  game.habits.push(makeHabit(clean, stat, difficulty, game.settings.dayResetHour));

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
function update(prev, { id, title, stat, difficulty }) {
  const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!clean) return withToast(prev, 'Введите название привычки');

  const game = copy(prev.game);
  const habit = findHabit(game, id);
  if (!habit) return prev;

  habit.title = clean;
  habit.stat = stat;
  habit.difficulty = difficulty;

  return withToast({ ...prev, game }, 'Привычка «' + clean + '» изменена');
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
