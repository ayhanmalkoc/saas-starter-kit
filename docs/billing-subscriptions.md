# Billing & Subscription Integration

This document summarizes the Stripe-based payments/subscription architecture in the project, core workflows, required configuration, and operational steps.

## Architecture

The following files form the core of the billing domain:

- `pages/api/teams/[slug]/payments/*`
  - `create-checkout-session.ts`: creates a checkout session.
  - `update-subscription.ts`: updates an existing subscription plan/price (and quantity when needed).
  - `create-portal-link.ts`: generates a Stripe Customer Portal link.
  - `products.ts`: aggregates product, price, subscription, and invoice data for the UI.
- `pages/api/webhooks/stripe.ts`
  - Verifies Stripe webhook signatures (`stripe-signature` + `STRIPE_WEBHOOK_SECRET`).
  - Processes relevant events and synchronizes data into the DB.
- `models/subscription.ts`
  - Manages subscription CRUD operations (`create`, `update`, `delete`, `get`) via Prisma.
- `models/invoice.ts`
  - Upserts Stripe invoice data into the `invoice` table and supports team-scoped listing.

Additionally, product/price synchronization uses an admin endpoint and helper script:

- `pages/api/admin/stripe/sync.ts`: pulls Stripe products/prices and writes them to the DB.
- `sync-stripe.js`: helper script that calls this endpoint via `APP_URL`.

## Flows

### 1) Checkout

1. The client calls `POST /api/teams/[slug]/payments/create-checkout-session`.
2. The API validates team access and user session.
3. A billing provider resolves/creates the customer (`customerId`).
4. A Stripe checkout session is created.
5. Success/cancel URLs redirect back to the team billing page.

### 2) Plan update

1. The client calls `POST /api/teams/[slug]/payments/update-subscription`.
2. The API checks team authorization and confirms the subscription belongs to that team.
3. It loads the Stripe subscription and first subscription item.
4. It retrieves the new price and calculates quantity for seat-based plans.
5. It updates the Stripe subscription with `proration_behavior: 'create_prorations'`.

### 3) Open customer portal

1. The client calls `POST /api/teams/[slug]/payments/create-portal-link`.
2. The API validates team access and session.
3. It creates a customer portal session via the billing provider.
4. It returns the portal `url`, and the user is redirected to Stripe.

### 4) Webhook-driven DB sync

1. Stripe sends events to `POST /api/webhooks/stripe`.
2. The endpoint verifies the signature using the raw request body.
3. For idempotency, it stores event id/type in `webhookEvent` (duplicate events are ignored).
4. It processes by event type:
   - `customer.subscription.created/updated/deleted` → `subscription` updates
   - `invoice.payment_succeeded/failed` → `invoice` upserts
   - `product.created/updated` → `service` upserts
   - `price.created/updated` → `price` upserts
5. Stripe-side changes are kept in sync with the DB.

## Configuration

Required environment variables:

- `STRIPE_SECRET_KEY`
  - Server-side secret key for Stripe API calls.
- `STRIPE_WEBHOOK_SECRET`
  - Required for signature verification in `pages/api/webhooks/stripe.ts`.
- `STRIPE_SYNC_SECRET`
  - Shared secret protecting `/api/admin/stripe/sync`.
  - Sent by `sync-stripe.js` in the `x-stripe-sync-secret` header.

Recommended supporting variable:

- `APP_URL`
  - Required for checkout/portal return URLs and for `npm run sync-stripe`.

## Operations

### Initial setup

1. Create products and prices in the Stripe dashboard.
2. Define at least these values in `.env`:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_SYNC_SECRET`
   - `APP_URL` (e.g., local: `http://localhost:4002`)
3. Start the app:

```bash
npm run dev
```

4. Add the Stripe webhook endpoint:
   - URL: `<APP_URL>/api/webhooks/stripe`
   - For local testing, use the Stripe CLI forwarder.

### Running `sync-stripe`

To import products/prices from Stripe into the DB in bulk:

```bash
npm run sync-stripe
```

Expected successful output example:

- `Sync completed successfully { synced: true, products: <count>, prices: <count> }`

## Troubleshooting

### 1) Signature verification errors (`Webhook signature verification failed`)

Checklist:

- Is `STRIPE_WEBHOOK_SECRET` correct?
- Does the endpoint secret in Stripe match your `.env` value?
- Are you using Stripe CLI forwarding during local development?
- Is request body left unmodified and handled raw? (This project sets `bodyParser: false`.)

### 2) Missing product/price data

Symptoms:

- Plans are missing in the UI, or only partially visible.

Checklist:

- Are products/prices active in Stripe?
- Did you run `npm run sync-stripe`?
- Does `APP_URL` point to a reachable running host?
- Is `STRIPE_SYNC_SECRET` header validation passing?

### 3) Authorization/access errors

Symptoms:

- Errors such as `401`, `403`, or `404 Subscription not found`.

Checklist:

- Does the requesting user have access to the team?
- Does `subscriptionId` actually belong to the active team?
- Are team slug and session valid?

### 4) Sync completes but UI is not updated

Checklist:

- Are webhook events shown as successful in Stripe?
- Are there webhook handler errors in application logs?
- Were related `product/price/subscription/invoice` records written to the DB?
