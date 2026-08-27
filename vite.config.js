import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /* Сайт живёт не в корне домена, а на chernoknipnick.github.io/GameLife/.
     Без base все ссылки на собранные файлы уедут на корень и Pages отдаст 404. */
  base: '/GameLife/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
