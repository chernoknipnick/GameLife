import { humanDate, pluralDays } from '../state/day.js';

/* Будущие разделы показаны с пометкой релиза и помечены aria-disabled:
   они спроектированы в ТЗ, но притворяться работающими ссылками не должны.

   Пометка релиза — обещание, и врать в ней нельзя. «Настройки» дважды
   пережили обещанный релиз, не появившись: метка стояла сначала v0.2,
   потом v0.4. Теперь раздел есть, и в этом списке его больше нет.

   «Каталог» переехал с v0.4 на v0.5 решением Владимира 12.09.2026:
   каталог с голосованием — отдельная поверхность со своим экраном,
   правами и модерацией, и вместе с аккаунтами он сделал бы релиз из
   двух несвязанных половин. */
export const SECTIONS = [
  { title: 'Каталог', release: 'v0.5', round: true },
  { title: 'Задачи', release: 'v0.5', round: false },
  { title: 'Цели и боссы', release: 'v0.5', round: true },
  { title: 'Прогресс', release: 'v0.6', round: false },
];

/* Разделы, которые уже работают. Порядок тот же, что на экране. */
export const SCREENS = [
  { id: 'today', title: 'Панель', round: false },
  { id: 'settings', title: 'Настройки', round: true },
];

export default function Sidebar({ streak, days, since, screen, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true" />
        <span className="sidebar__name">GameLife</span>
      </div>

      <nav className="sidebar__nav" aria-label="Разделы">
        {SCREENS.map((item) => (
          <button
            type="button"
            className={'navitem' + (screen === item.id ? ' navitem--active' : '')}
            aria-current={screen === item.id ? 'page' : undefined}
            key={item.id}
            onClick={() => onNavigate(item.id)}
          >
            <span
              className={'navitem__mark' + (item.round ? ' navitem__mark--round' : '')}
              aria-hidden="true"
            />
            {item.title}
          </button>
        ))}

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
