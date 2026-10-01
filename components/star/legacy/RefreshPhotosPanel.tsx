"use client";
import { useEffect, useState } from "react";
import { Burst, PressButton, useTrigger } from "@/components/star/legacy/ui";
import { SetCard, SetHead, SetNote } from "@/components/star/legacy/settingsKit";

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
 *
 * Reskinned 28 Sep 2026 (the home screen's look): a lit card, a kit button,
 * and a spark burst on "Done!". Same handler, same states.
 */
const TONE = "#10b981";

export default function RefreshPhotosPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [done, fireDone] = useTrigger();
  useEffect(() => { if (state === "done") fireDone(); }, [state, fireDone]);

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
    <SetCard tone={TONE} strength={0.18} className="mt-2.5 p-3">
      <SetHead tone={TONE}>Refresh Player Photos</SetHead>
      <SetNote>
        Pulls the latest names, ratings and photos for your squad and every other club — useful if faces on the pitch are missing on an older save. Your goals and assists this save are untouched.
      </SetNote>
      <div className="relative mt-2">
        <Burst trigger={done} round colors={["#6ee7b7", "#fde047", "#ffffff"]} count={16} />
        <PressButton
          variant={state === "error" ? "danger" : "primary"}
          size="none"
          onClick={run}
          disabled={state === "loading"}
          className="w-full rounded-xl py-2 text-[11px] font-black"
        >
          {state === "loading" ? "Refreshing…" : state === "done" ? "Done!" : state === "error" ? "Couldn't refresh — try again" : "Refresh Photos"}
        </PressButton>
      </div>
    </SetCard>
  );
}
