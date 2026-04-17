/**
 * app/profile/page.tsx
 *
 * User profile: username/anonymous settings, login streak,
 * created tierlists (with views + delete), saved tierlists, liked tierlists.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  title: "Profile",
  description: "View your created tierlists, saved rankings, likes, and login streak.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/profile");

  // Upsert profile row on first visit
  await supabase.from("user_profiles").upsert(
    { user_id: user.id },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  // Update login streak (RPC skips if already updated today)
  await supabase.rpc("update_login_streak", { p_user_id: user.id });

  // Fetch all data in parallel
  const [profileRes, createdRes, likedRes, savedRes, savedImagesRes] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user.id).single(),

    supabase
      .from("tierlists")
      .select("id, title, category, cover_image_url, view_count, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("tierlist_likes")
      .select("tierlist_id, tierlists(id, title, cover_image_url, created_at, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("saved_tierlists")
      .select("tierlist_id, tierlists(id, title, cover_image_url, created_at, category)")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false }),

    supabase
      .from("saved_profile_images")
      .select("id, image_url, tierlist_title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile      = profileRes.data;
  const created      = createdRes.data ?? [];
  const likedRaw     = (likedRes.data ?? []) as unknown as Array<{ tierlist_id: string; tierlists: { id: string; title: string; cover_image_url: string | null; created_at: string; category: string } | null }>;
  const savedRaw     = (savedRes.data ?? []) as unknown as Array<{ tierlist_id: string; tierlists: { id: string; title: string; cover_image_url: string | null; created_at: string; category: string } | null }>;

  const liked  = likedRaw.map((r) => r.tierlists).filter(Boolean) as { id: string; title: string; cover_image_url: string | null; created_at: string; category: string }[];
  const saved  = savedRaw.map((r) => r.tierlists).filter(Boolean) as { id: string; title: string; cover_image_url: string | null; created_at: string; category: string }[];
  const savedImages = (savedImagesRes.data ?? []) as { id: string; image_url: string; tierlist_title: string | null; created_at: string }[];

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">My Profile</h1>
      </header>

      <ProfileClient
        userEmail={user.email ?? ""}
        profile={profile}
        created={created}
        liked={liked}
        saved={saved}
        savedImages={savedImages}
      />
    </main>
  );
}
