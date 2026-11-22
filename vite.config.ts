import { defineConfig } from 'vitest/config';

// base tương đối để bản build chạy được ở mọi đường dẫn (GitHub Pages, Netlify, ...)
// test.include: chỉ chạy test của dự án, bỏ qua file mẫu trong .claude/skills
// build.rollupOptions.input: ngoài game (index.html) còn phát 3 trang xem model 3D cho tiện xem ở máy khác; Sổ tay sinh vào dist/so-tay.html (npm run build)
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: ['index.html', 'models-nhan-vat.html', 'models-do-vat.html', 'models-mon-an.html'] } },
  test: { include: ['test/**/*.test.ts'] },
});
