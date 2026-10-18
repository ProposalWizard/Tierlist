/**
 * app/admin/star/page.tsx — the admin home (Harry, 18 Oct 2026).
 *
 * Admins and testers (ADM-Q97/Q103): testers see only the pages they can
 * open. Signed out → sign in and come back. A local dev build lets everyone
 * in as an admin, like AdminOnly.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import PageGuide from "@/components/admin/PageGuide";
import AdminHome from "./AdminHome";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminStarPage() {
  let role: "admin" | "tester" = "admin";
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth?next=/admin/star");
    const r = await roleOf(user.id);
    if (r === "player") redirect("/");
    role = r;
  }
  return (
    <>
      <AdminHome role={role} />
      <PageGuide page="/admin/star" />
    </>
  );
}
