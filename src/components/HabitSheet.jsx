import { useEffect, useRef, useState } from 'react';
import {
  DIFFICULTY,
  MAX_TITLE_LENGTH,
  STATS,
  disciplineFor,
  streakMultiplier,
} from '../state/rules.js';
import { activeStreak, findHabit } from '../state/selectors.js';
import { normalizeSchedule } from '../state/schedule.js';
import { WEEKDAY_SHORT } from '../state/day.js';

function Choice({ id, selected, label, extra, onPick }) {
  /* Из двух отдельных строк («+25» и «Средняя») складывается невнятное
     имя кнопки, поэтому задаём его явно. */
  return (
    <button
      type="button"
      className={'choice choice--' + id}
      role="radio"
      aria-checked={selected}
      aria-label={extra ? label + ', ' + extra + ' опыта' : undefined}
      onClick={() => onPick(id)}
    >
      {extra ? (
        <>
          <span className="choice__xp">{extra}</span>
          <span className="choice__label">{label}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}

/**
 * Лист создания и правки. С привычкой открывается на правку, без неё —
 * на создание; признак хранится в draft.id (FR-4.2, FR-4.8).
 */
export default function HabitSheet({ game, habit, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    id: habit ? habit.id : null,
    title: habit ? habit.title : '',
    stat: habit ? habit.stat : 'strength',
    difficulty: habit ? habit.difficulty : 'medium',
    schedule: normalizeSchedule(habit ? habit.schedule : undefined),
  }));

  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  /* У новой привычки серии нет, поэтому множитель равен единице. При
     правке считаем по живой серии — иначе лист обещал бы одно число, а
     карточка в списке показывала другое. */
  const edited = draft.id ? findHabit(game, draft.id) : null;
  const base = DIFFICULTY[draft.difficulty].xp;
  const xp = edited ? Math.round(base * streakMultiplier(activeStreak(game, edited))) : base;

  const set = (key) => (value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="sheet" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <span className="sheet__grabber" aria-hidden="true" />
        <h2 className="sheet__title" id="sheet-title">
          {habit ? 'Изменить привычку' : 'Новая привычка'}
        </h2>

        <div className="field">
          <label className="field__label" htmlFor="habit-title">
            Название
          </label>
          <input
            className="field__input"
            id="habit-title"
            type="text"
            maxLength={MAX_TITLE_LENGTH}
            autoComplete="off"
            placeholder="Например, зарядка 10 минут"
            ref={titleRef}
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            onKeyDown={(event) => event.key === 'Enter' && onSave(draft)}
          />
        </div>

        <div className="field">
          <p className="field__label" id="stat-label">
            Характеристика
          </p>
          <div className="choices" role="radiogroup" aria-labelledby="stat-label">
            {Object.keys(STATS).map((key) => (
              <Choice
                key={key}
                id={key}
                selected={draft.stat === key}
                label={STATS[key].label}
                onPick={set('stat')}
              />
            ))}
          </div>
          <p className="field__hint">Дисциплина растёт с любой привычки — выбирать её не нужно</p>
        </div>

        <div className="field">
          <p className="field__label" id="diff-label">
            Сложность
          </p>
          <div className="choices" role="radiogroup" aria-labelledby="diff-label">
            {Object.keys(DIFFICULTY).map((key) => (
              <Choice
                key={key}
                id={key}
                selected={draft.difficulty === key}
                label={DIFFICULTY[key].label}
                extra={'+' + DIFFICULTY[key].xp}
                onPick={set('difficulty')}
              />
            ))}
          </div>
        </div>

        {/* FR-4.10. Дни недели идут с понедельника, а не с воскресенья,
            как в Date.getDay(): в календаре так привычнее. Номера при
            этом остаются те же. */}
        <div className="field">
          <p className="field__label" id="schedule-label">
            Когда
          </p>
          <div className="choices" role="radiogroup" aria-labelledby="schedule-label">
            <button
              type="button"
              className="choice"
              role="radio"
              aria-checked={draft.schedule.type === 'daily'}
              onClick={() => setDraft((prev) => ({ ...prev, schedule: { type: 'daily' } }))}
            >
              Каждый день
            </button>
            <button
              type="button"
              className="choice"
              role="radio"
              aria-checked={draft.schedule.type === 'weekdays'}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  schedule:
                    prev.schedule.type === 'weekdays'
                      ? prev.schedule
                      : { type: 'weekdays', days: [1, 3, 5] },
                }))
              }
            >
              По дням недели
            </button>
          </div>

          {draft.schedule.type === 'weekdays' && (
            <div className="weekdays" role="group" aria-label="Дни недели">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const выбран = draft.schedule.days.includes(day);

                return (
                  <button
                    type="button"
                    className={'weekday' + (выбран ? ' weekday--on' : '')}
                    aria-pressed={выбран}
                    aria-label={WEEKDAY_SHORT[day]}
                    key={day}
                    onClick={() =>
                      setDraft((prev) => {
                        const дни = prev.schedule.days.includes(day)
                          ? prev.schedule.days.filter((d) => d !== day)
                          : [...prev.schedule.days, day];

                        /* Снять последний день нельзя: привычка, которую
                           никогда не выполнить, — это не расписание. */
                        if (дни.length === 0) return prev;
                        return { ...prev, schedule: { type: 'weekdays', days: дни.sort() } };
                      })
                    }
                  >
                    {WEEKDAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="preview">
          <div className="preview__card preview__card--xp">
            <p className="preview__label">Опыт за выполнение</p>
            <p className="preview__value">+{xp}</p>
          </div>
          <div className="preview__card">
            <p className="preview__label">Дисциплина</p>
            <p className="preview__value">+{disciplineFor(xp)}</p>
          </div>
        </div>

        <div className="sheet__actions">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn--primary" type="button" onClick={() => onSave(draft)}>
            {habit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
