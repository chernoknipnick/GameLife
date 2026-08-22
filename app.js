'use strict';

/* GameLife v0.1 — задачи 3, 4 и 5 Фазы 1.

   Покрывает FR-2.4, FR-2.5, FR-2.6 (уровни), FR-3.4, FR-3.4a (опыт),
   FR-4.4, FR-4.5, FR-4.6 (привычки), FR-7.1—FR-7.4 (стрики),
   NFR-2.1 (данные переживают закрытие браузера), раздел 7 (баланс).

   Формат хранения повторяет раздел 6.1 ТЗ, включая поля, которые пока
   не используются (bestStreak, schedule, archived, settings.theme) —
   чтобы задачи 6–8 и переход на React в v0.3 не ломали сохранённые
   данные.

   Чего ещё нет: создание и удаление привычек (задача 6), сброс
   прогресса (задача 8). */

/* --- Правила игры (раздел 7 ТЗ) --- */

var STORAGE_KEY = 'gamelife';
var SCHEMA_VERSION = 1;
var DAILY_LIMIT = 500;

var DIFFICULTY = {
  easy: { label: 'Лёгкая', xp: 10 },
  medium: { label: 'Средняя', xp: 25 },
  hard: { label: 'Тяжёлая', xp: 50 }
};

var STATS = {
  strength: { label: 'Сила', abbr: 'СИЛ' },
  intellect: { label: 'Интеллект', abbr: 'ИНТ' },
  health: { label: 'Здоровье', abbr: 'ЗДР' }
};

/** Порог опыта до следующего уровня. */
function xpToNextLevel(level) {
  return 100 + (level - 1) * 50;
}

/** Множитель за длину серии (FR-7.5). */
function streakMultiplier(streak) {
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1;
}

/** Опыт за одно выполнение привычки, с учётом живой серии. */
function xpFor(habit) {
  return Math.round(DIFFICULTY[habit.difficulty].xp * streakMultiplier(activeStreak(habit)));
}

/** Дисциплина пассивная: капает с любого выполнения (FR-3.4a). */
function disciplineFor(xp) {
  return Math.max(5, Math.round(xp * 0.3));
}

/* --- Сутки --- */

/* Сутки меняются не в полночь, а в settings.dayResetHour (раздел 6.1).
   Тот, кто отмечает привычку в час ночи, закрывает вчерашний день —
   так честнее по отношению к живому распорядку. */

function pad(value) {
  return value < 10 ? '0' + value : String(value);
}

function dayKey(date, resetHour) {
  var shifted = new Date(date.getTime());
  shifted.setHours(shifted.getHours() - resetHour);
  return shifted.getFullYear() + '-' + pad(shifted.getMonth() + 1) + '-' + pad(shifted.getDate());
}

function today() {
  return dayKey(new Date(), state.settings.dayResetHour);
}

/** Ключ предыдущих суток — нужен, чтобы отличить продолжение серии от пропуска. */
function dayBefore(key) {
  var parts = key.split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() - 1);
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

/* --- Состояние и хранилище --- */

var state = null;

function createInitialState() {
  var now = new Date();
  var todayKey = dayKey(now, 4);
  var yesterday = dayBefore(todayKey);
  var createdAt = todayKey;

  /* Стартовый набор привычек. Появится онбординг с выбором шаблонов
     (FR-1.3) — этот блок заменит он. Пустой список сейчас был бы
     тупиком: добавлять привычки пока нечем, это задача 6. */
  return {
    version: SCHEMA_VERSION,
    character: {
      name: 'Владимир',
      level: 5,
      xp: 180,
      totalXp: 1230,
      createdAt: createdAt,
      stats: { strength: 145, intellect: 320, health: 90, discipline: 210 }
    },
    habits: [
      makeHabit('Зарядка 10 минут', 'strength', 'medium', 3, createdAt, yesterday),
      makeHabit('Чтение 20 страниц', 'intellect', 'easy', 12, createdAt, todayKey),
      makeHabit('Медитация', 'health', 'easy', 0, createdAt, null)
    ],
    tasks: [],
    history: [],
    settings: { theme: 'light', dayResetHour: 4 }
  };
}

function makeHabit(title, stat, difficulty, streak, createdAt, lastDone) {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    title: title,
    stat: stat,
    difficulty: difficulty,
    schedule: 'daily',
    streak: streak,
    bestStreak: streak,
    lastDone: lastDone,
    createdAt: createdAt,
    archived: false
  };
}

function loadState() {
  var raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Приватный режим или запрет хранилища: играем без сохранения.
    console.warn('Хранилище недоступно, прогресс не сохранится:', error);
    return createInitialState();
  }

  if (!raw) return createInitialState();

  try {
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) return createInitialState();
    return parsed;
  } catch (error) {
    // Битые данные лучше заменить, чем уронить приложение.
    console.warn('Сохранение повреждено, начинаем заново:', error);
    return createInitialState();
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Не удалось сохранить прогресс:', error);
  }
}

/* --- Производные величины --- */

/** Привычка считается выполненной, только если отмечена в текущих сутках (FR-4.5). */
function isDoneToday(habit) {
  return habit.lastDone === today();
}

/** Серия, которая действует прямо сейчас: после пропуска она обнуляется. */
function activeStreak(habit) {
  if (isDoneToday(habit)) return habit.streak;
  return habit.lastDone === dayBefore(today()) ? habit.streak : 0;
}

/** Опыт за сегодня считаем из истории — счётчик пережил бы смену суток (раздел 7.3). */
function xpToday() {
  var day = today();
  return state.history.reduce(function (sum, entry) {
    return entry.date === day ? sum + entry.xp : sum;
  }, 0);
}

/* --- Действие --- */

/**
 * Отмечает привычку выполненной и начисляет опыт.
 * Возвращает false, если начисление не состоялось.
 */
function completeHabit(id) {
  var habit = state.habits.find(function (item) {
    return item.id === id;
  });

  if (!habit || isDoneToday(habit)) return false;

  var day = today();
  var continues = habit.lastDone === dayBefore(day);

  /* Множитель заслужен вчерашними днями, а не сегодняшним нажатием,
     поэтому считаем по серии ДО начисления. Оборванная серия множителя
     не даёт, даже если её число ещё висит на карточке. */
  var gain = Math.round(DIFFICULTY[habit.difficulty].xp * streakMultiplier(continues ? habit.streak : 0));

  /* Раздел 7.3: лимит блокирующий, но ничего не отнимает. Проверяем до
     любых изменений — иначе пришлось бы откатывать серию, а откат легко
     теряет исходное значение. */
  if (xpToday() + gain > DAILY_LIMIT) {
    showMessage('Дневной лимит в ' + DAILY_LIMIT + ' опыта исчерпан. Заработанное осталось при вас, начисление продолжится завтра.');
    return false;
  }

  var discipline = disciplineFor(gain);

  // FR-7.2 и FR-7.3: пропуск сбрасывает серию до единицы, а не до нуля —
  // сегодняшний день уже засчитан.
  habit.streak = continues ? habit.streak + 1 : 1;
  habit.lastDone = day;
  habit.bestStreak = Math.max(habit.bestStreak, habit.streak);

  state.character.xp += gain;
  state.character.totalXp += gain;
  state.character.stats[habit.stat] += gain;
  state.character.stats.discipline += discipline;

  state.history.push({ date: day, habitId: habit.id, xp: gain, source: 'manual' });

  var levelsGained = applyLevelUps();

  saveState();
  render();

  if (levelsGained > 0) {
    showLevelUp(levelsGained);
  } else {
    showMessage('+' + gain + ' в характеристику «' + STATS[habit.stat].label + '», +' + discipline + ' к дисциплине');
  }

  return true;
}

/**
 * Повышает уровень, пока хватает опыта, и возвращает число новых уровней.
 * Цикл, а не условие: за одно действие можно взять несколько порогов (FR-2.5).
 * Остаток опыта переносится на следующий уровень (FR-2.4).
 */
function applyLevelUps() {
  var character = state.character;
  var gained = 0;

  while (character.xp >= xpToNextLevel(character.level)) {
    character.xp -= xpToNextLevel(character.level);
    character.level += 1;
    gained += 1;
  }

  return gained;
}

/* --- Отрисовка --- */

var nodes = {};
var messageTimer = null;

var NODE_IDS = [
  'level', 'level-text', 'xp-value', 'xp-track', 'xp-fill',
  'stat-strength', 'stat-intellect', 'stat-health', 'stat-discipline',
  'today-meta', 'habits', 'toast',
  'levelup', 'levelup-badge', 'levelup-title', 'levelup-text', 'levelup-close'
];

function cacheNodes() {
  NODE_IDS.forEach(function (id) {
    nodes[id] = document.getElementById(id);
  });
}

function renderCharacter() {
  var character = state.character;
  var need = xpToNextLevel(character.level);
  var percent = Math.round((character.xp / need) * 100);

  nodes.level.textContent = character.level;
  nodes['level-text'].textContent = character.level;
  nodes['xp-value'].textContent = character.xp + ' / ' + need;
  nodes['xp-fill'].style.width = percent + '%';
  nodes['xp-track'].setAttribute('aria-valuenow', character.xp);
  nodes['xp-track'].setAttribute('aria-valuemax', need);

  nodes['stat-strength'].textContent = character.stats.strength;
  nodes['stat-intellect'].textContent = character.stats.intellect;
  nodes['stat-health'].textContent = character.stats.health;
  nodes['stat-discipline'].textContent = character.stats.discipline;

}

var FLAME_PATH = 'M5 .5C6.6 3 8.5 4 8.5 7A3.5 3.5 0 0 1 1.5 7c0-1.8 1.6-2.7 3.5-6.5z';

function createFlameIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 10 12');
  svg.setAttribute('aria-hidden', 'true');

  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', FLAME_PATH);
  path.setAttribute('fill', 'currentColor');

  svg.appendChild(path);
  return svg;
}

function createHabitCard(habit) {
  var stat = STATS[habit.stat];
  var done = isDoneToday(habit);
  var gain = xpFor(habit);

  var card = document.createElement('li');
  card.className = 'habit' + (done ? ' habit--completed' : '');

  var row = document.createElement('div');
  row.className = 'habit__row';

  var info = document.createElement('div');
  info.className = 'habit__info';

  var title = document.createElement('p');
  title.className = 'habit__title';
  title.textContent = habit.title;

  var tags = document.createElement('p');
  tags.className = 'habit__tags';

  var chip = document.createElement('span');
  chip.className = 'chip chip--' + habit.stat;
  chip.textContent = stat.label;

  var meta = document.createElement('span');
  meta.className = 'habit__gain';
  meta.textContent = '+' + gain + ' · +' + disciplineFor(gain) + ' ДИС';

  tags.append(chip, meta);
  info.append(title, tags);
  row.append(info);

  if (habit.streak > 0) {
    var streak = document.createElement('p');
    streak.className = 'pill pill--fire';

    var count = document.createElement('span');
    count.textContent = habit.streak;

    var hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.textContent = 'дней подряд';

    streak.append(createFlameIcon(), count, hint);
    row.append(streak);
  }

  var button = document.createElement('button');
  button.type = 'button';
  button.className = done ? 'btn btn--completed' : 'btn btn--done';
  button.textContent = done ? 'Готово' : 'Выполнено';
  button.disabled = done; // FR-4.6

  if (!done) {
    button.addEventListener('click', function () {
      completeHabit(habit.id);
    });
  }

  card.append(row, button);
  return card;
}

function renderHabits() {
  var visible = state.habits.filter(function (habit) {
    return !habit.archived;
  });

  /* Формат подзаголовка взят из макета: выполнено, всего и опыт за день
     одной строкой, без отдельного блока про лимит. */
  var doneCount = visible.filter(isDoneToday).length;
  nodes['today-meta'].textContent = doneCount + ' из ' + visible.length + ' · ' + xpToday() + '/' + DAILY_LIMIT;

  nodes.habits.replaceChildren();
  visible.forEach(function (habit) {
    nodes.habits.append(createHabitCard(habit));
  });
}

function render() {
  renderCharacter();
  renderHabits();
}

/** Короткое сообщение об итоге действия (принцип 1.2 — мгновенная обратная связь). */
function showMessage(text) {
  nodes.toast.textContent = text;
  nodes.toast.hidden = false;

  clearTimeout(messageTimer);
  messageTimer = setTimeout(function () {
    nodes.toast.hidden = true;
  }, 2600);
}

/** Заметное уведомление о новом уровне (FR-2.6). */
function showLevelUp(levelsGained) {
  var character = state.character;

  nodes['levelup-badge'].textContent = character.level;
  nodes['levelup-title'].textContent = 'Уровень ' + character.level;
  nodes['levelup-text'].textContent =
    (levelsGained > 1 ? 'Взято уровней за раз: ' + levelsGained + '. ' : '') +
    'Остаток опыта перенесён: ' + character.xp + ' из ' + xpToNextLevel(character.level) + ' до следующего.';

  nodes.levelup.hidden = false;
  nodes['levelup-close'].focus();
}

function hideLevelUp() {
  nodes.levelup.hidden = true;
}

document.addEventListener('DOMContentLoaded', function () {
  cacheNodes();
  state = loadState();
  saveState(); // закрепляем стартовый набор, иначе id привычек меняются при каждой загрузке
  render();

  nodes['levelup-close'].addEventListener('click', hideLevelUp);
  nodes.levelup.addEventListener('click', function (event) {
    if (event.target === nodes.levelup) hideLevelUp();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !nodes.levelup.hidden) hideLevelUp();
  });
});
