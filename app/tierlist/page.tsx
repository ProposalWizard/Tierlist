/**
 * app/tierlist/page.tsx
 *
 * The main tierlist page. Auth-required, fully client-side board.
 * No pre-loaded players — the user adds their own images via "Add Images".
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TierlistBoard from "@/components/TierlistBoard";

export const metadata: Metadata = {
  title: "My Tierlist",
  description: "Upload images and rank them into S, A, B, C, D tiers.",
};

export default async function TierlistPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/tierlist");
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/tierlists"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Tierlists
          </Link>

          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="hidden md:inline">{user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white md:text-3xl">
          My Tierlist
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Add images below, then drag them into a tier.
        </p>
      </header>

      <TierlistBoard />
    </main>
  );
}
