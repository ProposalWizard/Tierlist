/**
 * app/page.tsx — Home / landing page.
 *
 * Logged-in users are sent straight to the tierlist.
 * Logged-out users see a sign-in prompt.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Send authenticated users straight to the board
  if (user) {
    redirect("/tierlist");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-center">
      <h1 className="text-4xl font-bold text-white mb-3">
        Tierlist Maker
      </h1>
      <p className="text-gray-400 text-lg mb-8 max-w-md">
        Upload any images you like, then drag and drop them into S, A, B, C,
        and D tiers.
      </p>
      <Link
        href="/auth"
        className="inline-block rounded-xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white hover:bg-indigo-500 transition-colors"
      >
        Sign in to get started
      </Link>
    </main>
  );
}
