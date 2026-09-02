/* Производные величины. Всё считается из состояния на лету: отдельные
   счётчики пережили бы смену суток и разошлись бы с историей. */

import { DAILY_LIMIT, WEEK_DAYS, streakMultiplier, DIFFICULTY } from './rules.js';
import { dayBefore, daysBetween, todayKey } from './day.js';
import { isScheduledOn, previousScheduledDay } from './schedule.js';

export function today(state) {
  return todayKey(state.settings.dayResetHour);
}

export function findHabit(state, id) {
  return state.habits.find((habit) => habit.id === id);
}

export function activeHabits(state) {
  return state.habits.filter((habit) => !habit.archived);
}

/** Привычка считается выполненной, только если отмечена в текущих сутках (FR-4.5). */
export function isDoneToday(state, habit) {
  return habit.lastDone === today(state);
}

/** Запланирована ли привычка на сегодня (FR-4.11). */
export function isScheduledToday(state, habit) {
  return isScheduledOn(habit.schedule, today(state));
}

/** Привычки, которые сегодня в деле. */
export function todayHabits(state) {
  return activeHabits(state).filter((habit) => isScheduledToday(state, habit));
}

/** Привычки, которые есть, но сегодня не запланированы. */
export function restingHabits(state) {
  return activeHabits(state).filter((habit) => !isScheduledToday(state, habit));
}

/**
 * Серия, которая действует прямо сейчас: после пропуска она обнуляется.
 * «Пропуск» считается по расписанию привычки, а не по календарю.
 */
export function activeStreak(state, habit) {
  if (isDoneToday(state, habit)) return habit.streak;
  return habit.lastDone === previousScheduledDay(habit.schedule, today(state))
    ? habit.streak
    : 0;
}

/** Опыт, который принесёт следующее выполнение, с учётом живой серии. */
export function xpFor(state, habit) {
  return Math.round(DIFFICULTY[habit.difficulty].xp * streakMultiplier(activeStreak(state, habit)));
}

/**
 * Сколько дней подряд человек что-то отмечал (FR-7.7).
 * Сегодняшний день может быть ещё пустым — тогда отсчёт идёт от вчера,
 * иначе серия обнулялась бы каждое утро.
 */
export function appStreak(state) {
  const days = {};
  state.history.forEach((entry) => {
    days[entry.date] = true;
  });

  let cursor = today(state);
  if (!days[cursor]) cursor = dayBefore(cursor);
  if (!days[cursor]) return 0;

  let count = 0;
  while (days[cursor]) {
    count += 1;
    cursor = dayBefore(cursor);
  }
  return count;
}

/** Опыт за сегодня считаем из истории — счётчик пережил бы смену суток (раздел 7.3). */
export function xpToday(state) {
  const day = today(state);
  return state.history.reduce((sum, entry) => (entry.date === day ? sum + entry.xp : sum), 0);
}

export function limitLeft(state) {
  return DAILY_LIMIT - xpToday(state);
}

/** Ключи последних семи суток, от старых к новым. */
export function lastWeekDays(state) {
  const days = [];
  let cursor = today(state);

  for (let i = 0; i < WEEK_DAYS; i += 1) {
    days.unshift(cursor);
    cursor = dayBefore(cursor);
  }

  return days;
}

/**
 * Сводка за неделю: выполнения по дням (FR-10.1) и доля выполненного (FR-10.2).
 *
 * Считается только по привычкам, которые есть в списке сейчас. Записи
 * удалённых остаются в истории, но показывать выполнение того, чего в
 * списке нет, значило бы врать о текущем наборе.
 *
 * День до создания привычки в знаменатель не идёт: пропустить нельзя то,
 * чего ещё не было. Иначе новая привычка сразу портила бы всю неделю.
 */
export function weekSummary(state) {
  const days = lastWeekDays(state);
  const habits = activeHabits(state);

  const alive = {};
  habits.forEach((habit) => {
    alive[habit.id] = true;
  });

  const done = {};
  state.history.forEach((entry) => {
    if (!alive[entry.habitId]) return;
    if (days.indexOf(entry.date) < 0) return;
    done[entry.date] = (done[entry.date] || 0) + 1;
  });

  let totalDone = 0;
  let totalPossible = 0;

  const list = days.map((date) => {
    /* В знаменатель идут только те привычки, которые в этот день были
       запланированы: непропущенный вторник у привычки на понедельник и
       среду — не невыполнение (FR-4.11). */
    const possible = habits.filter(
      (habit) =>
        (!habit.createdAt || habit.createdAt <= date) && isScheduledOn(habit.schedule, date)
    ).length;
    const count = done[date] || 0;

    totalDone += count;
    totalPossible += possible;

    return { date, done: count, possible };
  });

  return {
    days: list,
    done: totalDone,
    possible: totalPossible,
    percent: totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0,
  };
}

/**
 * Который день человек в игре (FR-2.8).
 *
 * День создания считается первым, а не нулевым: «первый день» понятнее,
 * чем «ноль дней», и совпадает с тем, как считают дни люди.
 */
export function daysInGame(state) {
  const начало = state.character.createdAt;
  if (!начало) return 1;

  return Math.max(1, daysBetween(начало, today(state)) + 1);
}

/** Есть ли что сбрасывать: на нетронутом состоянии кнопка только мешает. */
export function hasProgress(state) {
  return state.habits.length > 0 || state.history.length > 0 || state.character.totalXp > 0;
}
