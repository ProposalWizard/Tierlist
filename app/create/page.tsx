/**
 * app/create/page.tsx
 *
 * Auth-required page for creating a new playable tierlist.
 * Shows a blank tierlist board where the user can add images,
 * reorder tiers, and customise rows before hitting "Upload Tierlist"
 * to publish it to the homepage.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import TierlistBoardLoader from "./TierlistBoardLoader";

export const metadata: Metadata = {
  title: "Create Tierlist",
  description: "Build your own football tierlist. Add player images, customise tiers, then publish it for the community to play.",
  robots: { index: false, follow: false },
};

export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/create");
  }

  const userIsAdmin = await isAdmin(user.id);

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          Create New Tierlist
        </h1>
        <p className="mt-1 text-sm text-white">
          Add images, arrange the tiers, then press{" "}
          <span className="font-semibold text-indigo-400">Upload Tierlist</span>{" "}
          to publish it to the homepage.
        </p>
      </header>

      <TierlistBoardLoader mode="create" isAdmin={userIsAdmin} />
    </main>
  );
}
