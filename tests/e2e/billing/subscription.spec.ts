import { test as base } from '@playwright/test';
import { BillingPage, LoginPage } from '../support/fixtures';
import { team, user } from '../support/helper';

type BillingFixture = {
  loginPage: LoginPage;
  billingPage: BillingPage;
};

const test = base.extend<BillingFixture>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  billingPage: async ({ page }, use) => {
    await use(new BillingPage(page, team.slug));
  },
});

test.beforeEach(async ({ page, loginPage }) => {
  await loginPage.goto();
  await loginPage.credentialLogin(user.email, user.password);
  await loginPage.loggedInCheck(team.slug);

  await page.route(`**/api/teams/${team.slug}/payments/products`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          products: [
            {
              id: 'service-pro',
              name: 'Pro',
              description: 'Pro plan',
              features: ['API access'],
              prices: [
                {
                  id: 'price_pro_monthly',
                  billingScheme: 'per_unit',
                  currency: 'usd',
                  amount: 1000,
                  metadata: {},
                  type: 'recurring',
                },
              ],
            },
          ],
          subscriptions: [
            {
              id: 'sub_123',
              status: 'active',
              startDate: '2024-01-01T00:00:00.000Z',
              endDate: '2025-01-01T00:00:00.000Z',
              currentPeriodEnd: '2025-01-01T00:00:00.000Z',
              product: { name: 'Pro' },
              priceId: 'price_pro_monthly',
            },
          ],
          invoices: [
            {
              id: 'in_123',
              status: 'paid',
              amount: 1000,
              currency: 'usd',
              dueDate: '2024-01-02T00:00:00.000Z',
              hostedInvoiceUrl: 'https://example.com/invoice/in_123',
            },
          ],
        },
      }),
    });
  });
});

test('happy path: should render active subscription and invoices', async ({
  billingPage,
}) => {
  await billingPage.goto();
  await billingPage.expectBillingSectionsVisible();
});

test('fail path: should show error toast when billing portal API fails', async ({
  page,
  billingPage,
}) => {
  await page.route(
    `**/api/teams/${team.slug}/payments/create-portal-link`,
    async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Unable to create billing portal link' },
        }),
      });
    }
  );

  await billingPage.goto();

  await billingPage.openBillingPortal();
  await billingPage.expectPortalErrorVisible('Unable to create billing portal link');
});
