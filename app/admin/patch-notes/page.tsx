/**
 * app/admin/patch-notes/page.tsx
 *
 * The patch notes archive — every shipped version, readable inside the app.
 *
 * Gated exactly the way app/admin/page.tsx gates itself: a server component
 * that reads the session, checks isAdmin() (lib/admin.ts, service-role, so
 * it bypasses RLS), and redirects everyone else. Signed out goes to /auth
 * with a next= back here; signed in but not an admin goes home. No second
 * mechanism, and nothing client-side to flip — a non-admin never receives
 * the archive's markup at all.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import PatchNotesArchive from "./PatchNotesArchive";
import PageGuide from "@/components/admin/PageGuide";

export const metadata: Metadata = {
  title: "Patch Notes",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PatchNotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/patch-notes");
  if (!(await isAdmin(user.id))) redirect("/");

  return (
    <>
      <PatchNotesArchive />
      <PageGuide page="/admin/patch-notes" />
    </>
  );
}
