"use client";
import { useEffect, useState } from "react";
import GoalVideo, { type GoalVideoProps } from "./GoalVideo";
import GoalVideoOld from "./GoalVideoOld";
import { leoUpdateOn, type LeoFeature } from "@/lib/star/leoUpdate";

/**
 * WHICH GOAL VIDEO (Leo's 24 Oct update, lib/star/leoUpdate.ts).
 * "feedSpeed" off: the goal video exactly as on main (GoalVideoOld.tsx).
 * On: the new one (made in a worker, kept on the phone), and with
 * "goalVideoNow" also on, the live player that plays a goal at once.
 * The live player is built on the new one, so it needs "feedSpeed" too.
 */
export function useLeoNow(f: LeoFeature): boolean {
  // Read at once on the phone (these screens only exist after the career has
  // loaded, so there is no server render to match): the old player never
  // starts work for a moment before the new one takes over.
  const [on, setOn] = useState(() => (typeof window !== "undefined" ? leoUpdateOn(f) : false));
  useEffect(() => {
    const sync = () => setOn(leoUpdateOn(f));
    sync();
    window.addEventListener("kib-leo-update", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("kib-leo-update", sync); window.removeEventListener("storage", sync); };
  }, [f]);
  return on;
}

export default function GoalVideoSwitch(props: GoalVideoProps) {
  const fast = useLeoNow("feedSpeed");
  const now = useLeoNow("goalVideoNow");
  return fast ? <GoalVideo {...props} live={now} /> : <GoalVideoOld {...props} />;
}
