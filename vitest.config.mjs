import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.js'],
      exclude: [
        'test/**',
        '**/*.test.js',
        '**/node_modules/**'
      ],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage'
    }
  }
});
