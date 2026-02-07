describe('lib/jackson/config options', () => {
  const originalEnv = process.env;

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads api key from env with module isolation', async () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      JACKSON_API_KEY: 'jackson-secret',
    };

    const { options } = await import('@/lib/jackson/config');

    expect(options).toEqual({
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jackson-secret',
      },
    });
  });

  it('falls back to undefined api key when not set', async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.JACKSON_API_KEY;

    const { options } = await import('@/lib/jackson/config');

    expect(options.headers.Authorization).toBe('Bearer undefined');
  });
});
