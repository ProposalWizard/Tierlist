import * as Sentry from "@sentry/nextjs";

/**
 * ERROR MONITORING — edge runtime (middleware.ts runs here). See
 * sentry.client.config.ts for why this exists and why it's inert until
 * NEXT_PUBLIC_SENTRY_DSN is set.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
});
