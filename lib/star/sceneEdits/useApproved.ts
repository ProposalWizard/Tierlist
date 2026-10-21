"use client";
/**
 * THE GAME'S READ HOOK for approved 3D Scene Editor edits (Harry, 20 Oct
 * 2026, answer 3D-4: approved edits "can be used, and we could choose maybe
 * when and where").
 *
 * Two copies, the newer approval wins (approval.ts pickApproved):
 *   - the committed file lib/star/data/sceneEdits.json ("Commit to game"),
 *     in the code, so it works offline and with no database;
 *   - the shared table star_cutscene_edits, approved rows only
 *     (GET /api/star/cutscene-edits?approved=1), fetched once per visit.
 * An edit that is not approved, not for this screen, or not for this moment
 * is never handed over: the scene then plays exactly as written.
 */
import { useEffect, useState } from "react";
import COMMITTED_FILE from "../data/sceneEdits.json";
import { editsFromFile, pickApproved, sceneEditOf, type UseContext } from "./approval";

const COMMITTED = editsFromFile(COMMITTED_FILE);
let shared: Promise<Record<string, unknown>> | null = null;

/** The approved shared rows, fetched once (an error or no table = none). */
export function approvedShared(): Promise<Record<string, unknown>> {
  if (!shared) {
    shared = fetch("/api/star/cutscene-edits?approved=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { edits: {} }))
      .then((j: { edits?: Record<string, unknown> }) => j.edits ?? {})
      .catch(() => ({}));
  }
  return shared;
}

/** For the editor: after an Approve or a Save, the game's next look fetches again. */
export function forgetApprovedShared(): void { shared = null; }

/** The committed copy only, straight away (no network). */
export function committedEdit<T>(scriptId: string, ctx: UseContext): T | null {
  const e = pickApproved(scriptId, null, COMMITTED, ctx);
  return e ? sceneEditOf<T>(e) : null;
}

/**
 * The edit this scene should play with here, or null. Starts from the
 * committed copy (no wait), then takes the shared copy if it is newer.
 * `facts`: the moment's own facts a "when" can match (the garden's sky, …).
 */
export function useApprovedEdit<T>(scriptId: string, where: UseContext["where"], facts: string[] = []): T | null {
  const key = facts.join("|");
  const [edit, setEdit] = useState<T | null>(() => committedEdit<T>(scriptId, { where, facts }));
  useEffect(() => {
    let dead = false;
    approvedShared().then((sh) => {
      if (dead) return;
      const e = pickApproved(scriptId, sh, COMMITTED, { where, facts: key ? key.split("|") : [] });
      setEdit(e ? sceneEditOf<T>(e) : null);
    });
    return () => { dead = true; };
  }, [scriptId, where, key]);
  return edit;
}
