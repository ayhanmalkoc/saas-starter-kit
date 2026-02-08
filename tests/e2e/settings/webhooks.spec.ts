import { test as base } from '@playwright/test';
import { LoginPage, WebhooksPage } from '../support/fixtures';
import { team, user } from '../support/helper';

type WebhookFixture = {
  loginPage: LoginPage;
  webhooksPage: WebhooksPage;
};

const test = base.extend<WebhookFixture>({
  loginPage: async ({ page }, runFixture) => {
    await runFixture(new LoginPage(page));
  },
  webhooksPage: async ({ page }, runFixture) => {
    await runFixture(new WebhooksPage(page, team.slug));
  },
});

test.beforeEach(async ({ page, loginPage }) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(team.slug);

  const webhooks: Array<{
    id: string;
    description: string;
    url: string;
    createdAt: string;
  }> = [];

  await page.route(`**/api/teams/${team.slug}/webhooks`, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: webhooks }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON() as {
        name: string;
        url: string;
      };

      const createdWebhook = {
        id: `wh_${webhooks.length + 1}`,
        description: payload.name,
        url: payload.url,
        createdAt: new Date().toISOString(),
      };

      webhooks.push(createdWebhook);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: createdWebhook }),
      });
      return;
    }

    if (method === 'DELETE') {
      const requestUrl = new URL(route.request().url());
      const webhookId = requestUrl.searchParams.get('webhookId');
      const index = webhooks.findIndex((webhook) => webhook.id === webhookId);

      if (index > -1) {
        webhooks.splice(index, 1);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    }
  });
});

test('happy path: should create and delete a webhook', async ({
  webhooksPage,
}) => {
  await webhooksPage.goto();
  await webhooksPage.waitForListLoaded();

  await webhooksPage.openCreateModal();
  await webhooksPage.createWebhook(
    'Audit sink endpoint',
    'https://example.com/svix-webhooks'
  );

  await webhooksPage.expectWebhookInTable('Audit sink endpoint');

  await webhooksPage.deleteWebhook('Audit sink endpoint');
  await webhooksPage.expectEmptyState();
});

test('fail path: should validate required webhook inputs', async ({
  webhooksPage,
}) => {
  await webhooksPage.goto();
  await webhooksPage.waitForListLoaded();

  await webhooksPage.openCreateModal();
  await webhooksPage.submitCreateWebhookForm();

  await webhooksPage.expectValidationError('name is a required field');
  await webhooksPage.expectValidationError('url is a required field');
});
