import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { target: 'chrome120', rollupOptions: { input: 'editor.html' } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
