import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from './Sidebar.jsx';

/* Пометка релиза в боковом меню — обещание игроку. «Настройки» простояли
   с меткой v0.2 до 27.08.2026, пережив выход этого релиза: раздел так и
   не появился, а плашка продолжала его обещать.
   Тест сторожит именно это и ничего больше. */

const версияПриложения = JSON.parse(readFileSync('package.json', 'utf8')).version;

function числом(версия) {
  const [major, minor] = версия.replace(/^v/, '').split('.');
  return Number(major) * 1000 + Number(minor);
}

describe('пометки релизов в меню', () => {
  it('ни один будущий раздел не обещан в уже вышедшем релизе', () => {
    const врут = SECTIONS.filter((section) => числом(section.release) <= числом(версияПриложения));

    expect(
      врут.map((s) => s.title + ' обещан в ' + s.release),
      'приложение уже версии ' + версияПриложения
    ).toEqual([]);
  });

  it('у каждого раздела есть название и метка релиза', () => {
    SECTIONS.forEach((section) => {
      expect(section.title).toBeTruthy();
      expect(section.release).toMatch(/^v\d+\.\d+$/);
    });
  });
});
