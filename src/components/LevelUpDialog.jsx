import { useEffect, useRef } from 'react';
import { xpToNextLevel } from '../state/rules.js';

/** Заметное уведомление о новом уровне (FR-2.6). */
export default function LevelUpDialog({ character, levelsGained, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal__card" role="dialog" aria-modal="true" aria-labelledby="levelup-title">
        <p className="modal__kicker">Новый уровень</p>
        <p className="modal__badge">{character.level}</p>
        <h2 className="modal__title" id="levelup-title">
          Уровень {character.level}
        </h2>
        <p className="modal__text">
          {levelsGained > 1 ? 'Взято уровней за раз: ' + levelsGained + '. ' : ''}
          Остаток опыта перенесён: {character.xp} из {xpToNextLevel(character.level)} до следующего.
        </p>
        <button
          className="btn btn--primary btn--modal"
          type="button"
          ref={closeRef}
          onClick={onClose}
        >
          Отлично
        </button>
      </div>
    </div>
  );
}
