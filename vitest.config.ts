import { defineConfig } from 'vitest/config';

// Root Vitest config, covering the pure packages AND apps/backend. One consistent runner
// avoids Jest/ts-jest ESM interop hazards with our ESM+TS workspace packages (see
// apps/backend/README.md); NestJS's TestingModule works fine under Vitest since it's plain
// async JS, not Jest-specific.
export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.ts', 'apps/backend/**/*.{test,spec}.ts'],
    environment: 'node',
    setupFiles: ['./apps/backend/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'packages/scoring-engine/src/**',
        'packages/content/src/**',
        'packages/comparison-engine/src/**',
      ],
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
      '@earlysteps/comparison-engine': new URL(
        './packages/comparison-engine/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
