"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ScenarioEditor from "@/components/star/ScenarioEditor";

// Standalone sandbox for hand-building match scenarios (camera framing +
// teammate/opponent placement). Admin-only; not linked in nav. See
// lib/star/scenarios.ts's own header — this is a draft/authoring tool only;
// nothing saved here is read by the real match engine yet.
export default function StarScenarioDevPage() {
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
          <div className="text-sm text-gray-400">This is a development sandbox.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 text-lg font-black">Scenario Builder</div>
        <p className="mb-4 text-xs text-white/60">
          Place teammates and opponents, set the ball, and frame a camera — saved locally in this browser.
          Nothing here plays in a real match yet; this is just for trying out how a scenario gets built.
        </p>
        <ScenarioEditor />
      </div>
    </div>
  );
}
