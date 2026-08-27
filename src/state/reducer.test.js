import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from './schema.js';
import { initialReducerState, reducer } from './reducer.js';

const СЕГОДНЯ = '2026-08-27';
const ВЧЕРА = '2026-08-26';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 27, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/* Рекорд по умолчанию равен серии: привычка с серией 9 и рекордом 0 —
   состояние, которого игра не порождает, и проверка на нём мерила бы не
   поведение, а несогласованность входных данных. */
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

function старт(изменения = {}) {
  const game = { ...createInitialState(), ...изменения };
  return initialReducerState({ game, isNewPlayer: false, notice: null });
}

describe('выполнение привычки', () => {
  it('начисляет опыт в характеристику и дисциплину', () => {
    const было = старт({ habits: [привычка()] });
    const стало = reducer(было, { type: 'complete', id: 'h1' });

    expect(стало.game.character.stats.strength).toBe(25);
    expect(стало.game.character.stats.discipline).toBe(8);
    expect(стало.game.history).toHaveLength(1);
  });

  it('не меняет прежнее состояние', () => {
    // Копия, а не правка на месте: React сравнивает ссылки.
    const было = старт({ habits: [привычка()] });
    reducer(было, { type: 'complete', id: 'h1' });

    expect(было.game.character.stats.strength).toBe(0);
    expect(было.game.history).toHaveLength(0);
  });

  it('второй раз за сутки не начисляет', () => {
    const было = старт({ habits: [привычка()] });
    const один = reducer(было, { type: 'complete', id: 'h1' });
    const два = reducer(один, { type: 'complete', id: 'h1' });

    expect(два).toBe(один);
  });

  it('множитель считается по серии до начисления', () => {
    // Серия 3 при вчерашнем выполнении: 25 × 1.1 = 27.5 → 28.
    const было = старт({
      habits: [привычка({ streak: 3, lastDone: ВЧЕРА })],
      history: [{ date: ВЧЕРА, habitId: 'h1', xp: 25 }],
    });
    const стало = reducer(было, { type: 'complete', id: 'h1' });

    expect(стало.game.character.stats.strength).toBe(28);
    expect(стало.game.habits[0].streak).toBe(4);
  });

  it('оборванная серия множителя не даёт и сбрасывается до единицы', () => {
    const было = старт({ habits: [привычка({ streak: 9, lastDone: '2026-08-20' })] });
    const стало = reducer(было, { type: 'complete', id: 'h1' });

    expect(стало.game.character.stats.strength).toBe(25);
    expect(стало.game.habits[0].streak).toBe(1);
    expect(стало.game.habits[0].bestStreak).toBe(9);
  });

  it('дневной лимит блокирует и ничего не отнимает', () => {
    const было = старт({
      habits: [привычка({ difficulty: 'hard' })],
      history: [{ date: СЕГОДНЯ, habitId: 'z', xp: 470 }],
    });
    const стало = reducer(было, { type: 'complete', id: 'h1' });

    expect(стало.game).toBe(было.game);
    expect(стало.toast.text).toContain('лимит');
  });
});

describe('уровни', () => {
  it('остаток опыта переносится на следующий уровень', () => {
    const было = старт({ habits: [привычка({ difficulty: 'hard' })] });
    было.game.character.xp = 80;

    const стало = reducer(было, { type: 'complete', id: 'h1' });

    expect(стало.game.character.level).toBe(2);
    expect(стало.game.character.xp).toBe(30);
    expect(стало.levelUp).toBe(1);
  });
});

describe('отмена выполнения', () => {
  it('возвращает всё к значениям до выполнения', () => {
    const было = старт({ habits: [привычка()] });
    const выполнено = reducer(было, { type: 'complete', id: 'h1' });
    const отменено = reducer(выполнено, { type: 'undo', id: 'h1' });

    expect(отменено.game.character).toEqual(было.game.character);
    expect(отменено.game.history).toHaveLength(0);
  });

  it('снимает уровень точной обратной операцией', () => {
    const было = старт({ habits: [привычка({ difficulty: 'hard' })] });
    было.game.character.xp = 80;

    const выполнено = reducer(было, { type: 'complete', id: 'h1' });
    const отменено = reducer(выполнено, { type: 'undo', id: 'h1' });

    expect(отменено.game.character.level).toBe(1);
    expect(отменено.game.character.xp).toBe(80);
  });

  it('снимает ровно тот опыт, что был начислен', () => {
    /* Записи начислены по прежнему множителю. Пересчёт по текущей формуле
       снял бы другое число — берём из истории. */
    const было = старт({
      habits: [привычка({ streak: 6, lastDone: ВЧЕРА })],
      history: [{ date: ВЧЕРА, habitId: 'h1', xp: 25 }],
    });

    const выполнено = reducer(было, { type: 'complete', id: 'h1' });
    expect(выполнено.game.character.stats.strength).toBe(28);

    const отменено = reducer(выполнено, { type: 'undo', id: 'h1' });
    expect(отменено.game.character.stats.strength).toBe(0);
  });

  it('восстанавливает серию по истории, а не вычитанием единицы', () => {
    /* Последний раз привычка была выполнена три дня назад, поэтому
       выполнение сегодня сбросило серию до 1. Вычитание вернуло бы
       lastDone на вчера — то есть соврало бы. */
    const было = старт({
      habits: [привычка({ streak: 3, lastDone: '2026-08-24' })],
      history: [
        { date: '2026-08-22', habitId: 'h1', xp: 25 },
        { date: '2026-08-23', habitId: 'h1', xp: 25 },
        { date: '2026-08-24', habitId: 'h1', xp: 25 },
      ],
    });

    const выполнено = reducer(было, { type: 'complete', id: 'h1' });
    expect(выполнено.game.habits[0].streak).toBe(1);

    const отменено = reducer(выполнено, { type: 'undo', id: 'h1' });
    expect(отменено.game.habits[0].lastDone).toBe('2026-08-24');
    expect(отменено.game.habits[0].streak).toBe(3);
  });

  it('восстанавливает рекорд, если отменяемый день его поставил', () => {
    const было = старт({
      habits: [привычка({ streak: 2, bestStreak: 2, lastDone: ВЧЕРА })],
      history: [
        { date: '2026-08-25', habitId: 'h1', xp: 25 },
        { date: ВЧЕРА, habitId: 'h1', xp: 25 },
      ],
    });

    const выполнено = reducer(было, { type: 'complete', id: 'h1' });
    expect(выполнено.game.habits[0].bestStreak).toBe(3);

    const отменено = reducer(выполнено, { type: 'undo', id: 'h1' });
    expect(отменено.game.habits[0].bestStreak).toBe(2);
  });

  it('вчерашнее выполнение отменить нельзя', () => {
    const было = старт({
      habits: [привычка({ streak: 1, lastDone: ВЧЕРА })],
      history: [{ date: ВЧЕРА, habitId: 'h1', xp: 25 }],
    });

    expect(reducer(было, { type: 'undo', id: 'h1' })).toBe(было);
  });
});

describe('привычки', () => {
  it('не создаёт привычку без названия', () => {
    const было = старт();
    const стало = reducer(было, { type: 'add', title: '   ', stat: 'strength', difficulty: 'easy' });

    expect(стало.game.habits).toHaveLength(0);
    expect(стало.toast.text).toBe('Введите название привычки');
  });

  it('не пускает двадцать первую привычку', () => {
    const habits = [];
    for (let i = 0; i < 20; i += 1) habits.push(привычка({ id: 'h' + i }));

    const было = старт({ habits });
    const стало = reducer(было, {
      type: 'add',
      title: 'Лишняя',
      stat: 'strength',
      difficulty: 'easy',
    });

    expect(стало.game.habits).toHaveLength(20);
  });

  it('правка не трогает историю, характеристики, серию и рекорд', () => {
    const было = старт({
      habits: [привычка({ streak: 3, bestStreak: 5, lastDone: ВЧЕРА, difficulty: 'hard' })],
      history: [{ date: ВЧЕРА, habitId: 'h1', xp: 50 }],
    });
    было.game.character.stats.strength = 50;

    const стало = reducer(было, {
      type: 'update',
      id: 'h1',
      title: 'Другое имя',
      stat: 'health',
      difficulty: 'easy',
    });

    expect(стало.game.habits[0].title).toBe('Другое имя');
    expect(стало.game.habits[0].streak).toBe(3);
    expect(стало.game.habits[0].bestStreak).toBe(5);
    expect(стало.game.history).toEqual(было.game.history);
    expect(стало.game.character.stats).toEqual(было.game.character.stats);
  });

  it('удаление оставляет записи истории на месте', () => {
    const было = старт({
      habits: [привычка()],
      history: [{ date: ВЧЕРА, habitId: 'h1', xp: 25 }],
    });
    const стало = reducer(было, { type: 'remove', id: 'h1' });

    expect(стало.game.habits).toHaveLength(0);
    expect(стало.game.history).toHaveLength(1);
  });
});

describe('сброс и загрузка', () => {
  it('сброс возвращает к началу и снова показывает знакомство', () => {
    const было = старт({ habits: [привычка()] });
    было.game.character.level = 5;

    const стало = reducer(было, { type: 'reset' });

    expect(стало.game.character.level).toBe(1);
    expect(стало.game.habits).toHaveLength(0);
    expect(стало.isNewPlayer).toBe(true);
  });

  it('загрузка из файла заменяет состояние целиком', () => {
    const было = старт({ habits: [привычка()] });
    const файл = { ...createInitialState(), character: { ...createInitialState().character, name: 'Из файла' } };

    const стало = reducer(было, { type: 'replace', game: файл });

    expect(стало.game.character.name).toBe('Из файла');
    expect(стало.game.habits).toHaveLength(0);
  });
});
