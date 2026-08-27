import { WEEKDAY_FULL, WEEKDAY_SHORT, weekdayIndex } from '../state/day.js';
import { today, weekSummary } from '../state/selectors.js';

export default function Week({ game }) {
  // Пустая неделя у нового игрока — семь серых столбиков без смысла.
  if (game.habits.length === 0 && game.history.length === 0) return null;

  const summary = weekSummary(game);
  const current = today(game);

  return (
    <section className="week" aria-labelledby="week-title">
      <div className="week__head">
        <h2 className="week__title" id="week-title">
          Неделя
        </h2>
        <p className="week__meta">
          Выполнено {summary.done} из {summary.possible} · {summary.percent}%
        </p>
      </div>

      <ol className="week__days">
        {summary.days.map((day) => {
          const share = day.possible > 0 ? day.done / day.possible : 0;
          const index = weekdayIndex(day.date);

          return (
            <li
              className={'week__day' + (day.date === current ? ' week__day--today' : '')}
              key={day.date}
            >
              {/* Столбец растёт снизу, поэтому заливка прижата к нижнему краю. */}
              <span className="week__track">
                <span className="week__fill" style={{ height: Math.round(share * 100) + '%' }} />
              </span>

              {/* Буквы дней понятны глазом, но не на слух: столбец без
                  подписи звучит как две буквы без числа. */}
              <span className="week__label" aria-hidden="true">
                {WEEKDAY_SHORT[index]}
              </span>
              <span className="visually-hidden">
                {WEEKDAY_FULL[index]}: выполнено {day.done} из {day.possible}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
