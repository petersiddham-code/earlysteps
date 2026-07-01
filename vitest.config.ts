import { defineConfig } from 'vitest/config';

// Root Vitest config. Pure packages (scoring-engine, content) are framework-agnostic
// and tested here; the NestJS backend will use its own Jest config when scaffolded.
export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/scoring-engine/src/**', 'packages/content/src/**'],
    },
  },
  resolve: {
    alias: {
      '@earlysteps/shared-types': new URL(
        './packages/shared-types/src/index.ts',
        import.meta.url,
      ).pathname,
      '@earlysteps/content': new URL('./packages/content/src/index.ts', import.meta.url)
        .pathname,
      '@earlysteps/scoring-engine': new URL(
        './packages/scoring-engine/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
