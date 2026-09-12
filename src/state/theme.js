/* Тема оформления (FR-15.4).

   Значений два — светлая и тёмная. Третьего, «как в системе», нет
   намеренно: ТЗ просит переключатель, а не три состояния, и «не
   выбрано» в сохранении пришлось бы разгадывать при каждом чтении.
   Системную настройку спрашиваем один раз — у нового игрока, когда
   выбирать ещё нечего и угадать вежливее, чем светить белым в темноте. */

export const THEMES = ['light', 'dark'];

export const DEFAULT_THEME = 'light';

/* Тёмная тема в системе. Всё завёрнуто в проверки: `matchMedia` нет ни
   в старых браузерах, ни в части тестовых окружений, а падать на
   запуске из-за оформления недопустимо. */
export function prefersDark() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function initialTheme() {
  return prefersDark() ? 'dark' : DEFAULT_THEME;
}

export function normalizeTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_THEME;
}

export function otherTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
