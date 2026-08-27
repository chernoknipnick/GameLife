/* Сутки меняются не в полночь, а в settings.dayResetHour (раздел 6.1).
   Тот, кто отмечает привычку в час ночи, закрывает вчерашний день —
   так честнее по отношению к живому распорядку.

   Ключ суток — строка вида ГГГГ-ММ-ДД. Такие ключи сравниваются как
   строки, без разбора даты, и этим пользуются выборки. */

export const DEFAULT_RESET_HOUR = 4;

function pad(value) {
  return value < 10 ? '0' + value : String(value);
}

export function dayKey(date, resetHour) {
  const shifted = new Date(date.getTime());
  shifted.setHours(shifted.getHours() - resetHour);
  return shifted.getFullYear() + '-' + pad(shifted.getMonth() + 1) + '-' + pad(shifted.getDate());
}

/** Сегодняшний ключ для указанного часа смены суток. */
export function todayKey(resetHour = DEFAULT_RESET_HOUR) {
  return dayKey(new Date(), resetHour);
}

export function shiftDay(key, delta) {
  const parts = key.split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setDate(date.getDate() + delta);
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

/** Ключ предыдущих суток — отличает продолжение серии от пропуска. */
export function dayBefore(key) {
  return shiftDay(key, -1);
}

/** Ключ следующих суток — нужен при пересчёте рекордной серии по истории. */
export function nextDay(key) {
  return shiftDay(key, 1);
}

/** Русское склонение: 1 день, 2 дня, 5 дней. */
export function pluralDays(count) {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return count + ' дней';

  const last = count % 10;
  if (last === 1) return count + ' день';
  if (last >= 2 && last <= 4) return count + ' дня';
  return count + ' дней';
}

export const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const WEEKDAY_FULL = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

export function weekdayIndex(key) {
  const parts = key.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getDay();
}
