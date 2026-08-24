'use strict';

/* GameLife v0.1 — задачи 3—6, 8 и 10 Фазы 1.

   Покрывает FR-2.4—FR-2.6 (уровни), FR-3.4, FR-3.4a, FR-3.5 (опыт и
   уровни характеристик), FR-4.2—FR-4.7 (привычки: создание, удаление,
   сложности, одно выполнение в сутки, лимит в 20), FR-7.1—FR-7.4
   (стрики), NFR-2.1 (данные переживают закрытие браузера), NFR-4.4
   (удаление и сброс спрашивают подтверждение), FR-1.1—FR-1.4
   (онбординг), NFR-4.5 (пустое
   состояние), FR-15.1 (сброс прогресса),
   раздел 7 (баланс).

   Формат хранения повторяет раздел 6.1 ТЗ, включая поля, которые пока
   не используются (bestStreak, schedule, archived, settings.theme) —
   чтобы задачи 6–8 и переход на React в v0.3 не ломали сохранённые
   данные.

   Из плана Фазы 1 остаётся задача 2 в части десктопной раскладки в две
   колонки (раздел 8.3 ТЗ). */

/* --- Правила игры (раздел 7 ТЗ) --- */

var STORAGE_KEY = 'gamelife';
var SCHEMA_VERSION = 1;
var DAILY_LIMIT = 500;
var MAX_HABITS = 20; // FR-4.7
var MAX_TITLE_LENGTH = 60;

var DIFFICULTY = {
  easy: { label: 'Лёгкая', xp: 10 },
  medium: { label: 'Средняя', xp: 25 },
  hard: { label: 'Тяжёлая', xp: 50 },
};

/* Первые три характеристики выбираются при создании привычки,
   дисциплина пассивная (FR-3.1, FR-3.3). */
var STATS = {
  strength: { label: 'Сила', abbr: 'СИЛ' },
  intellect: { label: 'Интеллект', abbr: 'ИНТ' },
  health: { label: 'Здоровье', abbr: 'ЗДР' },
};

var ALL_STATS = ['strength', 'intellect', 'health', 'discipline'];

var STAT_LABELS = {
  strength: { label: 'Сила', abbr: 'СИЛ' },
  intellect: { label: 'Интеллект', abbr: 'ИНТ' },
  health: { label: 'Здоровье', abbr: 'ЗДР' },
  discipline: { label: 'Дисциплина', abbr: 'ДИС' },
};

/* FR-3.5: у характеристики свой уровень, каждые 100 опыта. */
var STAT_LEVEL_STEP = 100;

function statLevel(xp) {
  return 1 + Math.floor(xp / STAT_LEVEL_STEP);
}

function statProgress(xp) {
  return xp % STAT_LEVEL_STEP;
}

/* Шаблоны для онбординга (FR-1.3). Разложены по характеристикам, чтобы
   выбор читался как набор направлений, а не как список дел. */
var TEMPLATES = [
  { title: 'Зарядка 10 минут', stat: 'strength', difficulty: 'medium' },
  { title: 'Тренировка в зале', stat: 'strength', difficulty: 'hard' },
  { title: 'Чтение 20 страниц', stat: 'intellect', difficulty: 'easy' },
  { title: 'Учебный курс 30 минут', stat: 'intellect', difficulty: 'medium' },
  { title: 'Медитация', stat: 'health', difficulty: 'easy' },
  { title: 'Восемь стаканов воды', stat: 'health', difficulty: 'easy' },
];

var MIN_STARTER_HABITS = 3;
var MAX_STARTER_HABITS = 5;

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

/* Онбординг показывается только тому, у кого нет сохранения: у игрока
   с прогрессом он был бы навязчивым. Отдельного флага в состоянии нет
   намеренно — раздел 6.1 ТЗ его не описывает. */
var isNewPlayer = false;

/* Новый игрок начинает с чистого листа: первый уровень, пустой список
   с подсказкой. Захардкоженный демо-набор убран — привычки заводятся
   вручную, а с задачей 10 их будет предлагать онбординг. */
function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    character: {
      name: 'Герой',
      level: 1,
      xp: 0,
      totalXp: 0,
      createdAt: dayKey(new Date(), 4),
      stats: { strength: 0, intellect: 0, health: 0, discipline: 0 },
    },
    habits: [],
    tasks: [],
    history: [],
    settings: { theme: 'light', dayResetHour: 4 },
  };
}

function makeHabit(title, stat, difficulty) {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    title: title,
    stat: stat,
    difficulty: difficulty,
    schedule: 'daily',
    streak: 0,
    bestStreak: 0,
    lastDone: null,
    createdAt: today(),
    archived: false,
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

  if (!raw) {
    isNewPlayer = true;
    return createInitialState();
  }

  try {
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) {
      isNewPlayer = true;
      return createInitialState();
    }
    return parsed;
  } catch (error) {
    // Битые данные лучше заменить, чем уронить приложение.
    console.warn('Сохранение повреждено, начинаем заново:', error);
    isNewPlayer = true;
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

/**
 * Сколько дней подряд человек что-то отмечал (FR-7.7).
 * Сегодняшний день может быть ещё пустым — тогда отсчёт идёт от вчера,
 * иначе серия обнулялась бы каждое утро.
 */
function appStreak() {
  var days = {};
  state.history.forEach(function (entry) {
    days[entry.date] = true;
  });

  var cursor = today();
  if (!days[cursor]) cursor = dayBefore(cursor);
  if (!days[cursor]) return 0;

  var count = 0;
  while (days[cursor]) {
    count += 1;
    cursor = dayBefore(cursor);
  }
  return count;
}

/** Русское склонение: 1 день, 2 дня, 5 дней. */
function pluralDays(count) {
  var tail = count % 100;
  if (tail >= 11 && tail <= 14) return count + ' дней';

  var last = count % 10;
  if (last === 1) return count + ' день';
  if (last >= 2 && last <= 4) return count + ' дня';
  return count + ' дней';
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
  var habit = findHabit(id);

  if (!habit || isDoneToday(habit)) return false;

  var day = today();
  var continues = habit.lastDone === dayBefore(day);

  /* Множитель заслужен вчерашними днями, а не сегодняшним нажатием,
     поэтому считаем по серии ДО начисления. Оборванная серия множителя
     не даёт, даже если её число ещё висит на карточке. */
  var gain = Math.round(
    DIFFICULTY[habit.difficulty].xp * streakMultiplier(continues ? habit.streak : 0)
  );

  /* Раздел 7.3: лимит блокирующий, но ничего не отнимает. Проверяем до
     любых изменений — иначе пришлось бы откатывать серию, а откат легко
     теряет исходное значение. */
  if (xpToday() + gain > DAILY_LIMIT) {
    showMessage(
      'Дневной лимит в ' +
        DAILY_LIMIT +
        ' опыта исчерпан. Заработанное осталось при вас, начисление продолжится завтра.'
    );
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
    showMessage(
      '+' +
        gain +
        ' в характеристику «' +
        STATS[habit.stat].label +
        '», +' +
        discipline +
        ' к дисциплине'
    );
  }

  return true;
}

/**
 * Создаёт привычку из черновика формы.
 * Возвращает false, если создание не состоялось.
 */
function addHabit(title, stat, difficulty) {
  var clean = title.trim().slice(0, MAX_TITLE_LENGTH);

  if (!clean) {
    showMessage('Введите название привычки');
    return false;
  }

  // FR-4.7: список ограничен двадцатью привычками.
  if (activeHabits().length >= MAX_HABITS) {
    showMessage('Больше ' + MAX_HABITS + ' привычек не получится — список перестаёт помогать');
    return false;
  }

  state.habits.push(makeHabit(clean, stat, difficulty));
  saveState();
  render();
  showMessage('Привычка «' + clean + '» добавлена');
  return true;
}

/**
 * Удаляет привычку. Записи в истории остаются: они уже принесли опыт,
 * и стирать их значило бы задним числом отнять заработанное.
 */
function removeHabit(id) {
  var habit = findHabit(id);
  if (!habit) return false;

  state.habits = state.habits.filter(function (item) {
    return item.id !== id;
  });

  saveState();
  render();
  showMessage('Привычка «' + habit.title + '» удалена');
  return true;
}

/**
 * Возвращает всё к состоянию нового игрока (FR-15.1).
 * Действие необратимое, поэтому вызывается только после подтверждения.
 */
function resetProgress() {
  state = createInitialState();
  saveState();
  render();
  // Сброс возвращает в начало целиком, включая знакомство и выбор имени.
  openOnboarding();
}

/** Есть ли что сбрасывать: на нетронутом состоянии кнопка только мешает. */
function hasProgress() {
  return state.habits.length > 0 || state.history.length > 0 || state.character.totalXp > 0;
}

function findHabit(id) {
  return state.habits.find(function (item) {
    return item.id === id;
  });
}

function activeHabits() {
  return state.habits.filter(function (habit) {
    return !habit.archived;
  });
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
  'level',
  'level-text',
  'xp-value',
  'xp-track',
  'xp-fill',
  'today-meta',
  'habits',
  'abilities',
  'empty',
  'toast',
  'hero-name',
  'app-streak',
  'streak-pill',
  'sidebar-streak',
  'add-open',
  'reset-open',
  'levelup',
  'levelup-badge',
  'levelup-title',
  'levelup-text',
  'levelup-close',
  'confirm',
  'confirm-title',
  'confirm-text',
  'confirm-cancel',
  'confirm-delete',
  'sheet',
  'sheet-cancel',
  'sheet-save',
  'habit-title',
  'stat-choices',
  'diff-choices',
  'preview-xp',
  'preview-discipline',
  'onboarding',
  'onb-bar-0',
  'onb-bar-1',
  'onb-bar-2',
  'onb-step-0',
  'onb-step-1',
  'onb-step-2',
  'onb-begin',
  'onb-skip',
  'onb-name',
  'onb-back-1',
  'onb-next',
  'onb-hint',
  'onb-templates',
  'onb-back-2',
  'onb-finish',
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

  var streak = appStreak();
  nodes['hero-name'].textContent = character.name;
  nodes['app-streak'].textContent = streak;
  nodes['streak-pill'].hidden = streak === 0;
  nodes['sidebar-streak'].textContent = pluralDays(streak);

  nodes.level.textContent = character.level;
  nodes['level-text'].textContent = character.level;
  nodes['xp-value'].textContent = character.xp + ' / ' + need;
  nodes['xp-fill'].style.width = percent + '%';
  nodes['xp-track'].setAttribute('aria-valuenow', character.xp);
  nodes['xp-track'].setAttribute('aria-valuemax', need);
}

function createAbilityCard(key) {
  var xp = state.character.stats[key];
  var level = statLevel(xp);
  var progress = statProgress(xp);
  var meta = STAT_LABELS[key];

  var card = document.createElement('li');
  card.className = 'ability ability--' + key;

  var abbr = document.createElement('span');
  abbr.className = 'ability__abbr';
  abbr.textContent = meta.abbr;

  var value = document.createElement('span');
  value.className = 'ability__value';
  value.textContent = level;

  var track = document.createElement('span');
  track.className = 'ability__track';

  var fill = document.createElement('span');
  fill.className = 'ability__fill';
  fill.style.width = progress + '%';
  track.append(fill);

  /* Сокращение и голая цифра уровня понятны глазом, но не на слух —
     полную расшифровку отдаём скринридеру. */
  var hint = document.createElement('span');
  hint.className = 'visually-hidden';
  hint.textContent =
    meta.label +
    ': уровень ' +
    level +
    ', ' +
    xp +
    ' опыта, до следующего уровня ' +
    (STAT_LEVEL_STEP - progress);

  card.append(abbr, value, track, hint);
  return card;
}

function renderAbilities() {
  nodes.abilities.replaceChildren();
  ALL_STATS.forEach(function (key) {
    nodes.abilities.append(createAbilityCard(key));
  });
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

var TRASH_PATH =
  'M3 5.5h14M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 11a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9l.8-11';

function createTrashIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon-action');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', TRASH_PATH);
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');

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

  var actions = document.createElement('div');
  actions.className = 'habit__actions';

  if (habit.streak > 0) {
    var streak = document.createElement('p');
    streak.className = 'pill pill--fire';

    var count = document.createElement('span');
    count.textContent = habit.streak;

    var hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.textContent = 'дней подряд';

    streak.append(createFlameIcon(), count, hint);
    actions.append(streak);
  }

  var remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'habit__delete';
  remove.setAttribute('aria-label', 'Удалить привычку «' + habit.title + '»');
  remove.append(createTrashIcon());
  remove.addEventListener('click', function () {
    askDelete(habit.id);
  });

  actions.append(remove);
  row.append(actions);

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
  var visible = activeHabits();

  /* Формат подзаголовка взят из макета: выполнено, всего и опыт за день
     одной строкой, без отдельного блока про лимит. */
  var doneCount = visible.filter(isDoneToday).length;
  nodes['today-meta'].textContent =
    doneCount + ' из ' + visible.length + ' · ' + xpToday() + '/' + DAILY_LIMIT;

  // NFR-4.5: пустой список объясняет, что делать дальше.
  nodes.empty.hidden = visible.length > 0;
  nodes['reset-open'].hidden = !hasProgress();

  nodes.habits.replaceChildren();
  visible.forEach(function (habit) {
    nodes.habits.append(createHabitCard(habit));
  });
}

function render() {
  renderCharacter();
  renderAbilities();
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
    'Остаток опыта перенесён: ' +
    character.xp +
    ' из ' +
    xpToNextLevel(character.level) +
    ' до следующего.';

  nodes.levelup.hidden = false;
  nodes['levelup-close'].focus();
}

function hideLevelUp() {
  nodes.levelup.hidden = true;
}

/* --- Лист создания привычки --- */

var draft = { stat: 'strength', difficulty: 'medium' };

function createChoice(id, group, selected, label, extra) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'choice choice--' + id;
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', String(selected));

  if (extra) {
    var value = document.createElement('span');
    value.className = 'choice__xp';
    value.textContent = extra;

    var caption = document.createElement('span');
    caption.className = 'choice__label';
    caption.textContent = label;

    /* Из двух отдельных строк («+25» и «Средняя») складывается невнятное
       имя кнопки, поэтому задаём его явно. */
    button.setAttribute('aria-label', label + ', ' + extra + ' опыта');
    button.append(value, caption);
  } else {
    button.textContent = label;
  }

  button.addEventListener('click', function () {
    draft[group] = id;
    renderSheet();
  });

  return button;
}

function renderSheet() {
  nodes['stat-choices'].replaceChildren();
  Object.keys(STATS).forEach(function (key) {
    nodes['stat-choices'].append(
      createChoice(key, 'stat', draft.stat === key, STATS[key].label, null)
    );
  });

  nodes['diff-choices'].replaceChildren();
  Object.keys(DIFFICULTY).forEach(function (key) {
    var level = DIFFICULTY[key];
    nodes['diff-choices'].append(
      createChoice(key, 'difficulty', draft.difficulty === key, level.label, '+' + level.xp)
    );
  });

  /* У новой привычки серии нет, поэтому множитель равен единице —
     показываем базовый опыт сложности без обещаний. */
  var xp = DIFFICULTY[draft.difficulty].xp;
  nodes['preview-xp'].textContent = '+' + xp;
  nodes['preview-discipline'].textContent = '+' + disciplineFor(xp);
}

function openSheet() {
  draft = { stat: 'strength', difficulty: 'medium' };
  nodes['habit-title'].value = '';
  renderSheet();
  nodes.sheet.hidden = false;
  nodes['habit-title'].focus();
}

function closeSheet() {
  nodes.sheet.hidden = true;
  nodes['add-open'].focus();
}

function saveDraft() {
  if (addHabit(nodes['habit-title'].value, draft.stat, draft.difficulty)) {
    closeSheet();
  } else {
    nodes['habit-title'].focus();
  }
}

/* --- Подтверждение необратимых действий (FR-4.3, FR-15.1, NFR-4.4) --- */

var pendingAction = null;

function askConfirm(title, text, buttonLabel, action) {
  pendingAction = action;
  nodes['confirm-title'].textContent = title;
  nodes['confirm-text'].textContent = text;
  nodes['confirm-delete'].textContent = buttonLabel;

  nodes.confirm.hidden = false;
  // Фокус на отмене: подтверждение необратимо, случайный Enter не должен его запускать.
  nodes['confirm-cancel'].focus();
}

function closeConfirm() {
  pendingAction = null;
  nodes.confirm.hidden = true;
}

function runPendingAction() {
  var action = pendingAction;
  closeConfirm();
  if (action) action();
}

function askDelete(id) {
  var habit = findHabit(id);
  if (!habit) return;

  askConfirm(
    'Удалить привычку?',
    'Привычка «' +
      habit.title +
      '» исчезнет из списка' +
      (habit.streak > 0 ? ', серия в ' + habit.streak + ' дн. будет потеряна' : '') +
      '. Опыт и уровень персонажа останутся при вас.',
    'Удалить',
    function () {
      removeHabit(id);
    }
  );
}

function askReset() {
  askConfirm(
    'Сбросить весь прогресс?',
    'Персонаж вернётся на первый уровень, характеристики обнулятся, привычки и история выполнений будут удалены. Отменить это будет нельзя.',
    'Сбросить',
    resetProgress
  );
}

/* --- Онбординг (FR-1.1 — FR-1.4) --- */

var onboarding = { step: 0, name: '', picked: [] };

function createCheckIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 5l2.6 2.6L9 2');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');

  svg.appendChild(path);
  return svg;
}

function createTemplateCard(index) {
  var template = TEMPLATES[index];
  var stat = STATS[template.stat];
  var picked = onboarding.picked.indexOf(index) >= 0;

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'template';
  button.setAttribute('aria-pressed', String(picked));

  var box = document.createElement('span');
  box.className = 'template__box';
  box.append(createCheckIcon());

  var body = document.createElement('span');
  body.className = 'template__body';

  var title = document.createElement('span');
  title.className = 'template__title';
  title.textContent = template.title;

  var meta = document.createElement('span');
  meta.className = 'template__meta';
  meta.textContent =
    DIFFICULTY[template.difficulty].label + ' · +' + DIFFICULTY[template.difficulty].xp + ' опыта';

  body.append(title, meta);

  var chip = document.createElement('span');
  chip.className = 'template__stat chip chip--' + template.stat;
  chip.textContent = stat.abbr;

  button.append(box, body, chip);
  button.addEventListener('click', function () {
    toggleTemplate(index);
  });

  return button;
}

function toggleTemplate(index) {
  var at = onboarding.picked.indexOf(index);

  if (at >= 0) {
    onboarding.picked.splice(at, 1);
  } else if (onboarding.picked.length < MAX_STARTER_HABITS) {
    onboarding.picked.push(index);
  } else {
    showMessage('Для начала хватит ' + MAX_STARTER_HABITS + ' привычек — остальные добавите позже');
    return;
  }

  renderOnboarding();
}

function renderOnboarding() {
  var step = onboarding.step;

  [0, 1, 2].forEach(function (index) {
    nodes['onb-bar-' + index].className =
      'onboarding__step' + (index <= step ? ' onboarding__step--done' : '');
    nodes['onb-step-' + index].hidden = index !== step;
  });

  nodes['onb-templates'].replaceChildren();
  TEMPLATES.forEach(function (_, index) {
    nodes['onb-templates'].append(createTemplateCard(index));
  });

  var count = onboarding.picked.length;
  var enough = count >= MIN_STARTER_HABITS && count <= MAX_STARTER_HABITS;

  nodes['onb-hint'].textContent = enough
    ? 'Выбрано ' + count + '. Остальное добавите позже.'
    : 'Выберите от ' +
      MIN_STARTER_HABITS +
      ' до ' +
      MAX_STARTER_HABITS +
      ' — остальное добавите позже.';

  nodes['onb-finish'].disabled = !enough;
}

function openOnboarding() {
  onboarding = { step: 0, name: '', picked: [] };
  nodes['onb-name'].value = '';
  renderOnboarding();
  nodes.onboarding.hidden = false;
  nodes['onb-begin'].focus();
}

function goToStep(step) {
  onboarding.step = step;
  renderOnboarding();

  if (step === 1) nodes['onb-name'].focus();
  else if (step === 2) nodes['onb-templates'].querySelector('.template').focus();
}

/** Завершает знакомство: имя и выбранные шаблоны переносятся в состояние. */
function finishOnboarding(indexes) {
  var name = nodes['onb-name'].value.trim().slice(0, 24);
  if (name) state.character.name = name;

  indexes.forEach(function (index) {
    var template = TEMPLATES[index];
    state.habits.push(makeHabit(template.title, template.stat, template.difficulty));
  });

  saveState();
  nodes.onboarding.hidden = true;
  render();

  showMessage(
    indexes.length > 0
      ? 'Готово, ' + state.character.name + '. Отмечайте выполненное — персонаж будет расти.'
      : 'Готово. Добавьте первую привычку, когда будете готовы.'
  );
}

document.addEventListener('DOMContentLoaded', function () {
  cacheNodes();
  state = loadState();
  saveState(); // закрепляем стартовое состояние, иначе id привычек меняются при каждой загрузке
  render();

  if (isNewPlayer) openOnboarding();

  nodes['levelup-close'].addEventListener('click', hideLevelUp);
  nodes.levelup.addEventListener('click', function (event) {
    if (event.target === nodes.levelup) hideLevelUp();
  });

  nodes['add-open'].addEventListener('click', openSheet);
  nodes['sheet-cancel'].addEventListener('click', closeSheet);
  nodes['sheet-save'].addEventListener('click', saveDraft);
  nodes.sheet.addEventListener('click', function (event) {
    if (event.target === nodes.sheet) closeSheet();
  });
  nodes['habit-title'].addEventListener('keydown', function (event) {
    if (event.key === 'Enter') saveDraft();
  });

  nodes['confirm-cancel'].addEventListener('click', closeConfirm);
  nodes['confirm-delete'].addEventListener('click', runPendingAction);
  nodes['reset-open'].addEventListener('click', askReset);

  nodes['onb-begin'].addEventListener('click', function () {
    goToStep(1);
  });
  // FR-1.4: выйти можно на первом же экране, без выбора привычек.
  nodes['onb-skip'].addEventListener('click', function () {
    finishOnboarding([]);
  });
  nodes['onb-back-1'].addEventListener('click', function () {
    goToStep(0);
  });
  nodes['onb-next'].addEventListener('click', function () {
    goToStep(2);
  });
  nodes['onb-name'].addEventListener('keydown', function (event) {
    if (event.key === 'Enter') goToStep(2);
  });
  nodes['onb-back-2'].addEventListener('click', function () {
    goToStep(1);
  });
  nodes['onb-finish'].addEventListener('click', function () {
    finishOnboarding(onboarding.picked);
  });
  nodes.confirm.addEventListener('click', function (event) {
    if (event.target === nodes.confirm) closeConfirm();
  });

  /* Escape закрывает то, что открыто сверху: сначала подтверждение,
     потом лист, потом окно уровня. */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (!nodes.confirm.hidden) closeConfirm();
    else if (!nodes.sheet.hidden) closeSheet();
    else if (!nodes.levelup.hidden) hideLevelUp();
  });
});
