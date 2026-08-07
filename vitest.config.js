import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Tests that use Node.js built-ins (fs, path, os, module, crypto, child_process)
    // must run in the 'node' environment instead of jsdom.
    environmentMatchGlobs: [
      ['**/__tests__/lib/executor/**', 'node'],
      ['**/__tests__/lib/exporters/**', 'node'],
      ['**/__tests__/lib/datasetRuntimes/**', 'node'],
      ['**/__tests__/lib/runtimeFactories.test.js', 'node'],
      ['**/__tests__/lib/runtimeSpec.test.js', 'node'],
      ['**/__tests__/lib/pluginBootstrap.test.js', 'node'],
      ['**/__tests__/nodes/nodeStandaloneCapability.test.js', 'node'],
    ],
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '**/*.test.js',
        '**/*.spec.js',
      ],
    },
    include: ['**/__tests__/**/*.test.js', '**/*.test.js'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
