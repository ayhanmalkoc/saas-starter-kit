# Pricing & Billing Implementation Guide

This document outlines the architecture, setup, and testing procedures for the **Hybrid Free Plan** and **Pricing Page** implementation in the SaaS Starter Kit.

## Architecture: Hybrid Free Plan & Stripe

We utilize a **Hybrid Approach** to manage Free Plans efficiently:

1.  **Stripe Side:**
    - A "Free Plan" product exists in the Stripe Product Catalog ($0/month, $0/year) solely for display purposes on the Pricing Page.
    - **Crucially:** Users on the Free Plan do **NOT** have a corresponding Customer or Subscription object in Stripe. This prevents cluttering the Stripe dashboard with non-paying users and reduces API usage.

2.  **Database Side:**
    - When a user signs up, they have no record in the `Subscription` table.
    - The application logic interprets a `null` or inactive subscription as being on the **Free Plan**.

3.  **Application Logic:**
    - **Status:** "No Subscription" = "Free Plan".
    - **Upgrade:** Clicking "Upgrade" initiates the creation of a Stripe Customer and a Checkout Session.
    - **Downgrade:** Canceling a paid subscription reverts the user to the Free Plan state (after the period ends).

## Setup & Configuration

To set up the pricing products in a fresh environment (or after a reset), use the provided scripts.

### 1. Prerequisites

Ensure your `.env` file is configured with:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`

### 2. Seeding Stripe Products

We use idempotent scripts to ensure no duplicate products are created.

```bash
# 1. Create Paid Plans (Personal & Business)
node scripts/setup-stripe-products.js

# 2. Create the Free Plan (Catalog only)
npx tsx scripts/create-free-plan.ts
```

### 3. Syncing with Database

After creating products in Stripe, sync them to your local PostgreSQL database.

```bash
npx tsx scripts/manual-sync.ts
```

### 4. Cleanup (Optional)

To archive all products in Stripe (e.g., for a complete reset) or delete already archived ones:

```bash
# Archive all active products
npx tsx scripts/cleanup-stripe.ts

# Delete all archived products (Cleanup)
npx tsx scripts/delete-archived-products.ts
```

## E2E Testing Guide

Follow these steps to manually verify the pricing and billing flow.

### Step 1: Environment Reset (Clean Slate)

```bash
docker-compose down -v
docker-compose up -d
npx prisma db push
npx prisma db seed
# Run Setup & Sync scripts from Section 2 & 3 above
```

### Step 2: Verify Pricing Page

1.  Navigate to `/pricing` (Public page).
2.  Verify **Personal** and **Business** tabs.
3.  Verify the **Free Plan** is listed ($0).
4.  Toggle **Monthly/Yearly** and check price updates.

### Step 3: Sign Up (Free Plan Entry)

1.  Click "Get Started" on the Free Plan or "Sign Up" in the navbar.
2.  Create a new account.
3.  **Verification:** You should NOT be redirected to Stripe. You should land on the dashboard.

### Step 4: Verify Billing State

1.  Navigate to `/teams/[slug]/billing`.
2.  **Expected:**
    - Current Plan: **Free Plan** (or "No active subscription").
    - No payment methods listed.
    - "Change Plan" button is visible.

### Step 5: Upgrade to Paid Plan

1.  Click "Change Plan" -> Redirects to `/pricing`.
2.  Select a Paid Plan (e.g., Personal Pro).
3.  Complete payment in Stripe Checkout (use Test Card: `4242 4242 4242 4242`).
4.  **Verification:**
    - Redirected back to Billing.
    - Current Plan updates to "Personal Pro".
    - Payment method is saved.
