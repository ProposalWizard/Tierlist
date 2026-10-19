/**
 * app/admin/star/g/[group]/page.tsx — one group's own full page (Harry, 19 Oct
 * 2026: "a separate page in full for each sub set of admin pages … rather than
 * a jumbled home page"). Same lock as the admin home (layout + role check).
 */
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { GROUPS, type AdminGroup } from "@/lib/adminRegistry";
import PageGuide from "@/components/admin/PageGuide";
import GroupPage from "./GroupPage";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  if (!GROUPS.some((g) => g.key === group)) notFound();
  let role: "admin" | "tester" = "admin";
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(`/auth?next=/admin/star/g/${group}`);
    const r = await roleOf(user.id);
    if (r === "player") redirect("/");
    role = r;
  }
  return (
    <>
      <GroupPage group={group as AdminGroup} role={role} />
      <PageGuide page="/admin/star" />
    </>
  );
}
