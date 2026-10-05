/**
 * app/admin/testers/page.tsx — Tester access (Harry, 5 Oct 2026).
 *
 * Make tester links, switch them off, and see and remove testers. Gated like
 * the other admin pages: a server component that checks the session and
 * isAdmin() and redirects everyone else.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import PageGuide from "@/components/admin/PageGuide";
import TestersAdmin from "./TestersAdmin";

export const metadata: Metadata = {
  title: "Tester Access",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function TestersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin/testers");
  if (!(await isAdmin(user.id))) redirect("/");

  return (
    <>
      <TestersAdmin />
      <PageGuide page="/admin/testers" />
    </>
  );
}
