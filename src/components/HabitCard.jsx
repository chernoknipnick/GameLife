import { STATS, disciplineFor } from '../state/rules.js';
import { pluralDays } from '../state/day.js';
import { activeStreak, isDoneToday, xpFor } from '../state/selectors.js';
import { describeSchedule } from '../state/schedule.js';
import { ActionIcon, FlameIcon, GripIcon, PENCIL, TRASH } from './icons.jsx';

export default function HabitCard({
  game,
  habit,
  resting = false,
  draggable = false,
  dragging = false,
  onComplete,
  onUndo,
  onEdit,
  onDelete,
  onMove,
  onGrab,
}) {
  const stat = STATS[habit.stat];
  const done = isDoneToday(game, habit);
  const gain = xpFor(game, habit);

  /* Именно живая серия: habit.streak после пропуска дня остаётся прежним
     числом, и огонёк врал бы про серию, которой уже нет (FR-7.3). */
  const streakDays = activeStreak(game, habit);

  const план = describeSchedule(habit.schedule);

  /* Идентификатор в разметке нужен перетаскиванию: по нему Today.jsx
     узнаёт, над какой карточкой сейчас палец. */
  return (
    <li
      data-habit-id={habit.id}
      className={
        'habit' +
        (done ? ' habit--completed' : '') +
        (resting ? ' habit--resting' : '') +
        (dragging ? ' habit--dragging' : '')
      }
    >
      <div className="habit__row">
        <div className="habit__info">
          <p className="habit__title">{habit.title}</p>
          <p className="habit__tags">
            <span className={'chip chip--' + habit.stat}>{stat.label}</span>
            {/* У выполненной привычки обещание опыта бессмысленно —
                на его место встаёт слово «Готово». */}
            <span className="habit__gain">
              {done ? 'Готово' : '+' + gain + ' · +' + disciplineFor(gain) + ' ДИС'}
            </span>
            {/* Подпись только у привычек с расписанием: у ежедневной она
                была бы шумом на каждой карточке. */}
            {план && <span className="habit__schedule">{план}</span>}
          </p>
        </div>

        <div className="habit__actions">
          {/* FR-4.12. Ручка работает и указателем, и стрелками: тащить
              мышью или пальцем может не каждый, а порядок нужен всем.
              Клавиатурный путь здесь не запасной, а равноправный. */}
          {draggable && (
            <button
              type="button"
              className="habit__action habit__action--grip"
              aria-label={'Переместить привычку «' + habit.title + '», стрелками вверх и вниз'}
              onPointerDown={(event) => onGrab(event, habit)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                onMove(habit, event.key === 'ArrowUp' ? -1 : 1);
              }}
            >
              <GripIcon />
            </button>
          )}

          {streakDays > 0 && (
            <p className="pill pill--fire">
              <FlameIcon />
              <span aria-hidden="true">{streakDays}</span>
              <span className="visually-hidden">{pluralDays(streakDays)} подряд</span>
            </p>
          )}

          <button
            type="button"
            className="habit__action habit__action--edit"
            aria-label={'Изменить привычку «' + habit.title + '»'}
            onClick={() => onEdit(habit)}
          >
            <ActionIcon shape={PENCIL} />
          </button>

          <button
            type="button"
            className="habit__action habit__action--delete"
            aria-label={'Удалить привычку «' + habit.title + '»'}
            onClick={() => onDelete(habit)}
          >
            <ActionIcon shape={TRASH} />
          </button>
        </div>
      </div>

      {/* Отмена доступна в течение суток (FR-4.9). Подтверждения нет
          намеренно: оно сломало бы отметку в два действия.
          В незапланированный день кнопки нет вовсе: выполнять нечего. */}
      {!resting && (
        <button
          type="button"
          className={done ? 'btn btn--undo' : 'btn btn--done'}
          aria-label={
            (done ? 'Отменить выполнение привычки «' : 'Отметить выполненной привычку «') +
            habit.title +
            '»'
          }
          onClick={() => (done ? onUndo(habit.id) : onComplete(habit.id))}
        >
          {done ? 'Отменить' : 'Выполнено'}
        </button>
      )}
    </li>
  );
}
