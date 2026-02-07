import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class WebhooksPage {
  private readonly addWebhookButton: Locator;
  private readonly createWebhookButton: Locator;
  private readonly descriptionInput: Locator;
  private readonly endpointInput: Locator;

  constructor(
    public readonly page: Page,
    private readonly teamSlug: string
  ) {
    this.addWebhookButton = this.page.getByRole('button', {
      name: 'Add Webhook',
    });
    this.createWebhookButton = this.page.getByRole('button', {
      name: 'Create Webhook',
    });
    this.descriptionInput = this.page.getByPlaceholder(
      'Description of what this endpoint is used for.'
    );
    this.endpointInput = this.page.getByPlaceholder(
      'https://api.example.com/svix-webhooks'
    );
  }

  async goto() {
    await this.page.goto(`/teams/${this.teamSlug}/webhooks`);
    await this.page.waitForURL(`/teams/${this.teamSlug}/webhooks`);
  }

  async waitForListLoaded() {
    await this.page.waitForResponse(
      (response) =>
        response.url().includes(`/api/teams/${this.teamSlug}/webhooks`) &&
        response.request().method() === 'GET' &&
        response.ok()
    );
  }

  async openCreateModal() {
    await this.addWebhookButton.click();
    await expect(this.createWebhookButton).toBeVisible();
  }

  async createWebhook(description: string, endpoint: string) {
    const createResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes(`/api/teams/${this.teamSlug}/webhooks`) &&
        response.request().method() === 'POST'
    );

    await this.descriptionInput.fill(description);
    await this.endpointInput.fill(endpoint);
    await this.page.getByLabel('member.created').check();
    await this.createWebhookButton.click();

    await createResponse;
  }

  async submitCreateWebhookForm() {
    await this.createWebhookButton.click();
  }

  async expectWebhookInTable(description: string) {
    await expect(this.page.getByRole('cell', { name: description })).toBeVisible();
  }

  async deleteWebhook(description: string) {
    const row = this.page.locator('tr', {
      has: this.page.getByRole('cell', { name: description }),
    });

    const deleteResponse = this.page.waitForResponse(
      (response) =>
        response.url().includes(`/api/teams/${this.teamSlug}/webhooks?`) &&
        response.request().method() === 'DELETE'
    );

    await row.getByRole('button', { name: 'Remove' }).click();
    await this.page.getByRole('button', { name: 'Delete' }).click();

    await deleteResponse;
  }

  async expectEmptyState() {
    await expect(
      this.page.getByText("You haven't created any webhook yet")
    ).toBeVisible();
  }

  async expectValidationError(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}
