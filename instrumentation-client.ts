
/**
 * ERROR MONITORING — browser side. Named `instrumentation-client.ts`, not
 * `sentry.client.config.ts` — that's Next.js's own client-instrumentation
 * file convention as of Sentry's current Next.js SDK, and required for
 * Turbopack (the old filename is webpack-only).
 *
 * `draft_records_full_fix.sql` (see CLAUDE.md's Pending Migrations table) is
 * the reason this exists: a CHECK-constraint mismatch silently rejected
 * every Career Records insert for months, caught only by a server-side
 * `console.error` nobody was watching. Sentry is what should have caught
 * that on day one.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` isn't committed — set it in Vercel once a Sentry
 * project exists for this app (Sentry dashboard → Projects → Create Project
 * → Next.js). `enabled` is false whenever it's unset, so local dev and any
 * environment without the variable behaves exactly as before this file
 * existed — no console noise, no failed network calls.
 */
// Fetched only when a DSN is set, and after the page has started (speed
// job D, 9 Oct 2026). With no DSN — today — not a byte of the Sentry SDK is
// downloaded; it used to ride in every page's first download, switched off.
// The cost once it is on: an error in the page's first moment, before the SDK
// arrives, is not reported.
type SentryModule = typeof import("@sentry/nextjs");
let sentry: SentryModule | null = null;
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((S) => {
    S.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: true,
      // Sampled, not exhaustive — a free/small Sentry plan has a monthly event
      // quota, and a trace on every request would burn through it fast on a
      // multi-page-view site like this one.
      tracesSampleRate: 0.2,
    });
    sentry = S;
  });
}

// Required by the SDK for it to instrument App Router client-side page
// transitions (a Next.js router.push doesn't reload the page, so nothing
// else here would tell Sentry a "navigation" happened).
export const onRouterTransitionStart: SentryModule["captureRouterTransitionStart"] = (...args) =>
  sentry?.captureRouterTransitionStart(...args);
