/**
 * app/api/auth/signout/route.ts
 *
 * POST /api/auth/signout
 *
 * Signs the user out server-side (clears the Supabase session cookie)
 * and redirects to /auth.
 *
 * Called by the sign-out form in app/tierlist/[topic]/page.tsx.
 * Using a POST form avoids GET-based CSRF issues.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/", origin));
}
