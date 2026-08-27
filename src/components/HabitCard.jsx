import { STATS, disciplineFor } from '../state/rules.js';
import { pluralDays } from '../state/day.js';
import { activeStreak, isDoneToday, xpFor } from '../state/selectors.js';
import { ActionIcon, FlameIcon, PENCIL, TRASH } from './icons.jsx';

export default function HabitCard({ game, habit, onComplete, onUndo, onEdit, onDelete }) {
  const stat = STATS[habit.stat];
  const done = isDoneToday(game, habit);
  const gain = xpFor(game, habit);

  /* Именно живая серия: habit.streak после пропуска дня остаётся прежним
     числом, и огонёк врал бы про серию, которой уже нет (FR-7.3). */
  const streakDays = activeStreak(game, habit);

  return (
    <li className={'habit' + (done ? ' habit--completed' : '')}>
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
          </p>
        </div>

        <div className="habit__actions">
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
          намеренно: оно сломало бы отметку в два действия. */}
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
    </li>
  );
}
