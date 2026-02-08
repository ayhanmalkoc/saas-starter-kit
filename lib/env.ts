import type { SessionStrategy } from 'next-auth';
import { z } from 'zod';

export const toBooleanEnv = (value: string | undefined): boolean =>
  value === 'true';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_URL: z.string().url('APP_URL must be a valid URL'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),

  SECURITY_HEADERS_ENABLED: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  NEXTAUTH_SESSION_STRATEGY: z.enum(['jwt', 'database']).optional(),

  SVIX_URL: z.string().optional(),
  SVIX_API_KEY: z.string().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  RETRACED_URL: z.string().optional(),
  RETRACED_API_KEY: z.string().optional(),
  RETRACED_PROJECT_ID: z.string().optional(),

  GROUP_PREFIX: z.string().optional(),

  JACKSON_URL: z.string().optional(),
  JACKSON_EXTERNAL_URL: z.string().optional(),
  JACKSON_API_KEY: z.string().optional(),
  JACKSON_PRODUCT_ID: z.string().optional(),
  JACKSON_WEBHOOK_SECRET: z.string().optional(),

  CONFIRM_EMAIL: z.string().optional(),

  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),

  DISABLE_NON_BUSINESS_EMAIL_SIGNUP: z.string().optional(),

  AUTH_PROVIDERS: z.string().optional(),

  OTEL_PREFIX: z.string().optional(),

  HIDE_LANDING_PAGE: z.string().optional(),

  NEXT_PUBLIC_DARK_MODE: z.string().optional(),

  FEATURE_TEAM_SSO: z.string().optional(),
  FEATURE_TEAM_DSYNC: z.string().optional(),
  FEATURE_TEAM_WEBHOOK: z.string().optional(),
  FEATURE_TEAM_API_KEY: z.string().optional(),
  FEATURE_TEAM_AUDIT_LOG: z.string().optional(),
  FEATURE_TEAM_PAYMENTS: z.string().optional(),
  FEATURE_TEAM_DELETION: z.string().optional(),

  RECAPTCHA_SITE_KEY: z.string().optional(),
  RECAPTCHA_SECRET_KEY: z.string().optional(),

  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().optional(),

  SLACK_WEBHOOK_URL: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

const rawEnv = parsedEnv.data;

const env = {
  databaseUrl: rawEnv.DATABASE_URL,
  appUrl: rawEnv.APP_URL,
  redirectIfAuthenticated: '/dashboard',
  securityHeadersEnabled: toBooleanEnv(rawEnv.SECURITY_HEADERS_ENABLED),

  // SMTP configuration for NextAuth
  smtp: {
    host: rawEnv.SMTP_HOST,
    port: rawEnv.SMTP_PORT,
    user: rawEnv.SMTP_USER,
    password: rawEnv.SMTP_PASSWORD,
    from: rawEnv.SMTP_FROM,
  },

  // NextAuth configuration
  nextAuth: {
    secret: rawEnv.NEXTAUTH_SECRET,
    sessionStrategy: (rawEnv.NEXTAUTH_SESSION_STRATEGY ||
      'jwt') as SessionStrategy,
  },

  // Svix
  svix: {
    url: rawEnv.SVIX_URL,
    apiKey: rawEnv.SVIX_API_KEY,
  },

  //Social login: Github
  github: {
    clientId: rawEnv.GITHUB_CLIENT_ID,
    clientSecret: rawEnv.GITHUB_CLIENT_SECRET,
  },

  //Social login: Google
  google: {
    clientId: rawEnv.GOOGLE_CLIENT_ID,
    clientSecret: rawEnv.GOOGLE_CLIENT_SECRET,
  },

  // Retraced configuration
  retraced: {
    url: rawEnv.RETRACED_URL ? `${rawEnv.RETRACED_URL}/auditlog` : undefined,
    apiKey: rawEnv.RETRACED_API_KEY,
    projectId: rawEnv.RETRACED_PROJECT_ID,
  },

  groupPrefix: rawEnv.GROUP_PREFIX,

  // SAML Jackson configuration
  jackson: {
    url: rawEnv.JACKSON_URL,
    externalUrl: rawEnv.JACKSON_EXTERNAL_URL || rawEnv.JACKSON_URL,
    apiKey: rawEnv.JACKSON_API_KEY,
    productId: rawEnv.JACKSON_PRODUCT_ID || 'boxyhq',
    selfHosted: rawEnv.JACKSON_URL !== undefined,
    sso: {
      callback: rawEnv.APP_URL,
      issuer: 'https://saml.boxyhq.com',
      path: '/api/oauth/saml',
      oidcPath: '/api/oauth/oidc',
      idpLoginPath: '/auth/idp-login',
    },
    dsync: {
      webhook_url: `${rawEnv.APP_URL}/api/webhooks/dsync`,
      webhook_secret: rawEnv.JACKSON_WEBHOOK_SECRET,
    },
  },

  // Users will need to confirm their email before accessing the app feature
  confirmEmail: rawEnv.CONFIRM_EMAIL === 'true',

  // Mixpanel configuration
  mixpanel: {
    token: rawEnv.NEXT_PUBLIC_MIXPANEL_TOKEN,
  },

  disableNonBusinessEmailSignup: rawEnv.DISABLE_NON_BUSINESS_EMAIL_SIGNUP === 'true',

  authProviders: rawEnv.AUTH_PROVIDERS || 'github,credentials',

  otel: {
    prefix: rawEnv.OTEL_PREFIX || 'boxyhq.saas',
  },

  hideLandingPage: rawEnv.HIDE_LANDING_PAGE === 'true',

  darkModeEnabled: rawEnv.NEXT_PUBLIC_DARK_MODE !== 'false',

  teamFeatures: {
    sso: rawEnv.FEATURE_TEAM_SSO !== 'false',
    dsync: rawEnv.FEATURE_TEAM_DSYNC !== 'false',
    webhook: rawEnv.FEATURE_TEAM_WEBHOOK !== 'false',
    apiKey: rawEnv.FEATURE_TEAM_API_KEY !== 'false',
    auditLog: rawEnv.FEATURE_TEAM_AUDIT_LOG !== 'false',
    payments:
      rawEnv.FEATURE_TEAM_PAYMENTS === 'false'
        ? false
        : Boolean(rawEnv.STRIPE_SECRET_KEY && rawEnv.STRIPE_WEBHOOK_SECRET),
    deleteTeam: rawEnv.FEATURE_TEAM_DELETION !== 'false',
  },

  recaptcha: {
    siteKey: rawEnv.RECAPTCHA_SITE_KEY || null,
    secretKey: rawEnv.RECAPTCHA_SECRET_KEY || null,
  },

  maxLoginAttempts: rawEnv.MAX_LOGIN_ATTEMPTS || 5,

  slackWebhookUrl: rawEnv.SLACK_WEBHOOK_URL,

  stripe: {
    secretKey: rawEnv.STRIPE_SECRET_KEY,
    webhookSecret: rawEnv.STRIPE_WEBHOOK_SECRET,
  },
};

export default env;
