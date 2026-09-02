import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/ui'),
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
  },
});
