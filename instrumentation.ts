import * as Sentry from "@sentry/nextjs";

/**
 * Next.js's instrumentation hook — the one place that can tell which
 * runtime (Node.js vs edge, i.e. middleware.ts) is starting up, so the
 * matching Sentry config loads instead of both unconditionally.
 * Requires `experimental.instrumentationHook` in next.config.mjs on
 * Next.js 14 (stable without the flag from 15 on).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
