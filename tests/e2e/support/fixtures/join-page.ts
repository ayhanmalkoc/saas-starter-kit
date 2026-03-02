import { type Page, type Locator, expect } from '@playwright/test';

export class JoinPage {
  private readonly nameBox: Locator;
  private readonly projectNameBox: Locator;
  private readonly emailBox: Locator;
  private readonly passwordBox: Locator;
  private readonly createAccountButton: Locator;
  private readonly createAccountSuccessMessage: string;
  constructor(
    public readonly page: Page,
    public readonly user: {
      name: string;
      email: string;
      password: string;
    },
    public readonly projectName: string
  ) {
    this.nameBox = this.page.locator('input[name="name"]');
    this.projectNameBox = this.page.locator('input[name="organizationName"]');
    this.emailBox = this.page.locator('input[name="email"]');
    this.passwordBox = this.page.locator('input[name="password"]');
    this.createAccountButton = page.locator('form button[type="submit"]');
    this.createAccountSuccessMessage =
      'You have successfully created your account.';
  }

  async goto() {
    await this.page.context().clearCookies();

    await this.page.goto('/auth/join', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle');

    if (!/\/auth\/join/.test(this.page.url())) {
      await this.page.goto('/auth/join', { waitUntil: 'networkidle' });
    }

    await expect(this.page).toHaveURL(/\/auth\/join/);
    await expect(this.nameBox).toBeVisible({ timeout: 45000 });
  }

  async signUp() {
    await this.nameBox.fill(this.user.name);
    await this.projectNameBox.fill(this.projectName);
    await this.emailBox.fill(this.user.email);
    await this.passwordBox.fill(this.user.password);
    await this.createAccountButton.click();

    // Account creation flow may land on login, dashboard, or verify-email based on env flags.
    await Promise.race([
      this.page.waitForURL(/\/auth\/login/, { timeout: 30000 }),
      this.page.waitForURL(/\/dashboard/, { timeout: 30000 }),
      this.page.waitForURL(/\/auth\/verify-email/, { timeout: 30000 }),
    ]).catch(() => undefined);

    if (/\/auth\/login/.test(this.page.url())) {
      await expect(
        this.page
          .getByRole('status')
          .and(this.page.getByText(this.createAccountSuccessMessage))
      ).toBeVisible();
      return;
    }

    await this.page.goto('/auth/login');
    await expect(
      this.page.getByRole('heading', { name: 'Welcome back' })
    ).toBeVisible();
  }
}
