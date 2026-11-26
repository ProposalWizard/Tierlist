/**
 * app/admin/new-look/page.tsx — the New look preview switch (Leo, 26 Nov 2026).
 * Admins only. The switch is a cookie on this device (lib/siteLook/look.ts);
 * nobody else's site changes.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminTopBar from "@/components/admin/AdminTopBar";
import PageGuide from "@/components/admin/PageGuide";
import NewLookSwitch from "./NewLookSwitch";

export const metadata: Metadata = { title: "New look", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewLookPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/admin/new-look");
  if (!(await isAdmin(user.id))) redirect("/");
  return (
    <>
      <AdminTopBar title="New look" />
      <main className="min-h-screen bg-gray-950 p-4 md:p-8">
        <NewLookSwitch />
      </main>
      <PageGuide page="/admin/new-look" />
    </>
  );
}
