import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    exclude: [...configDefaults.exclude, '.cache/**', '.reference/**', 'e2e/**', 'vendor/**'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/replay/**/*.ts',
        'src/maps/**/*.ts',
        'src/parser/**/*.ts',
        'src/playback/**/*.ts',
      ],
      exclude: ['src/parser/demo.worker.ts', 'src/parser/wasm-bindings.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
