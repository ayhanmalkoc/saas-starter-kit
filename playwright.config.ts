import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  workers: 1,
  globalSetup: require.resolve('./tests/e2e/support/globalSetup.ts'),
  // Timeout per test
  timeout: 100 * 1000,
  // Assertion timeout
  expect: {
    timeout: 10 * 1000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'support/*.setup.ts',
      teardown: 'cleanup db',
    },
    {
      name: 'cleanup db',
      testMatch: 'support/*.teardown.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  reporter: 'html',
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:4002',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  retries: process.env.CI ? 0 : 1,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    baseURL: 'http://127.0.0.1:4002',
    trace: 'retain-on-first-failure',
  },
  testDir: './tests/e2e',
};

export default config;
