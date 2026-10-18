/**
 * DevGate — the one lock on every admin and test page (Harry, 15–18 Oct 2026,
 * admin plan §8 "DevGate"). Each page's folder has a layout.tsx that renders
 * <DevGate url="/the-page">; who may open it comes from lib/adminRegistry.ts:
 *   access "admin" → admins only
 *   access "team"  → admins and testers
 *   access "open"  → everyone
 * Signed out → sign in, then straight back. Signed in but not allowed → "Team
 * only". A local build that allows offline dev play (lib/star/devMode.ts) lets
 * everyone in, as AdminOnly/TesterOnly did. Server-side: a page that is not
 * allowed never reaches the browser.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isTester } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { pageFor } from "@/lib/adminRegistry";

export default async function DevGate({ url, children }: { url: string; children: React.ReactNode }) {
  const access = pageFor(url)?.access ?? "admin"; // a page missing from the list is admins only
  if (access === "open" || offlineDevPlayEnabled()) return <>{children}</>;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { userId = null; }
  if (!userId) redirect(`/auth?next=${encodeURIComponent(url)}`);
  let ok = false;
  try { ok = access === "admin" ? await isAdmin(userId) : await isTester(userId); } catch { ok = false; }
  if (ok) return <>{children}</>;
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-black">Team only</h1>
      <p className="text-sm opacity-70">This page is for the Knowitball team{access === "team" ? " and our testers" : ""}.</p>
      <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold">Back to Knowitball</Link>
    </main>
  );
}
