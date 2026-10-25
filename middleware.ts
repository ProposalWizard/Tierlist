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
  // One login check per request (was two: updateSession asked Supabase, then
  // this file built a second client and asked again). updateSession refreshes
  // the cookie and says who is signed in.
  const { response, userId } = await updateSession(request);
  const user = userId ? { id: userId } : null;

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/tierlist") || pathname.startsWith("/create")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (user && !shouldSkipUsernameCheck(pathname)) {
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
    // Also skips the game's own files in public/star, public/sfx and public/models
    // (3D models, sounds, music, JSON): plain files that need no login check.
    // No page lives under those three paths (/star-dev is "star-", not "star/").
    "/((?!_next/static|_next/image|favicon.ico|star/|sfx/|models/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
