import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './schema.js';
import { activeStreak, appStreak, weekSummary, xpToday } from './selectors.js';

/* Все выборки зависят от «сегодня», поэтому время фиксируется.
   Полдень, а не полночь: рядом с границей суток тест начал бы зависеть
   от часового пояса машины. */
const СЕГОДНЯ = '2026-08-27';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 27, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

function игра(изменения = {}) {
  return { ...createInitialState(), ...изменения };
}

/* Рекорд по умолчанию равен серии — фикстура должна быть согласованной,
   иначе проверка мерит не поведение, а кривизну входных данных. */
function привычка(o = {}) {
  const streak = o.streak ?? 0;

  return {
    id: 'h1',
    title: 'Тест',
    stat: 'strength',
    difficulty: 'medium',
    schedule: 'daily',
    streak,
    bestStreak: streak,
    lastDone: null,
    createdAt: '2026-08-01',
    archived: false,
    ...o,
  };
}

describe('живая серия', () => {
  it('оборванная серия не считается', () => {
    // Число на привычке ещё стоит, но последний раз был позавчера.
    const game = игра({ habits: [привычка({ streak: 5, lastDone: '2026-08-25' })] });
    expect(activeStreak(game, game.habits[0])).toBe(0);
  });

  it('вчерашнее выполнение серию продолжает', () => {
    const game = игра({ habits: [привычка({ streak: 5, lastDone: '2026-08-26' })] });
    expect(activeStreak(game, game.habits[0])).toBe(5);
  });

  it('сегодняшнее выполнение серию сохраняет', () => {
    const game = игра({ habits: [привычка({ streak: 5, lastDone: СЕГОДНЯ })] });
    expect(activeStreak(game, game.habits[0])).toBe(5);
  });
});

describe('общая серия приложения', () => {
  it('пустой сегодняшний день не обнуляет счёт', () => {
    const game = игра({
      history: [
        { date: '2026-08-25', habitId: 'h1', xp: 25 },
        { date: '2026-08-26', habitId: 'h1', xp: 25 },
      ],
    });
    expect(appStreak(game)).toBe(2);
  });

  it('пропуск вчерашнего дня обнуляет счёт', () => {
    const game = игра({ history: [{ date: '2026-08-25', habitId: 'h1', xp: 25 }] });
    expect(appStreak(game)).toBe(0);
  });
});

describe('опыт за сегодня', () => {
  it('складывает только сегодняшние записи', () => {
    const game = игра({
      history: [
        { date: СЕГОДНЯ, habitId: 'a', xp: 25 },
        { date: СЕГОДНЯ, habitId: 'b', xp: 50 },
        { date: '2026-08-26', habitId: 'c', xp: 100 },
      ],
    });
    expect(xpToday(game)).toBe(75);
  });
});

describe('сводка за неделю', () => {
  it('день до создания привычки не идёт в знаменатель', () => {
    // Привычка создана 25-го: до неё пропускать было нечего.
    const game = игра({ habits: [привычка({ createdAt: '2026-08-25' })] });
    const { days, possible } = weekSummary(game);

    expect(days.map((d) => d.possible)).toEqual([0, 0, 0, 0, 1, 1, 1]);
    expect(possible).toBe(3);
  });

  it('записи удалённой привычки не идут в числитель', () => {
    const game = игра({
      habits: [привычка({ id: 'живая' })],
      history: [
        { date: '2026-08-26', habitId: 'живая', xp: 25 },
        { date: '2026-08-26', habitId: 'удалённая', xp: 50 },
      ],
    });

    expect(weekSummary(game).done).toBe(1);
  });

  it('считает процент от возможного', () => {
    const game = игра({
      habits: [привычка({ createdAt: '2026-08-01' })],
      history: [
        { date: '2026-08-25', habitId: 'h1', xp: 25 },
        { date: '2026-08-26', habitId: 'h1', xp: 25 },
      ],
    });

    const сводка = weekSummary(game);
    expect(сводка.done).toBe(2);
    expect(сводка.possible).toBe(7);
    expect(сводка.percent).toBe(29);
  });

  it('без привычек не делит на ноль', () => {
    expect(weekSummary(игра()).percent).toBe(0);
  });

  it('всегда возвращает семь дней, последний — сегодняшний', () => {
    const { days } = weekSummary(игра());
    expect(days).toHaveLength(7);
    expect(days[6].date).toBe(СЕГОДНЯ);
  });
});
