/**
 * app/auth/page.tsx
 * Server Component wrapper for the auth page.
 * If a user is already logged in, redirect them immediately.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already logged in – go to the tierlist
  if (user) {
    redirect("/tierlist/premier-league-2024");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* App branding */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            ⚽ Football Tierlist
          </h1>
          <p className="mt-2 text-gray-400">
            Sign in to build and save your player rankings
          </p>
        </div>

        {/* Client Component that handles sign-up / login form logic */}
        <AuthForm />
      </div>
    </main>
  );
}
