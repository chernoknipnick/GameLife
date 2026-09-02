/* Чтение и запись сохранения.
   Три ступени проверки — разбор, версия, форма — и запасная копия вместо
   молчаливого стирания. Те же ступени применяются к файлу при импорте
   (FR-15.3): файл приходит извне, доверия ему тем более меньше. */

import { ALL_STATS, BACKUP_KEY, DIFFICULTY, SCHEMA_VERSION, STATS, STORAGE_KEY } from './rules.js';
import { DEFAULT_RESET_HOUR } from './day.js';
import { createInitialState } from './schema.js';
import { rebuildStreak } from './streaks.js';
import { normalizeSchedule } from './schedule.js';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/* Разбор JSON ловит только синтаксический мусор. Строка вида
   {"version":1} разберётся успешно и уронит отрисовку на первом же
   обращении к character — причём навсегда: испорченное значение
   останется в хранилище и уронит приложение при каждой загрузке. */
export function looksLikeState(value) {
  if (!value || typeof value !== 'object') return false;
  if (!Array.isArray(value.habits) || !Array.isArray(value.history)) return false;

  const character = value.character;
  if (!character || typeof character !== 'object') return false;
  if (!isFiniteNumber(character.level) || !isFiniteNumber(character.xp)) return false;
  if (!character.stats || typeof character.stats !== 'object') return false;

  return ALL_STATS.every((key) => isFiniteNumber(character.stats[key]));
}

/**
 * Дотягивает сохранение до полной формы раздела 6.1.
 * Общая форма уже проверена; здесь чинятся мелочи, из-за которых
 * выбрасывать весь прогресс было бы нечестно.
 */
export function normalizeState(loaded) {
  const base = createInitialState();

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
  const hour = loaded.settings.dayResetHour;
  if (!isFiniteNumber(hour) || hour < 0 || hour > 23) {
    loaded.settings.dayResetHour = DEFAULT_RESET_HOUR;
  }

  /* Привычка с неизвестной характеристикой или сложностью уронит
     карточку на STATS[stat].label, поэтому такие записи отбрасываются. */
  loaded.habits = loaded.habits.filter(
    (habit) =>
      habit &&
      typeof habit.title === 'string' &&
      STATS[habit.stat] !== undefined &&
      DIFFICULTY[habit.difficulty] !== undefined
  );

  loaded.history = loaded.history.filter(
    (entry) => entry && typeof entry.date === 'string' && isFiniteNumber(entry.xp)
  );

  /* Серия, последнее выполнение и рекорд пересчитываются из истории при
     каждом чтении — и из хранилища, и из файла.

     Эти поля лишь кэшируют расчёт по истории, а разойтись с ней они
     могут: файл правят руками. Сохранение, где история знает про
     сегодняшнее выполнение, а lastDone пуст, позволяло выполнить
     привычку второй раз за сутки, и недельная сводка показывала больше
     ста процентов. Пересчёт закрывает это на обоих путях сразу, вместо
     заплатки на одном импорте. */
  loaded.habits.forEach((habit) => {
    habit.archived = habit.archived === true;
    /* Расписание приводится до пересчёта серий: они по нему и шагают.
       Строка 'daily' из сохранений v0.1—v0.3 понимается как прежде. */
    habit.schedule = normalizeSchedule(habit.schedule);
    rebuildStreak(loaded.history, habit);
  });

  return loaded;
}

/**
 * Разбирает уже прочитанный текст сохранения.
 * Возвращает {state} либо {error} с кодом причины — вызывающий сам
 * решает, что показать: при чтении хранилища это предупреждение с
 * запасной копией, при импорте файла — отказ с объяснением.
 */
export function parseState(raw) {
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'unparsable' };
  }

  /* Неравенство, а не «меньше»: сохранение из будущей версии читать тоже
     нечем. Перевод с версии на версию пишется тогда, когда схема
     действительно меняется. */
  if (!parsed || parsed.version !== SCHEMA_VERSION) return { error: 'version' };
  if (!looksLikeState(parsed)) return { error: 'shape' };

  return { state: normalizeState(parsed) };
}

/**
 * Читает сохранение из localStorage.
 * Возвращает состояние, признак новичка и, если сохранение оказалось
 * непригодным, текст предупреждения для игрока.
 */
export function loadState() {
  let raw;

  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Приватный режим или запрет хранилища: играем без сохранения.
    console.warn('Хранилище недоступно, прогресс не сохранится:', error);
    // Знакомство всё равно нужно: без него человек видит пустой экран без объяснений.
    return { game: createInitialState(), isNewPlayer: true, notice: null };
  }

  if (!raw) return { game: createInitialState(), isNewPlayer: true, notice: null };

  const result = parseState(raw);
  if (result.state) return { game: result.state, isNewPlayer: false, notice: null };

  /* Начинаем с нуля, но не молча: непригодное сохранение уезжает в
     запасной ключ. Без этого смена SCHEMA_VERSION стёрла бы прогресс
     всех, кто играл в прошлой версии. */
  console.warn('Сохранение непригодно, причина:', result.error);

  let notice = null;
  try {
    window.localStorage.setItem(BACKUP_KEY, raw);
    notice = 'Прежнее сохранение не удалось прочитать. Копия убрана в «' + BACKUP_KEY + '».';
  } catch (error) {
    console.warn('Не удалось сохранить копию:', error);
  }

  return { game: createInitialState(), isNewPlayer: true, notice };
}

export function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Не удалось сохранить прогресс:', error);
  }
}
