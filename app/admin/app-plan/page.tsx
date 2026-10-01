/**
 * app/admin/app-plan/page.tsx
 *
 * The App Plan — everything about turning the site into iPhone and Android
 * apps, with the questions still waiting on Harry. Asked for directly (30 Sep
 * 2026): "instead of a normal patch notes page put all of this app stuff as
 * an artifact in the admin section — with all the questions".
 *
 * The page itself is kept in the repo (patch-notes/pages/app-plan/) and shown
 * through the same admin-only frame as the patch-notes archive. Gated the
 * same way as app/admin/patch-notes/page.tsx.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { PageFrame } from "../patch-notes/PatchNotesArchive";
import PageGuide from "@/components/admin/PageGuide";

export const metadata: Metadata = {
  title: "App Plan",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AppPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/app-plan");
  if (!(await isAdmin(user.id))) redirect("/");

  return (
    <div className="min-h-screen bg-[#0b100e] px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <PageFrame pageKey="app-plan" label="Knowitball App Plan" artifactUrl="https://claude.ai/artifact/3pchCut75tjhk7RP1XLMPa" />
      </div>
      <PageGuide page="/admin/app-plan" />
    </div>
  );
}
