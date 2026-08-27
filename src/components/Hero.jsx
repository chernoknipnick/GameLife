import { DAILY_LIMIT, xpToNextLevel } from '../state/rules.js';
import { appStreak, xpToday } from '../state/selectors.js';
import { FlameIcon } from './icons.jsx';

export default function Hero({ game }) {
  const character = game.character;
  const need = xpToNextLevel(character.level);
  const percent = Math.round((character.xp / need) * 100);
  const streak = appStreak(game);

  return (
    <header className="hero">
      <div className="hero__top">
        <div className="hero__greeting">
          <p className="hero__hello">С возвращением</p>
          <p className="hero__name">{character.name}</p>
        </div>

        <div className="hero__badges">
          <p className="pill pill--streak" title="Дней подряд в приложении" hidden={streak === 0}>
            <FlameIcon />
            <span>{streak}</span>
          </p>

          <p className="avatar">
            <span className="avatar__shape" aria-hidden="true" />
            <span className="avatar__level">{character.level}</span>
            <span className="visually-hidden">Уровень {character.level}</span>
          </p>
        </div>
      </div>

      <div className="xp">
        <div className="xp__labels">
          <span className="xp__caption">ОПЫТ</span>
          <span className="xp__value">
            {character.xp} / {need}
          </span>
        </div>
        <div
          className="xp__track"
          role="progressbar"
          aria-label="Опыт до следующего уровня"
          aria-valuenow={character.xp}
          aria-valuemin={0}
          aria-valuemax={need}
        >
          <div className="xp__fill" style={{ width: percent + '%' }} />
        </div>
      </div>

      {/* Три числа под полоской: на десктопе места много, и одна полоска
          без цифр оставляет экран пустым. На узких экранах скрыты стилями. */}
      <ul className="herofacts">
        <li className="herofact">
          <span className="herofact__label">Осталось</span>
          <span className="herofact__value">{need - character.xp}</span>
        </li>
        <li className="herofact">
          <span className="herofact__label">Всего опыта</span>
          <span className="herofact__value">{character.totalXp}</span>
        </li>
        <li className="herofact">
          <span className="herofact__label">Сегодня</span>
          <span className="herofact__value">
            {xpToday(game)} / {DAILY_LIMIT}
          </span>
        </li>
      </ul>
    </header>
  );
}
