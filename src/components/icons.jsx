/* Иконки нарисованы вручную, а не подключены библиотекой: их четыре, и
   ради четырёх контуров зависимость не заводится (правило раздела 11). */

const FLAME = 'M5 .5C6.6 3 8.5 4 8.5 7A3.5 3.5 0 0 1 1.5 7c0-1.8 1.6-2.7 3.5-6.5z';

export const PENCIL =
  'M13.4 3.1a1.5 1.5 0 0 1 2.1 0l1.4 1.4a1.5 1.5 0 0 1 0 2.1L7.5 16.1 3.5 17l.9-4L13.4 3.1z';

export const TRASH =
  'M3 5.5h14M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 11a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9l.8-11';

/* Шесть точек — общепринятый знак «можно тащить». */
export function GripIcon() {
  return (
    <svg className="icon-action" viewBox="0 0 20 20" aria-hidden="true">
      {[6, 10, 14].map((y) =>
        [7, 13].map((x) => <circle cx={x} cy={y} r="1.4" fill="currentColor" key={x + '-' + y} />)
      )}
    </svg>
  );
}

export function FlameIcon() {
  return (
    <svg className="icon" viewBox="0 0 10 12" aria-hidden="true">
      <path d={FLAME} fill="currentColor" />
    </svg>
  );
}

/** Обе иконки действий рисуются одинаково и отличаются только контуром. */
export function ActionIcon({ shape }) {
  return (
    <svg className="icon-action" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={shape}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M1 5l2.6 2.6L9 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
