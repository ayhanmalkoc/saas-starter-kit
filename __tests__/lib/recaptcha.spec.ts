describe('lib/recaptcha validateRecaptcha', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RECAPTCHA_SITE_KEY;
    delete process.env.RECAPTCHA_SECRET_KEY;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('skips validation when recaptcha keys are not configured', async () => {
    const { validateRecaptcha } = await import('@/lib/recaptcha');

    await expect(validateRecaptcha()).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws when token is missing while recaptcha is enabled', async () => {
    process.env.RECAPTCHA_SITE_KEY = 'site';
    process.env.RECAPTCHA_SECRET_KEY = 'secret';

    const { validateRecaptcha } = await import('@/lib/recaptcha');

    await expect(validateRecaptcha()).rejects.toMatchObject({
      status: 400,
      message: 'Invalid captcha. Please try again.',
    });
  });

  it('calls google verify API and rejects invalid responses', async () => {
    process.env.RECAPTCHA_SITE_KEY = 'site';
    process.env.RECAPTCHA_SECRET_KEY = 'secret';
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: false }),
    });

    const { validateRecaptcha } = await import('@/lib/recaptcha');

    await expect(validateRecaptcha('captcha-token')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid captcha. Please try again.',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/recaptcha/api/siteverify?'),
      { method: 'POST' }
    );
  });
});
