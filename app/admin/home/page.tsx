/**
 * app/admin/home/page.tsx — the admin's front door (Harry, 20 Oct 2026: "the
 * team area should be the default home area, and it should open on Team
 * board"). It shows nothing: it sends each person to their own home.
 *   admin or tester → the admin home, /admin (since 12 Nov 2026: Harry
 *   wanted a hub, not the Team board, as the admin's home)
 *   anyone else → the site; signed out → sign in, then back here.
 * Used where the link cannot know who is opening it: the KIB Admin
 * home-screen app (public/admin-app.webmanifest start_url). A local dev build
 * lets everyone in as an admin, like the rest of the admin.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { ADMIN_FRONT_DOOR, adminHomeFor } from "@/lib/adminRegistry";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminFrontDoor() {
  if (offlineDevPlayEnabled()) redirect(adminHomeFor("admin"));
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { userId = null; }
  if (!userId) redirect(`/auth?next=${encodeURIComponent(ADMIN_FRONT_DOOR)}`);
  const role = await roleOf(userId);
  redirect(role === "player" ? "/" : adminHomeFor(role));
}
