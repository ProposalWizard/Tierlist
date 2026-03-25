/**
 * app/auth/callback/route.ts
 *
 * Supabase OAuth / Magic Link callback handler.
 * After the user clicks their magic-link email, Supabase redirects
 * here with a `code` query param.  We exchange it for a session
 * and then redirect the user to the tierlist.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  // Optional: a `next` param lets you deep-link post-login
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful login – redirect to the app
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong – send back to auth with an error flag
  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
