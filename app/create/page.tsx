/**
 * app/create/page.tsx
 *
 * Auth-required page for creating a new playable tierlist.
 * The user gives it a title, uploads images, and saves.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import CreateTierlistForm from "@/components/CreateTierlistForm";

export const metadata: Metadata = {
  title: "Create Tierlist",
  description: "Upload images and save a new playable tierlist.",
};

export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/create");
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <header className="mb-8">
        <Link href="/" className="text-sm text-gray-400 transition-colors hover:text-white">
          ← Back to Home
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl">Create New Tierlist</h1>
        <p className="mt-1 text-sm text-gray-400">
          Give it a name, add your images, then save. Others can then play it from the homepage.
        </p>
      </header>

      <div className="max-w-2xl">
        <CreateTierlistForm />
      </div>
    </main>
  );
}
