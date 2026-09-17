"use client";
import { useState } from "react";

/**
 * Reported directly: an old save's faces are mostly blank while a brand new
 * save has almost all of them. Real cause — shouldUpgradeSquad/
 * shouldUpgradeLeagueSquads (realSquad.ts / leagueSquads.ts) only ever
 * re-fetch automatically while a squad still looks too thin or too
 * image-sparse to trust; once a save clears that bar once, it never
 * rechecks, so photos added to the database afterward never arrive on
 * their own. This bypasses that bar on request — refetches your squad and
 * every other club and merges the fresh names/photos/ratings in, same
 * merge (mergeSquadStats / mergeLeagueSquadStats) the automatic path uses,
 * so this season's goals and assists are exactly as untouched as they'd be
 * on a normal background refresh.
 */
export default function RefreshPhotosPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const run = async () => {
    setState("loading");
    try {
      await onRefresh();
      setState("done");
    } catch {
      setState("error");
    } finally {
      window.setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Refresh Player Photos</div>
      <p className="mt-1 text-[11px] font-semibold text-white/90">
        Pulls the latest names, ratings and photos for your squad and every other club — useful if faces on the pitch are missing on an older save. Your goals and assists this save are untouched.
      </p>
      <button
        onClick={run}
        disabled={state === "loading"}
        className="mt-2 w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-[11px] font-black text-white"
      >
        {state === "loading" ? "Refreshing…" : state === "done" ? "Done!" : state === "error" ? "Couldn't refresh — try again" : "Refresh Photos"}
      </button>
    </div>
  );
}
