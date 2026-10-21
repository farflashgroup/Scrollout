import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '127.0.0.1', strictPort: true, cors: false,
    fs: {
      strict: true, allow: ['.'],
      deny: ['.env', '.env.*', '**/*.{crt,pem,key,p12,pfx}', '**/.git/**', '**/.npmrc'],
    },
  },
  preview: { host: '127.0.0.1', strictPort: true, cors: false },
  build: { target: 'chrome120', rollupOptions: { input: 'editor.html' } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
