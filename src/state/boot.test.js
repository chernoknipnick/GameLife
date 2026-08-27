import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadState } from './storage.js';
import { initialReducerState, reducer } from './reducer.js';
import { createInitialState } from './schema.js';
import { STORAGE_KEY } from './rules.js';

/* Проверка стыка загрузки и редьюсера.
 *
 * Написана после того, как оба модуля разошлись именами: loadState
 * возвращал поле state, а initialReducerState ждал game. Каждый модуль
 * в отдельности был покрыт и зелен, приложение при этом не запускалось.
 * Такие ошибки ловятся только на границе. */

function хранилище(значение) {
  const данные = new Map();
  if (значение !== undefined) данные.set(STORAGE_KEY, значение);

  return {
    getItem: (ключ) => (данные.has(ключ) ? данные.get(ключ) : null),
    setItem: (ключ, значение) => данные.set(ключ, значение),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: хранилище() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('запуск приложения', () => {
  it('пустое хранилище даёт годное состояние и знакомство', () => {
    const state = initialReducerState(loadState());

    expect(state.game).toBeDefined();
    expect(state.game.history).toEqual([]);
    expect(state.isNewPlayer).toBe(true);
  });

  it('сохранённая игра поднимается без знакомства', () => {
    const сохранённое = createInitialState();
    сохранённое.character.name = 'Влад';
    vi.stubGlobal('window', { localStorage: хранилище(JSON.stringify(сохранённое)) });

    const state = initialReducerState(loadState());

    expect(state.game.character.name).toBe('Влад');
    expect(state.isNewPlayer).toBe(false);
  });

  it('непригодное сохранение не роняет запуск и оставляет предупреждение', () => {
    vi.stubGlobal('window', { localStorage: хранилище('{"version":1}') });

    const state = initialReducerState(loadState());

    expect(state.game.character).toBeDefined();
    expect(state.isNewPlayer).toBe(true);
    expect(state.pendingNotice).toContain('gamelife.backup');
  });

  it('поднятое состояние сразу принимает действия', () => {
    // Именно этого не хватало: собранное на запуске состояние должно
    // годиться редьюсеру без переименований.
    const state = initialReducerState(loadState());
    const стало = reducer(state, {
      type: 'add',
      title: 'Зарядка',
      stat: 'strength',
      difficulty: 'medium',
    });

    expect(стало.game.habits).toHaveLength(1);
  });
});
