/**
 * @vitest-environment jsdom
 */

/* Тест, поднимающий приложение целиком.
 *
 * Заведён после двух случаев, когда зелёная сборка ничего не значила:
 * сначала loadState и редьюсер разошлись именами полей, потом не
 * подставился импорт daysInGame. Оба раза модульные тесты проходили,
 * сборка проходила, а приложение не запускалось — белый экран. Бандлер
 * не проверяет, что имя существует, а модульные тесты не трогают App.
 *
 * Здесь проверяется не поведение — оно покрыто модульными тестами, — а
 * то, что всё вместе собирается и живёт. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';
import { createInitialState } from './state/schema.js';
import { STORAGE_KEY } from './state/rules.js';
import { todayKey } from './state/day.js';

function посадить(изменения) {
  const game = { ...createInitialState(), ...изменения };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  return game;
}

function привычка(o = {}) {
  return {
    id: 'h1',
    title: 'Зарядка',
    stat: 'strength',
    difficulty: 'medium',
    schedule: 'daily',
    streak: 0,
    bestStreak: 0,
    lastDone: null,
    createdAt: todayKey(4),
    archived: false,
    ...o,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe('приложение поднимается', () => {
  it('без сохранения показывает знакомство', () => {
    render(<App />);

    expect(screen.getByText('Реальные дела — игровой прогресс')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Начать' })).toBeTruthy();
  });

  it('с сохранением рисует персонажа и привычки', () => {
    посадить({
      habits: [привычка()],
      character: { ...createInitialState().character, name: 'Влад' },
    });

    render(<App />);

    expect(screen.getByText('Влад')).toBeTruthy();
    expect(screen.getByText('Зарядка')).toBeTruthy();
    // Знакомство не должно возвращаться к игроку с прогрессом.
    expect(screen.queryByText('Реальные дела — игровой прогресс')).toBeNull();
  });

  it('рисует все главные блоки разом', () => {
    /* Именно этого не хватало: любой из блоков мог сломаться на импорте
       и уронить всё дерево, а модульные тесты этого не видят. */
    посадить({ habits: [привычка()] });

    render(<App />);

    /* Именно заголовки, а не любой текст: «Сегодня» есть ещё и подписью
       к дневному счёту в шапке персонажа. */
    expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Неделя' })).toBeTruthy();
    expect(screen.getByLabelText('Характеристики')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Добавить привычку' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Выгрузить в файл' })).toBeTruthy();
  });
});

describe('живые действия', () => {
  it('выполнение меняет экран и уходит в хранилище', () => {
    посадить({ habits: [привычка()] });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Отметить выполненной/ }));

    expect(screen.getByRole('button', { name: /Отменить выполнение/ })).toBeTruthy();

    const сохранено = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(сохранено.character.stats.strength).toBe(25);
    expect(сохранено.history).toHaveLength(1);
  });

  it('отмена возвращает экран и хранилище назад', () => {
    посадить({ habits: [привычка()] });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Отметить выполненной/ }));
    fireEvent.click(screen.getByRole('button', { name: /Отменить выполнение/ }));

    expect(screen.getByRole('button', { name: /Отметить выполненной/ })).toBeTruthy();

    const сохранено = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(сохранено.character.stats.strength).toBe(0);
    expect(сохранено.history).toHaveLength(0);
  });

  it('лист правки открывается с подставленными значениями', () => {
    посадить({ habits: [привычка({ title: 'Бег' })] });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Изменить привычку/ }));

    expect(screen.getByLabelText('Название').value).toBe('Бег');
    expect(screen.getByText('Изменить привычку')).toBeTruthy();
  });

  it('удаление спрашивает подтверждение, а отказ ничего не меняет', () => {
    посадить({ habits: [привычка()] });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Удалить привычку/ }));

    expect(screen.getByText('Удалить привычку?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(screen.getByText('Зарядка')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).habits).toHaveLength(1);
  });
});

describe('непригодное сохранение', () => {
  it('не роняет приложение и уводит копию в запасной ключ', () => {
    // Тот самый огрызок, который раньше ронял отрисовку при каждой загрузке.
    window.localStorage.setItem(STORAGE_KEY, '{"version":1}');

    render(<App />);

    expect(screen.getByText('Реальные дела — игровой прогресс')).toBeTruthy();
    expect(window.localStorage.getItem('gamelife.backup')).toBe('{"version":1}');
  });
});
