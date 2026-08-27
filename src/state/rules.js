/* Правила игры — раздел 7 ТЗ.
   Модуль чистый: ничего не знает ни о состоянии, ни о DOM. */

export const STORAGE_KEY = 'gamelife';
export const BACKUP_KEY = 'gamelife.backup';
export const SCHEMA_VERSION = 1;
export const DAILY_LIMIT = 500;
export const MAX_HABITS = 20; // FR-4.7
export const MAX_TITLE_LENGTH = 60;
export const MAX_NAME_LENGTH = 24;

export const DIFFICULTY = {
  easy: { label: 'Лёгкая', xp: 10 },
  medium: { label: 'Средняя', xp: 25 },
  hard: { label: 'Тяжёлая', xp: 50 },
};

/* Первые три характеристики выбираются при создании привычки,
   дисциплина пассивная (FR-3.1, FR-3.3). */
export const STATS = {
  strength: { label: 'Сила', abbr: 'СИЛ' },
  intellect: { label: 'Интеллект', abbr: 'ИНТ' },
  health: { label: 'Здоровье', abbr: 'ЗДР' },
};

export const ALL_STATS = ['strength', 'intellect', 'health', 'discipline'];

export const STAT_LABELS = {
  ...STATS,
  discipline: { label: 'Дисциплина', abbr: 'ДИС' },
};

/* FR-3.5: у характеристики свой уровень, каждые 100 опыта. */
export const STAT_LEVEL_STEP = 100;

export function statLevel(xp) {
  return 1 + Math.floor(xp / STAT_LEVEL_STEP);
}

export function statProgress(xp) {
  return xp % STAT_LEVEL_STEP;
}

/** Порог опыта до следующего уровня. */
export function xpToNextLevel(level) {
  return 100 + (level - 1) * 50;
}

/** Множитель за длину серии (FR-7.5). */
export function streakMultiplier(streak) {
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1;
}

/** Дисциплина пассивная: капает с любого выполнения (FR-3.4a). */
export function disciplineFor(xp) {
  return Math.max(5, Math.round(xp * 0.3));
}

/** Опыт за выполнение привычки указанной сложности с указанной серией. */
export function xpForDifficulty(difficulty, streak) {
  return Math.round(DIFFICULTY[difficulty].xp * streakMultiplier(streak));
}

/* Шаблоны для онбординга (FR-1.3). Разложены по характеристикам, чтобы
   выбор читался как набор направлений, а не как список дел. */
export const TEMPLATES = [
  { title: 'Зарядка 10 минут', stat: 'strength', difficulty: 'medium' },
  { title: 'Тренировка в зале', stat: 'strength', difficulty: 'hard' },
  { title: 'Чтение 20 страниц', stat: 'intellect', difficulty: 'easy' },
  { title: 'Учебный курс 30 минут', stat: 'intellect', difficulty: 'medium' },
  { title: 'Медитация', stat: 'health', difficulty: 'easy' },
  { title: 'Восемь стаканов воды', stat: 'health', difficulty: 'easy' },
];

export const MIN_STARTER_HABITS = 3;
export const MAX_STARTER_HABITS = 5;

export const WEEK_DAYS = 7;
