import { describe, expect, it } from 'vitest';
import {
  describeSchedule,
  isScheduledOn,
  nextScheduledDay,
  normalizeSchedule,
  previousScheduledDay,
} from './schedule.js';

/* 2026-08-31 — понедельник, 2026-09-01 — вторник, и так далее.
   Дни недели в наборе нумеруются как в Date.getDay(): 0 — воскресенье. */
const ПН = '2026-08-31';
const ВТ = '2026-09-01';
const СР = '2026-09-02';
const ЧТ = '2026-09-03';
const ПТ = '2026-09-04';
const СБ = '2026-09-05';
const ВС = '2026-09-06';

const ПНСРПТ = { type: 'weekdays', days: [1, 3, 5] };

describe('приведение расписания', () => {
  it('строка daily из старых сохранений понимается', () => {
    expect(normalizeSchedule('daily')).toEqual({ type: 'daily' });
  });

  it('мусор и пустота становятся ежедневным', () => {
    expect(normalizeSchedule(undefined)).toEqual({ type: 'daily' });
    expect(normalizeSchedule(null)).toEqual({ type: 'daily' });
    expect(normalizeSchedule({ type: 'колдовство' })).toEqual({ type: 'daily' });
  });

  it('пустой набор дней становится ежедневным', () => {
    // Привычка, которую нельзя выполнить никогда, — это поломка, а не расписание.
    expect(normalizeSchedule({ type: 'weekdays', days: [] })).toEqual({ type: 'daily' });
  });

  it('все семь дней — это и есть ежедневное', () => {
    expect(normalizeSchedule({ type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toEqual({
      type: 'daily',
    });
  });

  it('чистит повторы, мусор и порядок', () => {
    expect(normalizeSchedule({ type: 'weekdays', days: [5, 1, 1, 9, -2, 3, 'ср'] })).toEqual(
      ПНСРПТ
    );
  });
});

describe('запланирован ли день', () => {
  it('ежедневная запланирована всегда', () => {
    expect(isScheduledOn({ type: 'daily' }, ВТ)).toBe(true);
    expect(isScheduledOn('daily', ВС)).toBe(true);
  });

  it('понедельник-среда-пятница попадает только в свои дни', () => {
    expect([ПН, СР, ПТ].every((d) => isScheduledOn(ПНСРПТ, d))).toBe(true);
    expect([ВТ, ЧТ, СБ, ВС].some((d) => isScheduledOn(ПНСРПТ, d))).toBe(false);
  });
});

describe('шаг по расписанию', () => {
  it('у ежедневной это вчера и завтра', () => {
    expect(previousScheduledDay({ type: 'daily' }, ВТ)).toBe(ПН);
    expect(nextScheduledDay({ type: 'daily' }, ПН)).toBe(ВТ);
  });

  it('перед средой стоит понедельник, а не вторник', () => {
    expect(previousScheduledDay(ПНСРПТ, СР)).toBe(ПН);
    expect(nextScheduledDay(ПНСРПТ, ПН)).toBe(СР);
  });

  it('перед понедельником стоит пятница прошлой недели', () => {
    expect(previousScheduledDay(ПНСРПТ, ПН)).toBe('2026-08-28');
    expect(nextScheduledDay(ПНСРПТ, ПТ)).toBe('2026-09-07');
  });

  it('расписание из одного дня шагает через неделю', () => {
    const толькоВС = { type: 'weekdays', days: [0] };
    expect(previousScheduledDay(толькоВС, ВС)).toBe('2026-08-30');
    expect(nextScheduledDay(толькоВС, ВС)).toBe('2026-09-13');
  });

  it('шаг туда и обратно возвращает исходный день', () => {
    expect(previousScheduledDay(ПНСРПТ, nextScheduledDay(ПНСРПТ, СР))).toBe(СР);
  });
});

describe('подпись расписания', () => {
  it('у ежедневной подписи нет — она была бы шумом', () => {
    expect(describeSchedule({ type: 'daily' })).toBeNull();
  });

  it('дни перечисляются сокращениями', () => {
    expect(describeSchedule(ПНСРПТ)).toBe('Пн, Ср, Пт');
  });
});
