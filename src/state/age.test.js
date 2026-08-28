import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysBetween, humanDate } from './day.js';
import { daysInGame } from './selectors.js';
import { createInitialState } from './schema.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 27, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('разница в днях', () => {
  it('одинаковые сутки дают ноль', () => {
    expect(daysBetween('2026-08-27', '2026-08-27')).toBe(0);
  });

  it('считает через границу месяца', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
  });

  it('считает через границу года', () => {
    expect(daysBetween('2026-12-25', '2027-01-05')).toBe(11);
  });

  it('переход на летнее время не сдвигает счёт', () => {
    /* Ради этого расчёт идёт от полудня: на границе суток час перевода
       съедал бы или добавлял день. */
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2);
    expect(daysBetween('2027-10-30', '2027-11-01')).toBe(2);
  });

  it('обратный порядок даёт отрицательное число', () => {
    expect(daysBetween('2026-08-27', '2026-08-20')).toBe(-7);
  });
});

describe('дней в игре', () => {
  function игра(createdAt) {
    const game = createInitialState();
    game.character.createdAt = createdAt;
    return game;
  }

  it('день создания считается первым, а не нулевым', () => {
    expect(daysInGame(игра('2026-08-27'))).toBe(1);
  });

  it('неделя назад — восьмой день', () => {
    expect(daysInGame(игра('2026-08-20'))).toBe(8);
  });

  it('дата из будущего не даёт ноль или отрицательное', () => {
    // Сохранение могли принести из другого часового пояса.
    expect(daysInGame(игра('2026-09-10'))).toBe(1);
  });

  it('без даты создания не падает', () => {
    const game = createInitialState();
    delete game.character.createdAt;
    expect(daysInGame(game)).toBe(1);
  });
});

describe('человеческая дата', () => {
  it.each([
    ['2026-08-27', '27 августа 2026'],
    ['2026-01-01', '1 января 2026'],
    ['2026-12-31', '31 декабря 2026'],
    ['2026-05-09', '9 мая 2026'],
  ])('%s → %s', (key, expected) => {
    expect(humanDate(key)).toBe(expected);
  });
});
