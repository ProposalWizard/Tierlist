/**
 * middleware.ts  (Next.js root middleware)
 *
 * Runs on every request BEFORE the page/route handler.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie so users stay logged in
 *     across requests without needing a page reload.
 *  2. Protect /tierlist/* routes – redirect unauthenticated visitors
 *     to /auth.
 *
 * The actual session-refresh logic lives in lib/supabase/middleware.ts
 * to keep this file clean.
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { guestAccountsOn } from "@/lib/guest/config";
import { campaignFor } from "@/lib/campaigns";

const SKIP_USERNAME_PREFIXES = [
  "/setup-username",
  "/auth",
  "/api",
  "/legal",
];

function shouldSkipUsernameCheck(pathname: string): boolean {
  for (let i = 0; i < SKIP_USERNAME_PREFIXES.length; i++) {
    const prefix = SKIP_USERNAME_PREFIXES[i];
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  const { createServerClient } = await import("@supabase/ssr");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guest accounts (lib/guest/config.ts): a guest is a real Supabase user with
  // is_anonymous set. Everywhere outside Road to Ballon d'Or it counts as
  // signed out: no tierlist making, no username screen. With the switch off
  // no guest can exist, so this changes nothing today.
  const guest = user?.is_anonymous === true;

  // Ad landing pages: /play/<campaign> shows app/campaign/[campaign] (the
  // address stays /play/...). Only for a slug in lib/campaigns.ts, so a
  // tierlist at /play/<id> is untouched; switch off = a 404 as before.
  if (guestAccountsOn()) {
    const m = /^\/play\/([a-z0-9-]+)\/?$/.exec(pathname);
    if (m && campaignFor(m[1])) {
      const url = request.nextUrl.clone();
      url.pathname = `/campaign/${m[1]}`;
      const rewritten = NextResponse.rewrite(url);
      response.cookies.getAll().forEach((c) => rewritten.cookies.set(c));
      return rewritten;
    }
  }

  if (pathname.startsWith("/tierlist") || pathname.startsWith("/create")) {
    if (!user || guest) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (user && !guest && !shouldSkipUsernameCheck(pathname)) {
    const hasUsernameCookie = request.cookies.get("has-username")?.value === "1";
    if (!hasUsernameCookie) {
      const { createClient: createServiceClient } = await import("@supabase/supabase-js");
      const svc = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      const { data: profile } = await svc
        .from("user_profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.username) {
        response.cookies.set("has-username", "1", {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
          path: "/",
        });
      } else {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/setup-username";
        redirectUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return response;
}

// Tell Next.js which paths this middleware should run on.
// Skip static files and Next internals to avoid unnecessary overhead.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
