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

   Из v0.2: FR-4.9 — отмена выполнения в течение текущих суток.

   Формат хранения повторяет раздел 6.1 ТЗ, включая поля, которые пока
   не используются (bestStreak, schedule, archived, settings.theme) —
   чтобы задачи 6–8 и переход на React в v0.3 не ломали сохранённые
   данные.

   План Фазы 1 закрыт целиком, включая десктопную раскладку в две
   колонки (раздел 8.3 ТЗ). */

/* --- Правила игры (раздел 7 ТЗ) --- */

var STORAGE_KEY = 'gamelife';
var BACKUP_KEY = 'gamelife.backup';
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

function shiftDay(key, delta) {
  var parts = key.split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + delta);
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

/** Ключ предыдущих суток — нужен, чтобы отличить продолжение серии от пропуска. */
function dayBefore(key) {
  return shiftDay(key, -1);
}

/** Ключ следующих суток — нужен при пересчёте рекордной серии по истории. */
function nextDay(key) {
  return shiftDay(key, 1);
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

/* Разбор JSON ловит только синтаксический мусор. Строка вида
   {"version":1} разберётся успешно и уронит отрисовку на первом же
   обращении к character — причём навсегда: испорченное значение
   останется в хранилище и уронит приложение при каждой загрузке.
   Поэтому проверяем ещё и форму. */

function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function looksLikeState(value) {
  if (!value || typeof value !== 'object') return false;
  if (!Array.isArray(value.habits) || !Array.isArray(value.history)) return false;

  var character = value.character;
  if (!character || typeof character !== 'object') return false;
  if (!isFiniteNumber(character.level) || !isFiniteNumber(character.xp)) return false;
  if (!character.stats || typeof character.stats !== 'object') return false;

  return ALL_STATS.every(function (key) {
    return isFiniteNumber(character.stats[key]);
  });
}

/**
 * Дотягивает сохранение до полной формы раздела 6.1.
 * Общая форма уже проверена; здесь чинятся мелочи, из-за которых
 * выбрасывать весь прогресс было бы нечестно.
 */
function normalizeState(loaded) {
  var base = createInitialState();

  if (typeof loaded.character.name !== 'string' || !loaded.character.name.trim()) {
    loaded.character.name = base.character.name;
  }
  if (!isFiniteNumber(loaded.character.totalXp)) {
    loaded.character.totalXp = loaded.character.xp;
  }
  if (!Array.isArray(loaded.tasks)) loaded.tasks = [];

  if (!loaded.settings || typeof loaded.settings !== 'object') {
    loaded.settings = base.settings;
  }

  /* Час смены суток участвует в каждом расчёте даты: мусор здесь сломал
     бы и стрики, и дневной лимит. */
  var hour = loaded.settings.dayResetHour;
  if (!isFiniteNumber(hour) || hour < 0 || hour > 23) {
    loaded.settings.dayResetHour = base.settings.dayResetHour;
  }

  /* Привычка с неизвестной характеристикой или сложностью уронит
     карточку на STATS[stat].label, поэтому такие записи отбрасываются. */
  loaded.habits = loaded.habits.filter(function (habit) {
    return (
      habit &&
      typeof habit.title === 'string' &&
      STATS[habit.stat] !== undefined &&
      DIFFICULTY[habit.difficulty] !== undefined
    );
  });

  loaded.habits.forEach(function (habit) {
    if (!isFiniteNumber(habit.streak)) habit.streak = 0;
    if (!isFiniteNumber(habit.bestStreak)) habit.bestStreak = habit.streak;
    if (typeof habit.lastDone !== 'string') habit.lastDone = null;
    habit.archived = habit.archived === true;
  });

  loaded.history = loaded.history.filter(function (entry) {
    return entry && typeof entry.date === 'string' && isFiniteNumber(entry.xp);
  });

  return loaded;
}

/* Сообщение, которое надо показать, когда экран освободится: во время
   онбординга всплывающую подсказку всё равно не видно. */
var pendingNotice = null;

/**
 * Начинает с нуля, но не молча: непригодное сохранение уезжает в
 * запасной ключ, а игрок получает предупреждение. Без этого первая же
 * смена SCHEMA_VERSION в v0.2 стёрла бы прогресс всех, кто играл в v0.1.
 */
function startFresh(raw, reason) {
  console.warn(reason);

  try {
    window.localStorage.setItem(BACKUP_KEY, raw);
    pendingNotice = 'Прежнее сохранение не удалось прочитать. Копия убрана в «' + BACKUP_KEY + '».';
  } catch (error) {
    console.warn('Не удалось сохранить копию:', error);
  }

  isNewPlayer = true;
  return createInitialState();
}

function loadState() {
  var raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Приватный режим или запрет хранилища: играем без сохранения.
    console.warn('Хранилище недоступно, прогресс не сохранится:', error);
    // Знакомство всё равно нужно: без него человек видит пустой экран без объяснений.
    isNewPlayer = true;
    return createInitialState();
  }

  if (!raw) {
    isNewPlayer = true;
    return createInitialState();
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return startFresh(raw, 'Сохранение не разбирается: ' + error);
  }

  /* Неравенство, а не «меньше»: сохранение из будущей версии читать тоже
     нечем. Перевод с версии на версию пишется тогда, когда схема
     действительно меняется; до тех пор честнее сберечь копию. */
  if (!parsed || parsed.version !== SCHEMA_VERSION) {
    return startFresh(raw, 'Версия сохранения не совпадает с ожидаемой.');
  }

  if (!looksLikeState(parsed)) {
    return startFresh(raw, 'Сохранение неполное или испорчено.');
  }

  return normalizeState(parsed);
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
 * Точная обратная операция к applyLevelUps: отменённое выполнение могло
 * поднять уровень, и тогда его надо снять вместе с опытом (FR-4.9).
 */
function applyLevelDowns() {
  var character = state.character;

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
function rebuildStreak(habit) {
  var days = {};
  var last = null;

  state.history.forEach(function (entry) {
    if (entry.habitId !== habit.id) return;
    days[entry.date] = true;
    // Ключи вида ГГГГ-ММ-ДД сравниваются как строки без разбора даты.
    if (last === null || entry.date > last) last = entry.date;
  });

  habit.lastDone = last;

  var current = 0;
  var cursor = last;
  while (cursor && days[cursor]) {
    current += 1;
    cursor = dayBefore(cursor);
  }
  habit.streak = current;

  var best = 0;
  Object.keys(days).forEach(function (date) {
    // Считаем только от начала серии, иначе один и тот же отрезок пройдём многократно.
    if (days[dayBefore(date)]) return;

    var run = 0;
    var walk = date;
    while (days[walk]) {
      run += 1;
      walk = nextDay(walk);
    }
    if (run > best) best = run;
  });
  habit.bestStreak = best;
}

/**
 * Отменяет сегодняшнее выполнение (FR-4.9).
 *
 * Закрывает разрыв между NFR-4.4 и принципом 1.1: обратимость нужна, но
 * подтверждение на ежедневное действие сломало бы отметку в два действия.
 * Отменить можно только текущие сутки — вчерашний день уже закрыт.
 *
 * Возвращает false, если отменять нечего.
 */
function undoHabit(id) {
  var habit = findHabit(id);
  if (!habit || !isDoneToday(habit)) return false;

  var day = today();

  /* Запись за сутки одна (FR-4.6), но ищем с конца: свежая запись там. */
  var at = -1;
  for (var i = state.history.length - 1; i >= 0; i -= 1) {
    if (state.history[i].date === day && state.history[i].habitId === id) {
      at = i;
      break;
    }
  }

  /* Опыт снимаем ровно тот, что был начислен: множитель за серию с тех пор
     мог измениться, и пересчёт по текущей формуле вернул бы другое число. */
  if (at < 0) return false;
  var gain = state.history[at].xp;
  state.history.splice(at, 1);

  state.character.xp -= gain;
  state.character.totalXp -= gain;
  state.character.stats[habit.stat] -= gain;
  state.character.stats.discipline -= disciplineFor(gain);

  applyLevelDowns();
  rebuildStreak(habit);

  saveState();
  render();
  showMessage('Выполнение «' + habit.title + '» отменено, ' + gain + ' опыта снято');
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
 * Меняет название, характеристику и сложность привычки (FR-4.8).
 * Возвращает false, если правка не состоялась.
 *
 * История не переписывается: начисленный опыт остаётся там, куда попал, и
 * в том размере, в каком был начислен. Новая сложность и новая
 * характеристика действуют со следующего выполнения — иначе правка задним
 * числом меняла бы уже закрытые сутки, а отмена выполнения (FR-4.9)
 * снимала бы не то, что начисляла.
 *
 * Серия и рекорд не трогаются: смена названия — не пропуск дня.
 */
function updateHabit(id, title, stat, difficulty) {
  var habit = findHabit(id);
  if (!habit) return false;

  var clean = title.trim().slice(0, MAX_TITLE_LENGTH);

  if (!clean) {
    showMessage('Введите название привычки');
    return false;
  }

  habit.title = clean;
  habit.stat = stat;
  habit.difficulty = difficulty;

  saveState();
  render();
  showMessage('Привычка «' + clean + '» изменена');
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
  'sheet-title',
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

var PENCIL_PATH =
  'M13.4 3.1a1.5 1.5 0 0 1 2.1 0l1.4 1.4a1.5 1.5 0 0 1 0 2.1L7.5 16.1 3.5 17l.9-4L13.4 3.1z';

var TRASH_PATH =
  'M3 5.5h14M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 11a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9l.8-11';

/** Обе иконки действий рисуются одинаково и отличаются только контуром. */
function createActionIcon(shape) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon-action');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', shape);
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

  /* У выполненной привычки обещание опыта бессмысленно — он уже начислен,
     поэтому на его месте стоит отметка о выполнении. Слово «Готово» ушло
     сюда с кнопки: кнопка теперь отменяет. */
  var meta = document.createElement('span');
  meta.className = 'habit__gain';
  meta.textContent = done ? 'Готово' : '+' + gain + ' · +' + disciplineFor(gain) + ' ДИС';

  tags.append(chip, meta);
  info.append(title, tags);
  row.append(info);

  var actions = document.createElement('div');
  actions.className = 'habit__actions';

  /* Именно живая серия: habit.streak после пропуска дня остаётся
     прежним числом, и огонёк врал бы про серию, которой уже нет —
     тем более рядом с опытом, посчитанным без множителя (FR-7.3). */
  var streakDays = activeStreak(habit);

  if (streakDays > 0) {
    var streak = document.createElement('p');
    streak.className = 'pill pill--fire';

    /* Цифра рисуется отдельно от подписи, поэтому вслух выходило
       «1 дней подряд». Скринридеру отдаём склонённую строку целиком,
       а видимую цифру от него прячем. */
    var count = document.createElement('span');
    count.textContent = streakDays;
    count.setAttribute('aria-hidden', 'true');

    var hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.textContent = pluralDays(streakDays) + ' подряд';

    streak.append(createFlameIcon(), count, hint);
    actions.append(streak);
  }

  var edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'habit__action habit__action--edit';
  edit.setAttribute('aria-label', 'Изменить привычку «' + habit.title + '»');
  edit.append(createActionIcon(PENCIL_PATH));
  edit.addEventListener('click', function () {
    openSheet(habit);
  });

  var remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'habit__action habit__action--delete';
  remove.setAttribute('aria-label', 'Удалить привычку «' + habit.title + '»');
  remove.append(createActionIcon(TRASH_PATH));
  remove.addEventListener('click', function () {
    askDelete(habit.id);
  });

  actions.append(edit, remove);
  row.append(actions);

  /* FR-4.6 соблюдено по-прежнему: выполнить дважды за сутки нельзя,
     кнопка выполненной привычки не повторяет действие, а отменяет его. */
  var button = document.createElement('button');
  button.type = 'button';
  button.className = done ? 'btn btn--undo' : 'btn btn--done';
  button.textContent = done ? 'Отменить' : 'Выполнено';
  button.setAttribute(
    'aria-label',
    (done ? 'Отменить выполнение привычки «' : 'Отметить выполненной привычку «') +
      habit.title +
      '»'
  );

  button.addEventListener('click', function () {
    if (done) undoHabit(habit.id);
    else completeHabit(habit.id);
  });

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

/** Показывает отложенное предупреждение, когда экран освободился. */
function flushNotice() {
  if (!pendingNotice) return;
  showMessage(pendingNotice);
  pendingNotice = null;
}

function hideLevelUp() {
  nodes.levelup.hidden = true;
}

/* --- Лист создания привычки --- */

/* draft.id держит привычку, которую правим; null — создаём новую (FR-4.8). */
var draft = { id: null, stat: 'strength', difficulty: 'medium' };

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

  /* У новой привычки серии нет, поэтому множитель равен единице. При
     правке считаем по живой серии — иначе лист обещал бы одно число, а
     карточка в списке показывала другое. */
  var edited = draft.id ? findHabit(draft.id) : null;
  var base = DIFFICULTY[draft.difficulty].xp;
  var xp = edited ? Math.round(base * streakMultiplier(activeStreak(edited))) : base;
  nodes['preview-xp'].textContent = '+' + xp;
  nodes['preview-discipline'].textContent = '+' + disciplineFor(xp);
}

/** Открывает лист: с привычкой — на правку, без неё — на создание. */
function openSheet(habit) {
  draft = habit
    ? { id: habit.id, stat: habit.stat, difficulty: habit.difficulty }
    : { id: null, stat: 'strength', difficulty: 'medium' };

  nodes['habit-title'].value = habit ? habit.title : '';
  nodes['sheet-title'].textContent = habit ? 'Изменить привычку' : 'Новая привычка';
  nodes['sheet-save'].textContent = habit ? 'Сохранить' : 'Создать';

  renderSheet();
  nodes.sheet.hidden = false;
  nodes['habit-title'].focus();
}

function closeSheet() {
  nodes.sheet.hidden = true;
  nodes['add-open'].focus();
}

function saveDraft() {
  var saved = draft.id
    ? updateHabit(draft.id, nodes['habit-title'].value, draft.stat, draft.difficulty)
    : addHabit(nodes['habit-title'].value, draft.stat, draft.difficulty);

  if (saved) closeSheet();
  else nodes['habit-title'].focus();
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
      (activeStreak(habit) > 0 ? ', серия в ' + activeStreak(habit) + ' дн. будет потеряна' : '') +
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

  // Предупреждение о потерянном сохранении важнее приветствия.
  flushNotice();
}

document.addEventListener('DOMContentLoaded', function () {
  cacheNodes();
  state = loadState();
  saveState(); // закрепляем стартовое состояние, иначе id привычек меняются при каждой загрузке
  render();

  if (isNewPlayer) openOnboarding();
  else flushNotice();

  nodes['levelup-close'].addEventListener('click', hideLevelUp);
  nodes.levelup.addEventListener('click', function (event) {
    if (event.target === nodes.levelup) hideLevelUp();
  });

  nodes['add-open'].addEventListener('click', function () {
    openSheet(null);
  });
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
