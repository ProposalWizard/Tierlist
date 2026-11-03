"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { PostHog } from "posthog-js";
import { analyticsAllowed, COOKIE_CONSENT_EVENT } from "@/lib/cookieConsent";

/**
 * posthog-js (about 60 KB zipped) is fetched after the page is up, not as
 * part of every page's first download (speed job D, 9 Oct 2026). Nothing in
 * the app reads PostHog through React context, so the React provider was
 * dropped with it. With no key set it is never fetched at all.
 */
let client: Promise<PostHog | null> | null = null;
export function posthogClient(): Promise<PostHog | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return Promise.resolve(null);
  // Only after a yes to cookies (lib/cookieConsent.ts, UK PECR): until then
  // posthog-js is not even fetched, and every capture is dropped.
  if (!analyticsAllowed()) return Promise.resolve(null);
  if (!client) {
    client = import("posthog-js").then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(key, {
          // The project's own ingest host (PostHog project settings: api_host).
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
          person_profiles: "identified_only",
          capture_pageview: false,
        });
      }
      return posthog;
    }, () => { client = null; return null; });
  }
  return client;
}

/**
 * ANALYTICS
 *
 * The engagement-SQL task earlier turned up real gaps — Ten-A-Ball plays and
 * /rankings visits have no tracking at all, and everything else was
 * reconstructed from raw Supabase tables by hand each time. PostHog replaces
 * that with real, queryable product analytics, but only once this file
 * actually ships the tracking snippet — connecting the account on its own
 * captures nothing.
 *
 * `NEXT_PUBLIC_POSTHOG_KEY` is the project's public API key (safe to expose
 * client-side by design — same class of value as a GA measurement ID, not a
 * secret) and `NEXT_PUBLIC_POSTHOG_HOST` is the region host (this project's
 * PostHog org is on the EU cloud: eu.posthog.com). Neither is committed here
 * — set both in Vercel's project environment variables. Missing either one
 * disables tracking entirely rather than throwing, so local dev and preview
 * builds without them still work exactly as before this file existed.
 *
 * App Router has no router-change events the pages-router integration relies
 * on, so pageviews are captured manually by `PostHogPageView` below, per
 * PostHog's own Next.js App Router guidance — `capture_pageview: false` here
 * to avoid double-counting the initial load.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !pathname) return;
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    void posthogClient().then((ph) => ph?.capture("$pageview", { $current_url: url }));
    // A yes on this page counts this page; a later no stops everything.
    const onChoice = (e: Event) => {
      const v = (e as CustomEvent<string | null>).detail;
      if (v === "yes") void posthogClient().then((ph) => { ph?.opt_in_capturing(); ph?.capture("$pageview", { $current_url: url }); });
      else if (client) void client.then((ph) => ph?.opt_out_capturing());
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onChoice);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return null;
}
