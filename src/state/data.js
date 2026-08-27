/* Обмен прогрессом файлом (FR-15.2, FR-15.3). */

import { parseState } from './storage.js';
import { today } from './selectors.js';

const ПРИЧИНЫ = {
  unparsable: 'Это не файл GameLife: содержимое не разбирается',
  version: 'Файл сделан другой версией приложения',
  shape: 'Файл повреждён или это не сохранение GameLife',
};

/**
 * Выгружает сохранение в файл (FR-15.2).
 *
 * Имя с датой: файлов со временем накапливается несколько, и без даты
 * они неразличимы. Отступы в JSON оставлены — файл должен читаться
 * глазами, это единственная резервная копия до появления облака.
 */
export function exportGame(game) {
  const blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'gamelife-' + today(game) + '.json';

  document.body.append(link);
  link.click();
  link.remove();

  // Пока ссылку не отпустишь, браузер держит файл в памяти.
  URL.revokeObjectURL(url);
}

/**
 * Читает файл и проверяет его теми же тремя ступенями, что и хранилище:
 * разбор, версия, форма. Файл приходит извне, и доверия ему тем меньше.
 *
 * Возвращает {game} либо {error} с готовым текстом для игрока.
 */
export function readGameFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => resolve({ error: 'Файл не удалось прочитать' });

    reader.onload = () => {
      const result = parseState(reader.result);
      if (result.state) resolve({ game: result.state });
      else resolve({ error: ПРИЧИНЫ[result.error] });
    };

    reader.readAsText(file);
  });
}
