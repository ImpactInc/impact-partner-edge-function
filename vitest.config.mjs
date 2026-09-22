import {fileURLToPath} from 'node:url';
import {cloudflareTest} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';

const coverage = {
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
};

export default defineConfig({
  test: {
    coverage,
    projects: [
      {
        resolve: {
          alias: {
            'cloudflare:workers': fileURLToPath(
              new URL('./test/stubs/cloudflare-workers.js', import.meta.url)
            )
          }
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/**/*.test.js'],
          exclude: ['test/workers/**']
        }
      },
      {
        plugins: [
          cloudflareTest({
            main: './test/workers/caller.js',
            miniflare: {
              compatibilityDate: '2026-07-21',
              serviceBindings: {
                IMPACT: 'impact-partner-edge-function',
                TELEMETRY_SINK: 'telemetry-sink'
              },
              workers: [
                {
                  name: 'impact-partner-edge-function',
                  modules: true,
                  scriptPath: './dist/index.js',
                  compatibilityDate: '2026-07-21',
                  bindings: {
                    IMPACT_ACCOUNT_ID: 'test-account',
                    IMPACT_AUTH_TOKEN: 'test-token'
                  },
                  outboundService: 'telemetry-sink'
                },
                {
                  name: 'telemetry-sink',
                  modules: true,
                  scriptPath: './test/workers/telemetry-sink.js',
                  compatibilityDate: '2026-07-21'
                }
              ]
            }
          })
        ],
        test: {
          name: 'workers',
          include: ['test/workers/**/*.test.js'],
          globalSetup: ['./test/workers/global-setup.js']
        }
      }
    ]
  }
});
