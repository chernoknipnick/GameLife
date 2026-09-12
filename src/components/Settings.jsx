import { useRef } from 'react';
import { hasProgress } from '../state/selectors.js';
import { THEMES } from '../state/theme.js';

const ПОДПИСИ = { light: 'Светлая', dark: 'Тёмная' };

/* Настройки — первый экран приложения, кроме главного. Сюда переехало
   то, что с v0.2 висело внизу «Сегодня»: выгрузка, загрузка и сброс.
   Там они мешали — это не ежедневные действия, а редкие и опасные. */
export default function Settings({ game, onTheme, onExport, onImport, onReset, onBack }) {
  const fileRef = useRef(null);
  const theme = game.settings.theme;

  return (
    <main className="settings">
      <div className="settings__head">
        {/* Кнопка возврата нужна только там, где нет бокового меню. */}
        <button className="settings__back" type="button" onClick={onBack}>
          Назад
        </button>
        <h2 className="settings__title">Настройки</h2>
      </div>

      <section className="settings__block">
        <h3 className="settings__subtitle">Оформление</h3>

        {/* Две кнопки, а не выключатель: выключатель не говорит, какая
            тема сейчас включена, — только то, что он нажат (FR-15.4). */}
        <div className="themepick" role="group" aria-label="Тема оформления">
          {THEMES.map((value) => (
            <button
              key={value}
              type="button"
              className={'themepick__item' + (theme === value ? ' themepick__item--on' : '')}
              aria-pressed={theme === value}
              onClick={() => onTheme(value)}
            >
              {ПОДПИСИ[value]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__block">
        <h3 className="settings__subtitle">Данные</h3>
        <p className="settings__note">
          Прогресс хранится в этом браузере. Файл — единственный способ перенести его на другое
          устройство.
        </p>

        <div className="datarow">
          <button className="btn btn--data" type="button" onClick={onExport}>
            Выгрузить в файл
          </button>
          <button className="btn btn--data" type="button" onClick={() => fileRef.current?.click()}>
            Загрузить из файла
          </button>
        </div>

        <input
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="Файл с прогрессом"
          ref={fileRef}
          onChange={(event) => {
            const file = event.target.files[0];
            if (file) onImport(file);
            // Сброс значения: иначе повторный выбор того же файла не считается изменением.
            event.target.value = '';
          }}
        />
      </section>

      {/* Кнопка скрыта, пока сбрасывать нечего (FR-15.1). */}
      {hasProgress(game) && (
        <section className="settings__block">
          <h3 className="settings__subtitle">Опасное</h3>
          <button className="btn btn--reset" type="button" onClick={onReset}>
            Сбросить прогресс
          </button>
        </section>
      )}
    </main>
  );
}
