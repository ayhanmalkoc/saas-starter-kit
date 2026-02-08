import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class BillingPage {
  private readonly manageSubscriptionTitle: Locator;
  private readonly billingPortalButton: Locator;
  private readonly subscriptionsHeading: Locator;
  private readonly invoicesHeading: Locator;
  private readonly noActiveSubscriptionText: Locator;

  constructor(
    public readonly page: Page,
    private readonly teamSlug: string
  ) {
    this.manageSubscriptionTitle = this.page.getByText(
      'Manage your subscription'
    );
    this.billingPortalButton = this.page.getByRole('button', {
      name: 'Billing Portal',
    });
    this.subscriptionsHeading = this.page.getByRole('heading', {
      name: 'Subscriptions',
    });
    this.invoicesHeading = this.page.getByRole('heading', {
      name: 'Invoices',
    });
    this.noActiveSubscriptionText = this.page.getByText(
      'No active subscription found.'
    );
  }

  async goto() {
    const billingDataResponse = this.waitForBillingDataLoad();

    await Promise.all([
      billingDataResponse,
      this.page.goto(`/teams/${this.teamSlug}/billing`),
    ]);

    await this.page.waitForURL(`/teams/${this.teamSlug}/billing`);
  }

  async waitForBillingDataLoad() {
    await this.page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/teams/${this.teamSlug}/payments/products`) &&
        response.request().method() === 'GET' &&
        response.ok()
    );
  }

  async expectBillingSectionsVisible() {
    await expect(this.manageSubscriptionTitle).toBeVisible();
    await expect(this.subscriptionsHeading).toBeVisible();
    await expect(this.invoicesHeading).toBeVisible();
  }

  async expectNoActiveSubscriptionState() {
    await expect(this.noActiveSubscriptionText).toBeVisible();
  }

  async openBillingPortal() {
    const portalResponse = this.page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/teams/${this.teamSlug}/payments/create-portal-link`
          ) && response.request().method() === 'POST'
    );

    await this.billingPortalButton.click();
    return portalResponse;
  }

  async expectPortalErrorVisible(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}
