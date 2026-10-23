/**
 * app/admin/team/page.tsx — the team board (Harry, 18 Oct 2026).
 *
 * Admins only (TB-Q4). ?tab=notes opens the Patch notes tab; &v=0.55 opens
 * that version. ?tab=ideas | chat | todo opens that part of the Team room;
 * ?tab=chat&m=<id> opens the chat on that message (where a phone notification
 * lands). A local dev build lets everyone in, like AdminOnly.
 *
 * Channels (23 Oct 2026): ?tab=chat&ch=ideas opens a channel, &dm=Mikey a
 * private DM, &t=<id> a thread, &v=<version> the patch-notes bot's post.
 *
 * The Team area is the admin's home (Harry, 20 Oct 2026): every way into the
 * admin lands here, on the Team board. A tester has no Team room and goes to
 * their own home (the first game's) instead.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { adminHomeFor } from "@/lib/adminRegistry";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import PageGuide from "@/components/admin/PageGuide";
import TeamBoard from "./TeamBoard";

export const metadata: Metadata = { title: "Team board", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams?: { tab?: string; v?: string; m?: string; ch?: string; dm?: string; t?: string } }) {
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth?next=/admin/team");
    const r = await roleOf(user.id);
    if (r === "tester") redirect(adminHomeFor("tester"));
    if (r !== "admin") redirect("/");
  }
  const t = searchParams?.tab;
  const tab = t === "notes" || t === "ideas" || t === "chat" || t === "todo" ? t : "team";
  return (
    <>
      <TeamBoard initialTab={tab} initialVersion={searchParams?.v} initialMessage={Number(searchParams?.m) > 0 ? Number(searchParams?.m) : null}
        initialPlace={{ ch: searchParams?.ch ?? null, dm: searchParams?.dm ?? null, t: Number(searchParams?.t) > 0 ? Number(searchParams?.t) : null }} />
      <PageGuide page="/admin/team" />
    </>
  );
}
