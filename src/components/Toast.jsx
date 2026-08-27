import { useEffect } from 'react';

const VISIBLE_MS = 2600;

/**
 * Короткое сообщение об итоге действия (принцип 1.2 — мгновенная обратная связь).
 *
 * Ключом служит seq, а не текст: два одинаковых сообщения подряд должны
 * показаться дважды, и таймер для второго обязан начаться заново.
 */
export default function Toast({ toast, onHide }) {
  const seq = toast?.seq;

  useEffect(() => {
    if (seq === undefined) return undefined;

    const timer = setTimeout(() => onHide(seq), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [seq, onHide]);

  return (
    <p className="toast" role="status" aria-live="polite" hidden={!toast}>
      {toast ? toast.text : ''}
    </p>
  );
}
