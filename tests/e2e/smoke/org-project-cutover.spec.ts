import { expect, test } from '@playwright/test';
import { user } from '../support/helper';

const getCanonicalContextFromUrl = (url: string) => {
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean);
  const orgIndex = parts.indexOf('orgs');
  const projectIndex = parts.indexOf('projects');

  if (orgIndex < 0 || projectIndex < 0) {
    throw new Error(`Canonical workspace URL not found: ${url}`);
  }

  const orgSlug = parts[orgIndex + 1];
  const projectSlug = parts[projectIndex + 1];

  if (!orgSlug || !projectSlug) {
    throw new Error(`Org/project slug missing in URL: ${url}`);
  }

  return { orgSlug, projectSlug };
};

test('PR-5D smoke: login + canonical workspace + members + billing', async ({
  page,
}) => {
  await page.goto('/auth/login');
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL(/\/orgs\/[^/]+\/projects\/[^/]+\/settings/, {
    timeout: 30000,
  });
  await expect(
    page.getByRole('heading', { name: 'Team Settings' })
  ).toBeVisible();

  const { orgSlug, projectSlug } = getCanonicalContextFromUrl(page.url());

  // Workspace navigation smoke: members page via canonical app route.
  await page.goto(`/orgs/${orgSlug}/projects/${projectSlug}/members`);
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite Member' })).toBeVisible();

  // Team members + invitations smoke via canonical API route.
  const invitationListResponse = await page.request.get(
    `/api/orgs/${orgSlug}/projects/${projectSlug}/invitations?sentViaEmail=true`
  );
  expect(invitationListResponse.ok()).toBeTruthy();

  // Billing page + canonical products API smoke.
  await page.goto(`/orgs/${orgSlug}/projects/${projectSlug}/billing`);
  await expect(
    page.getByRole('heading', { name: 'Manage your subscription' })
  ).toBeVisible();

  const productsResponse = await page.request.get(
    `/api/orgs/${orgSlug}/projects/${projectSlug}/payments/products`
  );
  expect(productsResponse.ok()).toBeTruthy();

  // Checkout endpoint smoke: endpoint is reachable on canonical route.
  // It may return 200 or 4xx depending on Stripe/config state in local env.
  const checkoutResponse = await page.request.post(
    `/api/orgs/${orgSlug}/projects/${projectSlug}/payments/create-checkout-session`,
    {
      data: {
        price: 'price_smoke_check',
      },
    }
  );
  const checkoutStatus = checkoutResponse.status();
  expect([404, 405].includes(checkoutStatus)).toBeFalsy();
});
