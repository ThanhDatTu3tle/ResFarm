import { defineConfig } from 'vitest/config';

// base tương đối để bản build chạy được ở mọi đường dẫn (GitHub Pages, Netlify, ...)
// test.include: chỉ chạy test của dự án, bỏ qua file mẫu trong .claude/skills
export default defineConfig({ base: './', test: { include: ['test/**/*.test.ts'] } });
