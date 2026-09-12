import { useRef, useState } from 'react';
import { DAILY_LIMIT } from '../state/rules.js';
import {
  hasProgress,
  isDoneToday,
  restingHabits,
  todayHabits,
  xpToday,
} from '../state/selectors.js';
import HabitCard from './HabitCard.jsx';
import Week from './Week.jsx';

export default function Today({
  game,
  onComplete,
  onUndo,
  onEdit,
  onDelete,
  onCreate,
  onExport,
  onImport,
  onReset,
  onReorder,
}) {
  const fileRef = useRef(null);
  const [dragId, setDragId] = useState(null);

  const visible = todayHabits(game);
  const resting = restingHabits(game);
  const doneCount = visible.filter((habit) => isDoneToday(game, habit)).length;

  /* Перестановка стрелками (FR-4.12). Соседа ищем в видимом списке, а не
     в массиве: между двумя сегодняшними привычками может лежать
     незапланированная, и шаг «на единицу по массиву» увёл бы не туда. */
  function moveBy(habit, delta) {
    const at = visible.findIndex((item) => item.id === habit.id);
    const target = visible[at + delta];
    if (target) onReorder(habit.id, target.id);
  }

  /* Перетаскивание указателем — одним обработчиком и для мыши, и для
     пальца. Захват указателя нужен, чтобы события не терялись, когда
     палец уходит за пределы кнопки. */
  function grab(event, habit) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragId(habit.id);

    const move = (moveEvent) => {
      const под = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const карточка = под && под.closest('[data-habit-id]');
      const targetId = карточка && карточка.dataset.habitId;

      // Переставляем только внутри сегодняшнего списка.
      if (!targetId || targetId === habit.id) return;
      if (!visible.some((item) => item.id === targetId)) return;

      onReorder(habit.id, targetId);
    };

    const drop = () => {
      setDragId(null);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', drop);
      document.removeEventListener('pointercancel', drop);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', drop);
    document.addEventListener('pointercancel', drop);
  }

  return (
    <main className="today">
      <div className="today__head">
        <h1 className="today__title">Сегодня</h1>
        {/* Формат подзаголовка взят из макета: выполнено, всего и опыт за
            день одной строкой, без отдельного блока про лимит. */}
        <p className="today__meta">
          {doneCount} из {visible.length} · {xpToday(game)}/{DAILY_LIMIT}
        </p>
      </div>

      <ul className="habits">
        {visible.map((habit) => (
          <HabitCard
            key={habit.id}
            game={game}
            habit={habit}
            onComplete={onComplete}
            onUndo={onUndo}
            onEdit={onEdit}
            onDelete={onDelete}
            /* Тащить нечего, пока привычка одна. */
            draggable={visible.length > 1}
            dragging={dragId === habit.id}
            onMove={moveBy}
            onGrab={grab}
          />
        ))}
      </ul>

      {/* NFR-4.5: пустой список объясняет, что делать дальше. */}
      <div className="empty" hidden={visible.length > 0}>
        <p className="empty__title">Здесь пока пусто</p>
        <p className="empty__text">
          Добавьте первую привычку — например, зарядку на пять минут. Каждое выполнение будет давать
          опыт персонажу.
        </p>
      </div>

      {/* FR-4.11 требует не показывать привычку в незапланированный день.
          Спрятать совсем нельзя: навигации нет, и до такой привычки стало
          бы не добраться — ни поправить, ни удалить. Поэтому она уходит в
          отдельный приглушённый список без кнопки выполнения. */}
      {resting.length > 0 && (
        <section className="resting" aria-labelledby="resting-title">
          <h2 className="resting__title" id="resting-title">
            Не сегодня
          </h2>

          <ul className="habits">
            {resting.map((habit) => (
              <HabitCard
                key={habit.id}
                game={game}
                habit={habit}
                resting
                onComplete={onComplete}
                onUndo={onUndo}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      )}

      <button className="btn btn--add" type="button" onClick={onCreate}>
        Добавить привычку
      </button>

      <Week game={game} />

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

      {/* Кнопка скрыта, пока сбрасывать нечего (FR-15.1). */}
      {hasProgress(game) && (
        <button className="btn btn--reset" type="button" onClick={onReset}>
          Сбросить прогресс
        </button>
      )}
    </main>
  );
}
