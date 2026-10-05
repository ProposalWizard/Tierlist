/**
 * Wraps a test page so admins AND testers can open it.
 *
 * Harry, 5 Oct 2026: "a 'tester access' link and accounts that we will use
 * for our testers to be able to have god mode too". Only for pages that just
 * play the game and write nothing anyone else sees. A page that saves or
 * commits shared data (scenarios, lineups, live rooms) stays on AdminOnly.
 *
 * A local build that allows offline dev play (lib/star/devMode.ts) lets
 * everyone in, as AdminOnly does. Before tester_access.sql is run nobody is a
 * tester, so this behaves exactly like AdminOnly.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isTester } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

export default async function TesterOnly({ children }: { children: React.ReactNode }) {
  if (offlineDevPlayEnabled()) return <>{children}</>;
  let ok = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    ok = !!user && (await isTester(user.id));
  } catch {
    ok = false;
  }
  if (ok) return <>{children}</>;
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-black">Testers only</h1>
      <p className="text-sm opacity-70">This is a test page for the Knowitball team and our testers.</p>
      <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold">Back to Knowitball</Link>
    </main>
  );
}
