/* Периодичность привычки (FR-4.10).
 *
 * Поле schedule лежит в сохранении с v0.1 со значением 'daily' — оно было
 * зарезервировано под это. Теперь это объект: { type: 'daily' } либо
 * { type: 'weekdays', days: [1, 3, 5] }, где 0 — воскресенье, как в
 * Date.getDay().
 *
 * Строка 'daily' из старых сохранений понимается по-прежнему, поэтому
 * менять SCHEMA_VERSION не нужно: приведение живёт в normalizeSchedule и
 * вызывается при каждом чтении.
 *
 * Третий вид из FR-4.10 — «N раз в неделю» — сюда не входит. Он не
 * ложится ни на FR-4.11, ни на счёт серий: у него нет запланированных
 * дней, а значит нечего показывать по расписанию, и серия из дней
 * превращается в серию из недель. Это отдельная механика, а не третья
 * галочка; описана в IDEAS.md.
 */

import { dayBefore, nextDay, weekdayIndex, WEEKDAY_SHORT } from './day.js';

export const DAILY = { type: 'daily' };

/** Сколько дней подряд шагать назад, прежде чем сдаться. */
const MAX_LOOKBACK = 7;

function isWeekday(value) {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * Приводит любое значение к пригодному расписанию.
 * Мусор и пустой набор дней превращаются в ежедневное: привычка, которую
 * нельзя выполнить никогда, — это не расписание, а поломка.
 */
export function normalizeSchedule(value) {
  if (value === 'daily' || !value || typeof value !== 'object') return { ...DAILY };
  if (value.type !== 'weekdays') return { ...DAILY };

  const days = Array.isArray(value.days) ? value.days.filter(isWeekday) : [];
  const unique = [...new Set(days)].sort((a, b) => a - b);

  if (unique.length === 0) return { ...DAILY };
  if (unique.length === 7) return { ...DAILY };

  return { type: 'weekdays', days: unique };
}

/** Запланирована ли привычка на эти сутки (FR-4.11). */
export function isScheduledOn(schedule, dateKey) {
  const план = normalizeSchedule(schedule);
  if (план.type === 'daily') return true;
  return план.days.includes(weekdayIndex(dateKey));
}

/**
 * Предыдущий запланированный день перед указанным.
 *
 * Нужен для серий: у привычки на понедельник-среду-пятницу пропущенный
 * вторник не пропуск, и «вчера» для неё — это предыдущий её день, а не
 * календарное вчера.
 */
export function previousScheduledDay(schedule, dateKey) {
  const план = normalizeSchedule(schedule);
  if (план.type === 'daily') return dayBefore(dateKey);

  let cursor = dayBefore(dateKey);
  for (let i = 0; i < MAX_LOOKBACK; i += 1) {
    if (isScheduledOn(план, cursor)) return cursor;
    cursor = dayBefore(cursor);
  }

  // Недостижимо: пустой набор уже превращён в ежедневное.
  return cursor;
}

/** Следующий запланированный день после указанного. Нужен при пересчёте рекорда. */
export function nextScheduledDay(schedule, dateKey) {
  const план = normalizeSchedule(schedule);
  if (план.type === 'daily') return nextDay(dateKey);

  let cursor = nextDay(dateKey);
  for (let i = 0; i < MAX_LOOKBACK; i += 1) {
    if (isScheduledOn(план, cursor)) return cursor;
    cursor = nextDay(cursor);
  }

  return cursor;
}

/** Короткая подпись для карточки: «Пн, Ср, Пт». Ежедневная — без подписи. */
export function describeSchedule(schedule) {
  const план = normalizeSchedule(schedule);
  if (план.type === 'daily') return null;

  return план.days.map((day) => WEEKDAY_SHORT[day]).join(', ');
}
