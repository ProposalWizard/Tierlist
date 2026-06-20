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
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const svc = createServiceClient();
        await svc.from("user_profiles").upsert(
          { user_id: user.id },
          { onConflict: "user_id", ignoreDuplicates: true }
        );
        const { data: profile } = await svc
          .from("user_profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile?.username) {
          const setupUrl = new URL("/setup-username", origin);
          setupUrl.searchParams.set("next", next);
          return NextResponse.redirect(setupUrl.toString());
        }
      }
      const resp = NextResponse.redirect(`${origin}${next}`);
      resp.cookies.set("has-username", "1", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
      return resp;
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
