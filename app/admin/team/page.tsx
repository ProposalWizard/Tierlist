/**
 * app/admin/team/page.tsx — the team board (Harry, 18 Oct 2026).
 *
 * Admins only (TB-Q4). ?tab=notes opens the Patch notes tab; &v=0.55 opens
 * that version. ?tab=ideas | chat | todo opens that part of the Team room. A local dev build lets everyone in, like AdminOnly.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import PageGuide from "@/components/admin/PageGuide";
import TeamBoard from "./TeamBoard";

export const metadata: Metadata = { title: "Team board", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams?: { tab?: string; v?: string } }) {
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth?next=/admin/team");
    if (!(await isAdmin(user.id))) redirect("/");
  }
  const t = searchParams?.tab;
  const tab = t === "notes" || t === "ideas" || t === "chat" || t === "todo" ? t : "team";
  return (
    <>
      <TeamBoard initialTab={tab} initialVersion={searchParams?.v} />
      <PageGuide page="/admin/team" />
    </>
  );
}
