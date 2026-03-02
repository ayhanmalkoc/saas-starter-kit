import { expect, test } from '@playwright/test';

test.describe('Magic link login', () => {
  test('happy path: should submit magic-link request successfully', async ({
    page,
  }) => {
    await page.route('**/api/auth/signin/email**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          status: 200,
          url: `${process.env.APP_URL}/auth/verify-request`,
        }),
      });
    });

    await page.goto('/auth/magic-link');
    await page
      .getByPlaceholder('jackson@boxyhq.com')
      .fill('jackson@example.com');

    const signInResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/signin/email') && response.ok()
    );

    await page.getByRole('button', { name: 'Send Magic Link' }).click();
    await signInResponse;

    await expect(
      page.getByText(
        'A login link has been sent to your email address. The link will expire in 60 minutes.'
      )
    ).toBeVisible();
  });

  test('fail path: should validate email format before submitting', async ({
    page,
  }) => {
    let signInRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/signin/email')) {
        signInRequestCount += 1;
      }
    });

    await page.goto('/auth/magic-link');
    const emailInput = page.getByPlaceholder('jackson@boxyhq.com');
    await emailInput.fill('invalid-email');
    await page.getByRole('button', { name: 'Send Magic Link' }).click();
    await page.waitForTimeout(500);

    expect(signInRequestCount).toBe(0);
  });
});
