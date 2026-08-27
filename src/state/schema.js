/* Форма сохранения повторяет раздел 6.1 ТЗ, включая поля, которые пока
   не используются (schedule, archived, settings.theme) — чтобы будущие
   релизы не ломали уже сохранённые данные. */

import { SCHEMA_VERSION } from './rules.js';
import { DEFAULT_RESET_HOUR, dayKey, todayKey } from './day.js';

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
    settings: { theme: 'light', dayResetHour: DEFAULT_RESET_HOUR },
  };
}

export function makeHabit(title, stat, difficulty, resetHour = DEFAULT_RESET_HOUR) {
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    title,
    stat,
    difficulty,
    schedule: 'daily',
    streak: 0,
    bestStreak: 0,
    lastDone: null,
    createdAt: todayKey(resetHour),
    archived: false,
  };
}
