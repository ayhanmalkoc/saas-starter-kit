import { expect, test } from '@playwright/test';

test.describe('Password reset', () => {
  test('happy path: should request password reset and complete reset with valid token', async ({
    page,
  }) => {
    await page.route('**/api/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message:
            'If an account exists for this e-mail, password reset instructions have been sent.',
        }),
      });
    });

    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Password updated successfully.' }),
      });
    });

    await page.goto('/auth/forgot-password');
    await page.getByPlaceholder('Email').fill('jackson@example.com');

    const forgotPasswordResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/forgot-password') && response.ok()
    );

    await page
      .getByRole('button', { name: 'Email Password Reset Link' })
      .click();
    await forgotPasswordResponse;

    await expect(
      page.getByText(
        'If an account exists for this e-mail, password reset instructions have been sent.'
      )
    ).toBeVisible();

    await page.goto('/auth/reset-password/valid-token');
    await page.getByPlaceholder('New Password').fill('new-password');
    await page.getByPlaceholder('Confirm Password').fill('new-password');

    const resetPasswordResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/reset-password') && response.ok()
    );

    await page.getByRole('button', { name: 'Reset Password' }).click();
    await resetPasswordResponse;

    await page.waitForURL('/auth/login');
  });

  test('fail path: should show an error when token is invalid', async ({
    page,
  }) => {
    await page.route('**/api/auth/reset-password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Invalid or expired password reset token' },
        }),
      });
    });

    await page.goto('/auth/reset-password/invalid-token');
    await page.getByPlaceholder('New Password').fill('new-password');
    await page.getByPlaceholder('Confirm Password').fill('new-password');

    const resetPasswordResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/reset-password') &&
        response.status() === 400
    );

    await page.getByRole('button', { name: 'Reset Password' }).click();
    await resetPasswordResponse;

    await expect(
      page.getByText('Invalid or expired password reset token')
    ).toBeVisible();
  });
});
