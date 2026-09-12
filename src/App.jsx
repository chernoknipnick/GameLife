import { useCallback, useEffect, useReducer, useState } from 'react';
import { initialReducerState, reducer } from './state/reducer.js';
import { loadState, saveState } from './state/storage.js';
import { exportGame, readGameFile } from './state/data.js';
import { appStreak, activeStreak, daysInGame } from './state/selectors.js';
import Sidebar from './components/Sidebar.jsx';
import Hero from './components/Hero.jsx';
import Abilities from './components/Abilities.jsx';
import Today from './components/Today.jsx';
import HabitSheet from './components/HabitSheet.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import LevelUpDialog from './components/LevelUpDialog.jsx';
import Onboarding from './components/Onboarding.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialReducerState(loadState()));

  /* Лист и подтверждение — состояние интерфейса, а не игры: в
     сохранение им попадать незачем, поэтому живут здесь. */
  const [sheet, setSheet] = useState(null); // {habit} или {habit: null} на создание
  const [confirm, setConfirm] = useState(null);

  const { game, isNewPlayer, levelUp, toast } = state;

  // Сохраняем при каждом изменении игрового состояния — и только его.
  useEffect(() => {
    saveState(game);
  }, [game]);

  /* Предупреждение о непригодном сохранении ждёт, пока освободится
     экран: во время знакомства всплывающую подсказку не видно. */
  useEffect(() => {
    if (state.pendingNotice && !isNewPlayer) dispatch({ type: 'flushNotice' });
  }, [state.pendingNotice, isNewPlayer]);

  /* Escape закрывает то, что открыто сверху: сначала подтверждение,
     потом лист, потом окно уровня. */
  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'Escape') return;
      if (confirm) setConfirm(null);
      else if (sheet) setSheet(null);
      else if (levelUp) dispatch({ type: 'dismissLevelUp' });
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirm, sheet, levelUp]);

  const hideToast = useCallback((seq) => dispatch({ type: 'clearToast', seq }), []);

  function saveDraft(draft) {
    dispatch(draft.id ? { type: 'update', ...draft } : { type: 'add', ...draft });
    // Пустое название лист не закрывает: человек должен увидеть, что ввести.
    if (draft.title.trim()) setSheet(null);
  }

  function askDelete(habit) {
    const streak = activeStreak(game, habit);

    setConfirm({
      title: 'Удалить привычку?',
      text:
        'Привычка «' +
        habit.title +
        '» исчезнет из списка' +
        (streak > 0 ? ', серия в ' + streak + ' дн. будет потеряна' : '') +
        '. Опыт и уровень персонажа останутся при вас.',
      confirmLabel: 'Удалить',
      run: () => dispatch({ type: 'remove', id: habit.id }),
    });
  }

  function askReset() {
    setConfirm({
      title: 'Сбросить весь прогресс?',
      text: 'Персонаж вернётся на первый уровень, характеристики обнулятся, привычки и история выполнений будут удалены. Отменить это будет нельзя.',
      confirmLabel: 'Сбросить',
      run: () => dispatch({ type: 'reset' }),
    });
  }

  /* Подтверждение спрашивается только после всех проверок файла: незачем
     пугать вопросом о необратимой замене, если файл всё равно не подойдёт. */
  async function importFile(file) {
    const { game: loaded, error } = await readGameFile(file);

    if (error) {
      dispatch({ type: 'notice', text: error });
      return;
    }

    setConfirm({
      title: 'Заменить прогресс из файла?',
      text: 'Персонаж, привычки и история будут заменены содержимым файла. Отменить это будет нельзя — если нынешний прогресс дорог, сначала выгрузите его в файл.',
      confirmLabel: 'Заменить',
      run: () => dispatch({ type: 'replace', game: loaded }),
    });
  }

  return (
    <div className="app">
      <Sidebar streak={appStreak(game)} days={daysInGame(game)} since={game.character.createdAt} />
      <Hero game={game} />
      <Abilities stats={game.character.stats} />

      <Today
        game={game}
        onComplete={(id) => dispatch({ type: 'complete', id })}
        onUndo={(id) => dispatch({ type: 'undo', id })}
        onEdit={(habit) => setSheet({ habit })}
        onDelete={askDelete}
        onCreate={() => setSheet({ habit: null })}
        onExport={() => {
          exportGame(game);
          dispatch({ type: 'notice', text: 'Файл с прогрессом сохранён' });
        }}
        onImport={importFile}
        onReset={askReset}
        onReorder={(id, targetId) => dispatch({ type: 'reorder', id, targetId })}
      />

      <Toast toast={toast} onHide={hideToast} />

      {levelUp && (
        <LevelUpDialog
          character={game.character}
          levelsGained={levelUp}
          onClose={() => dispatch({ type: 'dismissLevelUp' })}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.confirmLabel}
          onConfirm={() => {
            confirm.run();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {sheet && (
        <HabitSheet
          game={game}
          habit={sheet.habit}
          onSave={saveDraft}
          onClose={() => setSheet(null)}
        />
      )}

      {isNewPlayer && (
        <Onboarding
          onFinish={(payload) => dispatch({ type: 'finishOnboarding', ...payload })}
          onNotice={(text) => dispatch({ type: 'notice', text })}
        />
      )}
    </div>
  );
}
