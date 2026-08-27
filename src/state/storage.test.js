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
