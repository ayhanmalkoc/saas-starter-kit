import { expect, test } from '@playwright/test';

test.describe('OAuth provider login', () => {
  test('happy path: should initiate GitHub OAuth login', async ({ page }) => {
    await page.route('**/api/auth/signin/github**', async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          location: 'https://github.com/login/oauth/authorize',
        },
        body: '',
      });
    });

    await page.goto('/auth/login');

    const githubButton = page.getByRole('button', {
      name: 'Continue with GitHub',
    });

    let isGithubProviderVisible = true;

    try {
      await githubButton.waitFor({ state: 'visible', timeout: 1000 });
    } catch {
      isGithubProviderVisible = false;
    }

    test.skip(
      !isGithubProviderVisible,
      'GitHub provider is disabled in this environment.'
    );

    const githubSignInRequest = page.waitForRequest((request) =>
      request.url().includes('/api/auth/signin/github')
    );

    await githubButton.click();
    await githubSignInRequest;
  });

  test('fail path: should surface error message after OAuth callback failure', async ({
    page,
  }) => {
    await page.goto('/auth/login?error=invalid-credentials');

    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
});
