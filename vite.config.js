import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /* Сайт живёт не в корне домена, а на chernoknipnick.github.io/GameLife/.
     Без base все ссылки на собранные файлы уедут на корень и Pages отдаст 404. */
  base: '/GameLife/',
  plugins: [react()],
  test: {
    environment: 'node',
    /* Модули логики проверяются в node — он быстрее. Тест, поднимающий
       приложение целиком, объявляет jsdom у себя в шапке файла. */
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
});
