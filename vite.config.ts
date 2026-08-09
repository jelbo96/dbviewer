/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // mermaid necesita DOM incluso sólo para parsear
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
