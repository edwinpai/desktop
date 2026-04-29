import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for EdwinPAI Desktop E2E tests
 * Targets Tauri v2 desktop application
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'tauri-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run tauri dev',
    url: 'tauri://localhost',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
