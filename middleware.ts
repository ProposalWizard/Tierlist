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

export async function middleware(request: NextRequest) {
  // Always refresh the session cookie first
  const response = await updateSession(request);

  // ── Route protection ─────────────────────────────────────────────────
  const { pathname } = request.nextUrl;

  // Protect /tierlist/* and /create routes
  if (pathname.startsWith("/tierlist") || pathname.startsWith("/create")) {
    // Read the user from the refreshed cookie
    // (updateSession already called getUser internally, but we need to
    //  check the result here too)
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

    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
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
