/**
 * app/admin/videos/page.tsx — Videos tab (Harry, 18 Oct 2026: "add this as a
 * separate tab in admin"). How to hand a video to Claude. The breakdown itself
 * runs in a Claude chat (scripts/screen-video, skill screen-video), not on
 * the site. Admins and testers.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import PageGuide from "@/components/admin/PageGuide";
import VideosTab from "./VideosTab";

export const metadata: Metadata = { title: "Videos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VideosPage() {
  let role: "admin" | "tester" = "admin";
  if (!offlineDevPlayEnabled()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/auth?next=/admin/videos");
    const r = await roleOf(user.id);
    if (r === "player") redirect("/");
    role = r;
  }
  return (
    <>
      <VideosTab role={role} />
      <PageGuide page="/admin/videos" />
    </>
  );
}
