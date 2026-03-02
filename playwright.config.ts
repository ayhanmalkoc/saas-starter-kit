import { PlaywrightTestConfig, devices } from '@playwright/test';

const normalizeAuthProviders = () => {
  const configuredRaw = (process.env.AUTH_PROVIDERS || '')
    .split(',')
    .map((provider) => provider.trim())
    .filter(Boolean);

  const configured =
    configuredRaw.length > 0
      ? configuredRaw
      : ['github', 'google', 'credentials'];

  const merged = new Set(configured);
  merged.add('email');
  merged.add('saml');
  merged.add('idp-initiated');

  return Array.from(merged).join(',');
};

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
    command: 'npm run start -- --hostname localhost',
    url: 'http://localhost:4002',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      AUTH_PROVIDERS: normalizeAuthProviders(),
      NEXTAUTH_SESSION_STRATEGY: 'database',
      CONFIRM_EMAIL: 'false',
    },
  },
  retries: 1,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    baseURL: 'http://localhost:4002',
    trace: 'retain-on-first-failure',
    video: 'on-first-retry',
  },
  testDir: './tests/e2e',
};

export default config;
