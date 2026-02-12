# 🚀 Production Readiness & Local Test Report

This document details the local testing of the **Saas Starter Kit** project in "Production Mode" and the go-live (Go-Live) processes.

**Last Updated:** February 12, 2026

---

## 🏗️ 1. Current Architecture and Changes

The project is designed in accordance with the **12-Factor App** principles. There is no need for code changes when going live. With the latest improvements, the codebase automatically adapts to both HTTP (Local) and HTTPS (Live) environments.

### Critical Fixes and Security Warnings

The following changes have been applied to enable **Local Production Testing**. While the system will function in this state when going live, it is recommended to manage them via environment variables for **maximum security**.

All these settings are now managed via **Environment Flags**. No code changes are required; you only need to edit the `.env` file.

1.  **HSTS (`ENABLE_HSTS`)**
    - **Local:** `false` (to avoid HTTP errors)
    - **Live:** `true` (to force all traffic to HTTPS)

2.  **CSP - Strict (`ENABLE_CSP_STRICT`)**
    - **Local:** `false` (to prevent Upgrade-Insecure-Requests from blocking)
    - **Live:** `true` (for extra XSS protection)

3.  **Isolation (`ENABLE_COEP`)**
    - **Local:** `false` (to prevent external images from causing CORS errors)
    - **Live:** `true` (for Spectre protection - _Note: Ensure your external resources support CORP_)

4.  **NextAuth (`NEXTAUTH_TRUST_HOST` & `NEXTAUTH_DEBUG`)**
    - **Local:** `true` (to avoid Host errors and view logs)
    - **Live:** `false` (for host security and log privacy)

---

## 🧪 2. Local Production Test Guide

Unlike development mode (`npm run dev`), follow these steps to simulate a live environment:

### Commands

Before running the build command, ensure all environment variables are correctly configured in your `.env` or `.env.local` file. This is crucial as some Next.js configurations are baked in during the build process.

```bash
# 1. Build the Project
npm run build

# 2. Prepare the Database (If necessary)
npx prisma migrate deploy

# 3. Start the Production Server
npm run start -- --port 4002

# 4. Sync Stripe Plans (Only for the first setup)
npm run sync-stripe
```

### Scenarios to Test

| Feature              | Expected Result                             | Notes                                                             |
| :------------------- | :------------------------------------------ | :---------------------------------------------------------------- |
| **Login / Register** | Successful login and Dashboard redirection. | Must have a valid Client ID in the `.env` file for Google/GitHub. |
| **Team Creation**    | Create a team without errors.               | Clear HSTS cache if you receive `ERR_SSL_PROTOCOL_ERROR`.         |
| **Stripe Plans**     | Plans should appear on the Pricing page.    | Run the `sync-stripe` command if they don't appear.               |
| **Profile Images**   | Avatars should load without issues.         | Check COEP settings if there are broken images.                   |

---

## 🚀 3. Go-Live Checklist

Do not make code changes when deploying the project to Vercel, AWS, or any other server. Simply configure the following Environment Variables.

### 📝 Mandatory Environment Variables

```ini
# URL Settings
# NEXTAUTH_URL: Required by NextAuth.js for OAuth callbacks
# APP_URL: Used by the application for generating links
NEXTAUTH_URL=https://your-live-domain.com
APP_URL=https://your-live-domain.com

# Database (Production DB Link)
# Use connection pooling for production:
# - Prisma Data Proxy, or
# - External pooler like PgBouncer
# - Set connection_limit parameter appropriatelyß
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require&connection_limit=10

# NextAuth Security
NEXTAUTH_SECRET= (A strong secret generated with: openssl rand -base64 32)

# OAuth Providers (Live Settings)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Stripe (Live Keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Security Flags (Recommended Production Values)
ENABLE_HSTS=true                 # Forces HTTPS
ENABLE_CSP_STRICT=true           # Extra XSS protection
ENABLE_COEP=true                 # Spectre protection (Isolation)
NEXTAUTH_TRUST_HOST=false        # For host security
NEXTAUTH_DEBUG=false             # Disable debug logs in prod
```

### 🔐 Security Best Practices

- **Never commit `.env` files**: Use `.gitignore` to ensure secrets stay local.
- **Use Platform Secret Managers**: In production (Vercel, AWS, GCP), use the platform's provided environment variable management instead of flat files.
- **Rotate Secrets Periodically**: Regularly update `NEXTAUTH_SECRET`, OAuth secrets, and Stripe keys.
- **Principle of Least Privilege**: Ensure your database user only has the permissions required for the application to function.

### ⚠️ Important Considerations

1.  **Callback URLs:** Don't forget to update the "Callback URL" in the Google and GitHub Developer Consoles to `https://domain.com/api/auth/callback/google`.
2.  **Database Migration:** Run the `npx prisma migrate deploy` command before or during the deployment process to update the live database schema.
3.  **Stripe Sync:** Set up **Stripe Webhooks** immediately after going live or trigger the `/api/admin/stripe/sync` endpoint once for the live database.

---

With this structure, your project is ready for a **Scalable** and **Secure** release. 🚀
