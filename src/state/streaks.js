/* Серии и рекорды считаются из истории — она единственный источник
   правды. Поля streak, lastDone и bestStreak в сохранении лишь кэшируют
   этот расчёт, и расходиться с ним они не должны. */

import { nextScheduledDay, previousScheduledDay } from './schedule.js';

/**
 * Пересчитывает серию, последнее выполнение и рекорд привычки по истории.
 *
 * Вычесть единицу из habit.streak нельзя: после пропуска дня серия была
 * сброшена до единицы, и прежнюю дату выполнения знает только история.
 * По ней же восстанавливается рекорд — отменяемый день мог его и поставить.
 *
 * Меняет привычку на месте и возвращает её.
 */
export function rebuildStreak(history, habit) {
  const days = {};
  let last = null;

  history.forEach((entry) => {
    if (entry.habitId !== habit.id) return;
    days[entry.date] = true;
    // Ключи вида ГГГГ-ММ-ДД сравниваются как строки без разбора даты.
    if (last === null || entry.date > last) last = entry.date;
  });

  habit.lastDone = last;

  /* Шаг назад делается по расписанию привычки, а не по календарю: у
     привычки на понедельник-среду-пятницу пропущенный вторник — не
     пропуск, и «предыдущий день» для неё это предыдущая пятница или
     среда (FR-4.10). Для ежедневной это по-прежнему вчера. */
  let current = 0;
  let cursor = last;
  while (cursor && days[cursor]) {
    current += 1;
    cursor = previousScheduledDay(habit.schedule, cursor);
  }
  habit.streak = current;

  let best = 0;
  Object.keys(days).forEach((date) => {
    // Считаем только от начала серии, иначе один отрезок пройдём многократно.
    if (days[previousScheduledDay(habit.schedule, date)]) return;

    let run = 0;
    let walk = date;
    while (days[walk]) {
      run += 1;
      walk = nextScheduledDay(habit.schedule, walk);
    }
    if (run > best) best = run;
  });
  habit.bestStreak = best;

  return habit;
}
