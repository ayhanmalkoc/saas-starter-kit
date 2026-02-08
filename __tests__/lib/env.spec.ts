describe('lib/env toBooleanEnv', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: originalEnv.DATABASE_URL ?? 'postgres://localhost:5432/app',
      APP_URL: originalEnv.APP_URL ?? 'http://localhost:4002',
      NEXTAUTH_SECRET: originalEnv.NEXTAUTH_SECRET ?? 'test-secret',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns false for undefined', async () => {
    const { toBooleanEnv } = await import('../../lib/env');
    expect(toBooleanEnv(undefined)).toBe(false);
  });

  it('returns true for "true"', async () => {
    const { toBooleanEnv } = await import('../../lib/env');
    expect(toBooleanEnv('true')).toBe(true);
  });

  it('returns false for "false"', async () => {
    const { toBooleanEnv } = await import('../../lib/env');
    expect(toBooleanEnv('false')).toBe(false);
  });

  it('returns false for unexpected string values', async () => {
    const { toBooleanEnv } = await import('../../lib/env');
    expect(toBooleanEnv('1')).toBe(false);
    expect(toBooleanEnv('yes')).toBe(false);
    expect(toBooleanEnv('TRUE')).toBe(false);
  });
});

describe('lib/env validation', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = originalEnv;
  });

  it('throws when required environment variables are missing', async () => {
    const brokenEnv = { ...originalEnv };
    delete brokenEnv.DATABASE_URL;
    delete brokenEnv.APP_URL;
    delete brokenEnv.NEXTAUTH_SECRET;
    process.env = brokenEnv;

    jest.resetModules();

    await expect(import('../../lib/env')).rejects.toThrow(
      'Invalid environment configuration'
    );
  });
});
