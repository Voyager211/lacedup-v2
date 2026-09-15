import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real SPA and the real API.
 *
 * The e2e stack runs on its own ports so it never reuses a dev server that is
 * pointed at a real database. The API is `npm run e2e:server` in backend/,
 * which boots an in-memory MongoDB rather than reading MONGODB_URI.
 */
const WEB_PORT = 5174;
const API_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'npm run e2e:server',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/healthz`,
      env: { E2E_API_PORT: String(API_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe'
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
