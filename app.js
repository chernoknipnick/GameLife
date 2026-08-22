'use strict';

/* GameLife v0.1 — задача 3 Фазы 1: начисление опыта по клику.
   Покрывает FR-4.4 (три сложности), FR-3.4 (опыт в характеристику),
   FR-3.4a (пассивная дисциплина), FR-4.5 и FR-4.6 (одно выполнение
   в сутки, приглушённая карточка), раздел 7.3 (дневной лимит).

   Чего здесь пока нет и почему:
   - повышение уровня — задача 4;
   - сохранение в localStorage — задача 5, после перезагрузки всё
     возвращается к начальным значениям;
   - создание и удаление привычек — задача 6. */

/* --- Правила игры (раздел 7.1 ТЗ) --- */

var DAILY_LIMIT = 500;

var DIFFICULTY = {
  easy: { label: 'Лёгкая', xp: 10 },
  medium: { label: 'Средняя', xp: 25 },
  hard: { label: 'Тяжёлая', xp: 50 }
};

var STATS = {
  str: { label: 'Сила', abbr: 'СИЛ', modifier: 'strength' },
  int: { label: 'Интеллект', abbr: 'ИНТ', modifier: 'intellect' },
  hp: { label: 'Здоровье', abbr: 'ЗДР', modifier: 'health' }
};

/** Порог опыта до следующего уровня. */
function xpToNextLevel(level) {
  return 100 + (level - 1) * 50;
}

/** Множитель за длину серии. */
function streakMultiplier(streak) {
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1;
}

/** Опыт за одно выполнение привычки. */
function xpFor(habit) {
  return Math.round(DIFFICULTY[habit.difficulty].xp * streakMultiplier(habit.streak));
}

/** Дисциплина пассивная: капает с любого выполнения (FR-3.4a). */
function disciplineFor(xp) {
  return Math.max(5, Math.round(xp * 0.3));
}

/* --- Состояние --- */

var state = {
  level: 5,
  xp: 180,
  dailyXp: 0,
  stats: { str: 145, int: 320, hp: 90, discipline: 210 },
  habits: [
    { id: 1, title: 'Зарядка 10 минут', stat: 'str', difficulty: 'medium', streak: 3, done: false },
    { id: 2, title: 'Чтение 20 страниц', stat: 'int', difficulty: 'easy', streak: 12, done: true },
    { id: 3, title: 'Медитация', stat: 'hp', difficulty: 'easy', streak: 0, done: false }
  ]
};

/* --- Действие --- */

/**
 * Отмечает привычку выполненной и начисляет опыт.
 * Возвращает false, если начисление не состоялось.
 */
function completeHabit(id) {
  var habit = state.habits.find(function (item) {
    return item.id === id;
  });

  // FR-4.5: одна привычка выполняется не чаще раза в сутки.
  if (!habit || habit.done) return false;

  var gain = xpFor(habit);

  // Раздел 7.3: лимит блокирующий. Заработанное не отнимаем —
  // начисление просто останавливается до следующих суток.
  if (state.dailyXp + gain > DAILY_LIMIT) {
    showMessage('Дневной лимит в ' + DAILY_LIMIT + ' опыта исчерпан. Прогресс сохранён, начисление продолжится завтра.');
    return false;
  }

  var discipline = disciplineFor(gain);

  habit.done = true;
  habit.streak += 1;

  state.xp += gain;
  state.dailyXp += gain;
  state.stats[habit.stat] += gain;
  state.stats.discipline += discipline;

  render();
  showMessage('+' + gain + ' в характеристику «' + STATS[habit.stat].label + '», +' + discipline + ' к дисциплине');
  return true;
}

/* --- Отрисовка --- */

var nodes = {};
var messageTimer = null;

function cacheNodes() {
  ['level', 'level-text', 'xp-value', 'xp-track', 'xp-fill', 'stat-str', 'stat-int', 'stat-hp', 'stat-dis', 'today-meta', 'habits', 'limit-value', 'toast'].forEach(
    function (id) {
      nodes[id] = document.getElementById(id);
    }
  );
}

function renderCharacter() {
  var need = xpToNextLevel(state.level);
  // Полоска не переполняется: повышение уровня — задача 4.
  var percent = Math.min(100, Math.round((state.xp / need) * 100));

  nodes.level.textContent = state.level;
  nodes['level-text'].textContent = state.level;
  nodes['xp-value'].textContent = state.xp + ' / ' + need;
  nodes['xp-fill'].style.width = percent + '%';
  nodes['xp-track'].setAttribute('aria-valuenow', state.xp);
  nodes['xp-track'].setAttribute('aria-valuemax', need);

  nodes['stat-str'].textContent = state.stats.str;
  nodes['stat-int'].textContent = state.stats.int;
  nodes['stat-hp'].textContent = state.stats.hp;
  nodes['stat-dis'].textContent = state.stats.discipline;

  nodes['limit-value'].textContent = state.dailyXp + ' / ' + DAILY_LIMIT;
}

var FLAME_PATH = 'M5 .5C6.6 3 8.5 4 8.5 7A3.5 3.5 0 0 1 1.5 7c0-1.8 1.6-2.7 3.5-6.5z';

function createFlameIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 10 12');
  svg.setAttribute('aria-hidden', 'true');

  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', FLAME_PATH);
  path.setAttribute('fill', 'currentColor');

  svg.appendChild(path);
  return svg;
}

function createHabitCard(habit) {
  var stat = STATS[habit.stat];
  var gain = xpFor(habit);

  var card = document.createElement('li');
  card.className = 'habit' + (habit.done ? ' habit--completed' : '');

  var row = document.createElement('div');
  row.className = 'habit__row';

  var info = document.createElement('div');
  info.className = 'habit__info';

  var title = document.createElement('p');
  title.className = 'habit__title';
  title.textContent = habit.title;

  var tags = document.createElement('p');
  tags.className = 'habit__tags';

  var chip = document.createElement('span');
  chip.className = 'chip chip--' + stat.modifier;
  chip.textContent = stat.label;

  var meta = document.createElement('span');
  meta.className = 'habit__gain';
  meta.textContent = '+' + gain + ' · +' + disciplineFor(gain) + ' ДИС';

  tags.append(chip, meta);
  info.append(title, tags);
  row.append(info);

  if (habit.streak > 0) {
    var streak = document.createElement('p');
    streak.className = 'pill pill--fire';

    var count = document.createElement('span');
    count.textContent = habit.streak;

    var hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.textContent = 'дней подряд';

    streak.append(createFlameIcon(), count, hint);
    row.append(streak);
  }

  var button = document.createElement('button');
  button.type = 'button';
  button.className = habit.done ? 'btn btn--completed' : 'btn btn--done';
  button.textContent = habit.done ? 'Готово' : 'Выполнено';
  button.disabled = habit.done; // FR-4.6

  if (!habit.done) {
    button.addEventListener('click', function () {
      completeHabit(habit.id);
    });
  }

  card.append(row, button);
  return card;
}

function renderHabits() {
  var doneCount = state.habits.filter(function (habit) {
    return habit.done;
  }).length;

  nodes['today-meta'].textContent = doneCount + ' / ' + state.habits.length;

  nodes.habits.replaceChildren();
  state.habits.forEach(function (habit) {
    nodes.habits.append(createHabitCard(habit));
  });
}

function render() {
  renderCharacter();
  renderHabits();
}

/** Короткое сообщение об итоге действия (принцип 1.2 — мгновенная обратная связь). */
function showMessage(text) {
  nodes.toast.textContent = text;
  nodes.toast.hidden = false;

  clearTimeout(messageTimer);
  messageTimer = setTimeout(function () {
    nodes.toast.hidden = true;
  }, 2600);
}

document.addEventListener('DOMContentLoaded', function () {
  cacheNodes();
  render();
});
