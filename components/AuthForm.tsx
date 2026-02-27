"use client";

/**
 * components/AuthForm.tsx
 *
 * Client Component for sign-up and login.
 *
 * Uses email + password auth via Supabase.
 * Toggling between "Sign In" and "Sign Up" is handled locally.
 *
 * On success:
 *  - Sign In  → router.refresh() triggers the Server Component to
 *               redirect to the tierlist (the session cookie is set).
 *  - Sign Up  → shows a "check your email" confirmation message
 *               (Supabase sends a magic confirmation link).
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackError ? "Authentication failed. Please try again." : null
  );
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  /** Handles both sign-in and sign-up form submission */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        // Trigger a full server-component re-render which will redirect
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // After email confirmation, redirect back to the auth callback
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(
          "Account created! Check your email and click the confirmation link."
        );
      }
    }

    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
      {/* Mode toggle tabs */}
      <div className="mb-6 flex rounded-lg bg-gray-800 p-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-white text-gray-900 shadow"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {m === "signin" ? "Sign In" : "Sign Up"}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {mode === "signup" && (
            <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <p className="rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Success message */}
        {success && (
          <p className="rounded-lg bg-green-900/40 px-4 py-2 text-sm text-green-400">
            {success}
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Please wait…"
            : mode === "signin"
            ? "Sign In"
            : "Create Account"}
        </button>
      </form>
    </div>
  );
}
