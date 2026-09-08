"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

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
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: false,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !pathname) return;
    const query = searchParams.toString();
    posthog.capture("$pageview", { $current_url: query ? `${pathname}?${query}` : pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return null;
}
