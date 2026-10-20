/**
 * app/admin/star/game/[game]/page.tsx — one game's admin home (Harry, 19 Oct
 * 2026: "stuff on the wider website should be on a completely different tab
 * than road to ballon dor stuff"). Any game in lib/adminRegistry.ts's GAMES
 * opens here; the first game is also /admin/star. Same lock as the admin home.
 */
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { GAMES, type AdminGameKey } from "@/lib/adminRegistry";
import PageGuide from "@/components/admin/PageGuide";
import AdminHome from "../../AdminHome";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const g = GAMES.find((x) => x.key === game);
  if (!g) notFound();
  // The first game's home is /admin/star itself, so there is one address for it.
  if (g.key === GAMES[0].key) redirect("/admin/star");
  let role: "admin" | "tester" = "admin";
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/auth?next=/admin/star/game/${game}`);
    const r = await roleOf(user.id);
    if (r === "player") redirect("/");
    role = r;
  }
  return (
    <>
      <AdminHome role={role} game={g.key as AdminGameKey} />
      <PageGuide page="/admin/star" />
    </>
  );
}
