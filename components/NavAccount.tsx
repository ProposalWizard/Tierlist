"use client";
/**
 * The top menu's account part: signed in or not, and admin or not, asked by
 * the BROWSER (Mikey, 6 Nov 2026: the site went over Vercel's free 4 hours of
 * server time). GlobalNav used to ask the server on every page, which made
 * every page on the site build per visit. Now pages that need nothing else
 * from the server are built once and served ready-made.
 *
 * Signed in: read from this browser's own login cookie (no server call).
 * Admin: lib/useIsAdmin.ts, which asks the server only for a signed-in person.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import NavMenu from "./NavMenu";
import AdminNavPanel from "./AdminNavPanel";
import ChatBubble from "./teamRoom/ChatBubble";

/** Signed in with a real account (a guest, lib/guest/config.ts, still sees "Sign in"). */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const sb = createClient();
    let live = true;
    sb.auth.getSession().then(({ data }) => {
      if (live) setSignedIn(!!data.session && data.session.user.is_anonymous !== true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s && s.user.is_anonymous !== true));
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}

export default function NavAccount() {
  return <NavMenu isLoggedIn={useSignedIn()} isAdmin={useIsAdmin()} />;
}

/** The admin slide-out and the Team room bubble: admins (and local dev builds) only. */
export function NavAdminTools() {
  const admin = useIsAdmin();
  if (!admin && !offlineDevPlayEnabled()) return null;
  return (
    <>
      <AdminNavPanel />
      <ChatBubble />
    </>
  );
}
