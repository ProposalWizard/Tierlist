/**
 * app/auth/page.tsx
 * Server Component wrapper for the auth page.
 * If a user is already logged in, redirect them immediately.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Knowitball Tierlists to create, save, and share your football tier rankings.",
  robots: { index: false, follow: false },
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already logged in – go where they were heading (same open-redirect check
  // as /auth/callback: only a relative path, never "//" or a backslash trick),
  // else the home page. The game's Home Screen app reloads /auth?next=/star-dev.
  if (user) {
    const raw = typeof searchParams?.next === "string" ? searchParams.next : "/";
    const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/";
    redirect(next);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* App branding */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            ⚽ Football Tierlist
          </h1>
          <p className="mt-2 text-white">
            Sign in to build and save your player rankings
          </p>
        </div>

        {/* Client Component that handles sign-up / login form logic */}
        <AuthForm />
      </div>
    </main>
  );
}
