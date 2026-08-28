import { describe, expect, it } from 'vitest';
import { parseState, looksLikeState, normalizeState } from './storage.js';
import { createInitialState } from './schema.js';

function целое() {
  const game = createInitialState();
  game.character.name = 'Тестер';
  return game;
}

describe('разбор сохранения', () => {
  it('принимает целое сохранение', () => {
    const { state, error } = parseState(JSON.stringify(целое()));
    expect(error).toBeUndefined();
    expect(state.character.name).toBe('Тестер');
  });

  it('отклоняет неразбираемый текст', () => {
    expect(parseState('это не json').error).toBe('unparsable');
  });

  it('отклоняет чужую версию схемы', () => {
    const чужое = { ...целое(), version: 42 };
    expect(parseState(JSON.stringify(чужое)).error).toBe('version');
  });

  it('отклоняет синтаксически верный огрызок', () => {
    // Тот самый случай, который раньше ронял приложение при каждой загрузке.
    expect(parseState('{"version":1}').error).toBe('shape');
  });
});

describe('проверка формы', () => {
  it('требует персонажа с числовыми уровнем и опытом', () => {
    const без = целое();
    без.character.level = 'пять';
    expect(looksLikeState(без)).toBe(false);
  });

  it('требует все четыре характеристики', () => {
    const без = целое();
    delete без.character.stats.discipline;
    expect(looksLikeState(без)).toBe(false);
  });

  it('требует массивы привычек и истории', () => {
    const без = целое();
    без.history = null;
    expect(looksLikeState(без)).toBe(false);
  });
});

describe('починка мелочей', () => {
  it('отбрасывает привычку с неизвестной характеристикой', () => {
    const game = целое();
    game.habits = [
      { title: 'Годная', stat: 'strength', difficulty: 'medium' },
      { title: 'Магия', stat: 'магия', difficulty: 'medium' },
      { title: 'Сложность', stat: 'strength', difficulty: 'невозможная' },
    ];

    expect(normalizeState(game).habits.map((h) => h.title)).toEqual(['Годная']);
  });

  it('чинит мусорный час смены суток', () => {
    const game = целое();
    game.settings.dayResetHour = 99;
    expect(normalizeState(game).settings.dayResetHour).toBe(4);
  });

  it('возвращает имя по умолчанию вместо пустого', () => {
    const game = целое();
    game.character.name = '   ';
    expect(normalizeState(game).character.name).toBe('Герой');
  });

  it('сверяет серию с историей: lastDone из файла не верится на слово', () => {
    /* Тот самый дефект, что нашла приёмка v0.3. В файле история знает про
       выполнение, а lastDone пуст — привычка считалась невыполненной и
       выполнялась второй раз за сутки, а сводка показывала больше 100%. */
    const game = целое();
    game.habits = [
      {
        id: 'a',
        title: 'Бег',
        stat: 'strength',
        difficulty: 'medium',
        lastDone: null,
        streak: 0,
        bestStreak: 0,
      },
    ];
    game.history = [
      { date: '2026-08-25', habitId: 'a', xp: 25 },
      { date: '2026-08-26', habitId: 'a', xp: 25 },
    ];

    const habit = normalizeState(game).habits[0];

    expect(habit.lastDone).toBe('2026-08-26');
    expect(habit.streak).toBe(2);
    expect(habit.bestStreak).toBe(2);
  });

  it('обнуляет серию привычки, которой нет в истории', () => {
    const game = целое();
    game.habits = [
      {
        id: 'a',
        title: 'Бег',
        stat: 'strength',
        difficulty: 'medium',
        lastDone: '2026-08-26',
        streak: 9,
        bestStreak: 9,
      },
    ];
    game.history = [];

    const habit = normalizeState(game).habits[0];

    expect(habit.lastDone).toBeNull();
    expect(habit.streak).toBe(0);
    expect(habit.bestStreak).toBe(0);
  });

  it('рекорд берётся из самого длинного отрезка, а не из последнего', () => {
    const game = целое();
    game.habits = [
      {
        id: 'a',
        title: 'Бег',
        stat: 'strength',
        difficulty: 'medium',
        lastDone: null,
        streak: 0,
        bestStreak: 0,
      },
    ];
    // Три дня подряд, пропуск, потом один день.
    game.history = [
      { date: '2026-08-20', habitId: 'a', xp: 25 },
      { date: '2026-08-21', habitId: 'a', xp: 25 },
      { date: '2026-08-22', habitId: 'a', xp: 25 },
      { date: '2026-08-26', habitId: 'a', xp: 25 },
    ];

    const habit = normalizeState(game).habits[0];

    expect(habit.streak).toBe(1);
    expect(habit.bestStreak).toBe(3);
  });

  it('рекорд тоже пересчитывается, а не берётся из сохранения на веру', () => {
    /* Изменение поведения: раньше bestStreak из сохранения принимался как
       есть. Теперь он считается из истории, и записанные 5 при двух
       записях не переживают чтения — такого прогресса в истории нет.
       Для согласованных данных пересчёт даёт то же число. */
    const game = целое();
    game.habits = [
      {
        id: 'a',
        title: 'Бег',
        stat: 'strength',
        difficulty: 'medium',
        lastDone: '2026-08-26',
        streak: 2,
        bestStreak: 5,
      },
    ];
    game.history = [
      { date: '2026-08-25', habitId: 'a', xp: 25 },
      { date: '2026-08-26', habitId: 'a', xp: 25 },
    ];

    const habit = normalizeState(game).habits[0];

    expect(habit.lastDone).toBe('2026-08-26');
    expect(habit.streak).toBe(2);
    expect(habit.bestStreak).toBe(2);
  });

  it('выбрасывает записи истории без даты или опыта', () => {
    const game = целое();
    game.history = [
      { date: '2026-08-27', habitId: 'a', xp: 25 },
      { date: '2026-08-27', habitId: 'b' },
      { habitId: 'c', xp: 10 },
    ];

    expect(normalizeState(game).history).toHaveLength(1);
  });
});
