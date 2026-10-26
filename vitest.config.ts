import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so the userscript plugin stays out of tests.
export default defineConfig({
  define: {
    __FC_VERSION__: JSON.stringify('test'),
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    testTimeout: 15000,
  },
});
