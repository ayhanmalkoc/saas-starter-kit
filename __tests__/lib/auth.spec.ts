describe('lib/auth provider parsing', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = originalEnv;
  });

  it.each([
    {
      authProviders: 'github,credentials',
      expected: { github: true, credentials: true, google: false },
    },
    {
      authProviders: 'github, credentials',
      expected: { github: true, credentials: true, google: false },
    },
    {
      authProviders: ' github ,  google ',
      expected: { github: true, credentials: false, google: true },
    },
  ])(
    'enables expected providers for "$authProviders"',
    async ({ authProviders, expected }) => {
      process.env = {
        ...originalEnv,
        DATABASE_URL:
          originalEnv.DATABASE_URL ?? 'postgres://localhost:5432/app',
        APP_URL: originalEnv.APP_URL ?? 'http://localhost:4002',
        NEXTAUTH_SECRET: originalEnv.NEXTAUTH_SECRET ?? 'test-secret',
        AUTH_PROVIDERS: authProviders,
      };

      const { isAuthProviderEnabled } = await import('../../lib/auth');

      expect(isAuthProviderEnabled('github')).toBe(expected.github);
      expect(isAuthProviderEnabled('credentials')).toBe(expected.credentials);
      expect(isAuthProviderEnabled('google')).toBe(expected.google);
    }
  );
});
