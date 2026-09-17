import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2023',
    rolldownOptions: {
      // 多页：index.html 归院子与页面，tuanzi.html 是团子小样调试页
      input: {
        main: 'index.html',
        tuanzi: 'tuanzi.html',
      },
    },
  },
});
