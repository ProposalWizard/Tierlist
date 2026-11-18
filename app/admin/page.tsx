/**
 * app/admin/page.tsx — THE ADMIN HOME (Harry, 12 Nov 2026, recording 17:34:
 * "there should be a home page for the admin … the team board being the home
 * page of the admin doesn't really make sense … we have no kind of hub").
 *
 * One big tile per area (Team, Road to Ballon d'Or, Website games, Studio,
 * Marketing, Videos) and a small "what changed" (the live site and the last
 * pushes). Every way into the admin lands here; every back arrow inside the
 * admin ends here (lib/adminRegistry.ts backFor). Admins and testers; testers
 * see only their tiles. A local dev build lets everyone in as an admin.
 *
 * The tierlist "Site content" page that used to live here is /admin/site-content.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import PageGuide from "@/components/admin/PageGuide";
import AdminHub from "./AdminHub";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminHubPage() {
  let role: "admin" | "tester" = "admin";
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth?next=/admin");
    const r = await roleOf(user.id);
    if (r === "player") redirect("/");
    role = r;
  }
  return (
    <>
      <AdminHub role={role} />
      <PageGuide page="/admin" />
    </>
  );
}
