import { humanDate, pluralDays } from '../state/day.js';

/* Будущие разделы показаны с пометкой релиза и помечены aria-disabled:
   они спроектированы в ТЗ, но притворяться работающими ссылками не должны.

   Пометка релиза — обещание, и врать в ней нельзя. «Настройки» до
   27.08.2026 стояли с меткой v0.2, хотя тот релиз уже вышел, а раздела
   не появилось. Содержимое настроек для v0.2 при этом сделано — сброс,
   выгрузка и загрузка живут внизу главного экрана; не хватало именно
   отдельного экрана. Метка исправлена на v0.4: раньше отдельного экрана
   не из чего делать, а в v0.4 навигация появится ради каталога, и тогда
   же понадобятся настройки аккаунта. */
export const SECTIONS = [
  { title: 'Каталог', release: 'v0.4', round: true },
  { title: 'Задачи', release: 'v0.5', round: false },
  { title: 'Цели и боссы', release: 'v0.5', round: true },
  { title: 'Прогресс', release: 'v0.6', round: false },
  { title: 'Настройки', release: 'v0.4', round: true },
];

export default function Sidebar({ streak, days, since }) {
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

      {/* Уголок статистики: серия и возраст персонажа (FR-7.7, FR-2.8).
          Дата создания вынесена в подпись, а не в отдельную строку —
          число дней отвечает на вопрос сразу, дата нужна изредка. */}
      <div className="sidebar__stats">
        <div className="sidebar__stat">
          <p className="sidebar__stat-label">Дней подряд</p>
          <p className="sidebar__stat-value">{pluralDays(streak)}</p>
        </div>

        <div className="sidebar__stat">
          <p className="sidebar__stat-label">В игре</p>
          <p className="sidebar__stat-value">{pluralDays(days)}</p>
          <p className="sidebar__stat-note">с {humanDate(since)}</p>
        </div>
      </div>
    </aside>
  );
}
