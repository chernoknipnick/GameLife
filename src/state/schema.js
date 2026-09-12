/* Форма сохранения повторяет раздел 6.1 ТЗ, включая поля, которые пока
   не используются (archived) — чтобы будущие релизы не ломали уже
   сохранённые данные. Поле `settings.theme` лежало без дела с v0.1 и
   заработало в FR-15.4, `schedule` — в FR-4.10. */

import { SCHEMA_VERSION } from './rules.js';
import { DEFAULT_RESET_HOUR, dayKey, todayKey } from './day.js';
import { DAILY, normalizeSchedule } from './schedule.js';
import { initialTheme } from './theme.js';

/* Новый игрок начинает с чистого листа: первый уровень, пустой список с
   подсказкой. Имя «Герой» из раздела 6.1 спрашивает онбординг. */
export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    character: {
      name: 'Герой',
      level: 1,
      xp: 0,
      totalXp: 0,
      createdAt: dayKey(new Date(), DEFAULT_RESET_HOUR),
      stats: { strength: 0, intellect: 0, health: 0, discipline: 0 },
    },
    habits: [],
    tasks: [],
    history: [],
    /* Тему нового игрока подсказывает система: у него ещё нет выбора,
       а встречать белым экраном того, у кого всё тёмное, невежливо. */
    settings: { theme: initialTheme(), dayResetHour: DEFAULT_RESET_HOUR },
  };
}

export function makeHabit(
  title,
  stat,
  difficulty,
  resetHour = DEFAULT_RESET_HOUR,
  schedule = DAILY
) {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    title,
    stat,
    difficulty,
    schedule: normalizeSchedule(schedule),
    streak: 0,
    bestStreak: 0,
    lastDone: null,
    createdAt: todayKey(resetHour),
    archived: false,
  };
}
