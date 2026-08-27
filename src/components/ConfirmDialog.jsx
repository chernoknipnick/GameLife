import { useEffect, useRef } from 'react';

/**
 * Подтверждение необратимого действия (FR-4.3, FR-15.1, FR-15.3, NFR-4.4).
 * Один диалог на все случаи: удаление привычки, сброс прогресса и замена
 * прогресса из файла ходят через него.
 */
export default function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  // Фокус на отмене: подтверждение необратимо, случайный Enter не должен его запускать.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal__card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 className="modal__title" id="confirm-title">
          {title}
        </h2>
        <p className="modal__text">{text}</p>
        <div className="modal__actions">
          <button className="btn btn--ghost" type="button" ref={cancelRef} onClick={onCancel}>
            Отмена
          </button>
          <button className="btn btn--danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
