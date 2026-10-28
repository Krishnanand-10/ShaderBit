import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const mockSetupPath = resolve(__dirname, 'tests/mocks/setup.ts');
const setupFiles = existsSync(mockSetupPath) ? [mockSetupPath] : [];

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles,
    include: [
      '**/*.{test,spec}.{ts,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**'
    ]
  }
});
