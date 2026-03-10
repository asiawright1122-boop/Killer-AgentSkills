import { defineConfig } from 'vitest/config';

/** Used in CI build job only: run build-validation test after dist/ exists. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/build-validation.test.ts'],
  },
});
