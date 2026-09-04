"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TuningEditor from "@/components/star/TuningEditor";

/**
 * Every game-balance number the star career game ships with, in one place —
 * requested directly: "an area where I can customize every single thing
 * that is done using numbers... without having to just keep asking you."
 * Admin-only, unlinked, matching /star-match-dev and /star-scenario-dev's
 * own pattern. See lib/star/tuning.ts's header for what is and isn't here.
 */
export default function StarTuningDevPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setState("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : { isAdmin: false };
        setState(d.isAdmin ? "ok" : "denied");
      } catch {
        setState("denied");
      }
    });
  }, []);

  if (state === "loading") {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-sm">Loading…</div>;
  }
  if (state === "denied") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-center px-4">
        <div>
          <div className="text-lg font-black mb-1">Admin only</div>
          <div className="text-sm text-gray-400">This is a development tool.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-1 text-lg font-black">Balance Tuning</div>
        <p className="mb-4 text-xs text-white/60">
          Every price, fee, increment and gain the star career game runs on — edit any of it here instead of
          asking for a code change. Saved locally in this browser.
        </p>
        <TuningEditor />
      </div>
    </div>
  );
}
