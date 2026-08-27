import { pluralDays } from '../state/day.js';

/* Будущие разделы показаны с пометкой релиза и помечены aria-disabled:
   они спроектированы в ТЗ, но притворяться работающими ссылками не должны. */
const SECTIONS = [
  { title: 'Каталог', release: 'v0.4', round: true },
  { title: 'Задачи', release: 'v0.5', round: false },
  { title: 'Цели и боссы', release: 'v0.5', round: true },
  { title: 'Прогресс', release: 'v0.6', round: false },
  { title: 'Настройки', release: 'v0.2', round: true },
];

export default function Sidebar({ streak }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true" />
        <span className="sidebar__name">GameLife</span>
      </div>

      <nav className="sidebar__nav" aria-label="Разделы">
        <span className="navitem navitem--active" aria-current="page">
          <span className="navitem__mark" aria-hidden="true" />
          Панель
        </span>

        {SECTIONS.map((section) => (
          <span className="navitem" aria-disabled="true" key={section.title}>
            <span
              className={'navitem__mark' + (section.round ? ' navitem__mark--round' : '')}
              aria-hidden="true"
            />
            {section.title}
            <span className="navitem__tag">{section.release}</span>
          </span>
        ))}
      </nav>

      <p className="sidebar__note">
        Разделы с пометкой релиза спроектированы в техническом задании и появятся позже.
      </p>

      <div className="sidebar__streak">
        <p className="sidebar__streak-label">Дней подряд</p>
        <p className="sidebar__streak-value">{pluralDays(streak)}</p>
      </div>
    </aside>
  );
}
