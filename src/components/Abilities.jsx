import {
  ALL_STATS,
  STAT_LABELS,
  STAT_LEVEL_STEP,
  statLevel,
  statProgress,
} from '../state/rules.js';

function Ability({ statKey, xp }) {
  const level = statLevel(xp);
  const progress = statProgress(xp);
  const meta = STAT_LABELS[statKey];

  return (
    <li className={'ability ability--' + statKey}>
      <span className="ability__abbr">{meta.abbr}</span>
      <span className="ability__value">{level}</span>

      <span className="ability__track">
        <span className="ability__fill" style={{ width: progress + '%' }} />
      </span>

      {/* То же число, что и в подписи для скринридера, но видимое: голый
          уровень с полоской не отвечает на вопрос «сколько осталось». */}
      <span className="ability__hint">ещё {STAT_LEVEL_STEP - progress}</span>

      {/* Сокращение и голая цифра понятны глазом, но не на слух. */}
      <span className="visually-hidden">
        {meta.label}: уровень {level}, {xp} опыта, до следующего уровня {STAT_LEVEL_STEP - progress}
      </span>
    </li>
  );
}

export default function Abilities({ stats }) {
  return (
    <section className="abilities" aria-label="Характеристики">
      <ul className="abilities__grid">
        {ALL_STATS.map((key) => (
          <Ability statKey={key} xp={stats[key]} key={key} />
        ))}
      </ul>
    </section>
  );
}
