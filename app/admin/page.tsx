/**
 * app/admin/page.tsx
 *
 * Admin dashboard — only accessible to users with is_admin = true
 * in the user_roles table.  Redirects everyone else.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import nextDynamic from "next/dynamic";
const AdminPanel = nextDynamic(() => import("@/components/AdminPanel"), { ssr: false });
import type { Tierlist } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin");
  if (!(await isAdmin(user.id))) redirect("/");

  // Fetch all tierlists (service role so we always get everything)
  const service = createServiceClient();
  const { data: tierlists } = await service
    .from("tierlists")
    .select("id, title, category, cover_image_url, created_at, created_by, slug")
    .order("created_at", { ascending: false })
    .returns<Tierlist[]>();

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white md:text-3xl">Admin Panel</h1>
          <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
            ADMIN
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Manage all tierlists — edit titles, categories, cover photos, remove images, or delete tierlists entirely.
        </p>
      </header>

      <AdminPanel initialTierlists={tierlists ?? []} />
    </main>
  );
}
