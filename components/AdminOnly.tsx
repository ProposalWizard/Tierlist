/**
 * Wraps a test or tool page so only admins can open it.
 *
 * Harry, 5 Oct 2026: "We need to lock the doors on the settings and the admin
 * stuff." The code audit (3 Oct) found 20 test pages anyone could open by
 * typing the address. Each one's layout.tsx now renders through this.
 *
 * A local build that allows offline dev play (lib/star/devMode.ts: `next dev`,
 * the sandbox, the playtest and filming agents) lets everyone in, as before.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

export default async function AdminOnly({ children }: { children: React.ReactNode }) {
  if (offlineDevPlayEnabled()) return <>{children}</>;
  let ok = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    ok = !!user && (await isAdmin(user.id));
  } catch {
    ok = false;
  }
  if (ok) return <>{children}</>;
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-black">Admins only</h1>
      <p className="text-sm opacity-70">This is a test page for the Knowitball team.</p>
      <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold">Back to Knowitball</Link>
    </main>
  );
}
