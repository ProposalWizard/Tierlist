"use client";

/**
 * Real moments → "In the game" (Harry, 20 Oct 2026: "How do we keep track of
 * it, and how do we edit it in the future?").
 *
 * Every fully real shot says whether the game may serve it (Settings → Full
 * highlights rebuild → Real moment highlights): in by default when it passes
 * the automatic checks, or marked by hand "Use in game" / "Don't use".
 * A mark saves at once (the shared star_real_moments_picks table, or this
 * device only until that table exists); Commit writes every mark into
 * data/realmoments/picks.json in the code. The rules: lib/star/realMoments/picks.ts,
 * lib/star/fhr/realMomentHighlights.ts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, Btn, Pill, Note } from "@/components/admin/broadcast/BroadcastPage";
import {
  loadRealMomentPool, gameStatus, inGameIds, REAL_MOMENT_SHARE_IN, REAL_MOMENT_KINDS, type RealMomentPool,
} from "@/lib/star/fhr/realMomentHighlights";
import { committedPicks, PICK_WORDS, type PickState } from "@/lib/star/realMoments/picks";
import {
  ensureRealMomentPicks, saveRealMomentPick, commitRealMomentPicks, savedPicks, isPendingPick, type PicksSync,
} from "@/lib/star/realMoments/pickStore";
import { KIND_LABEL } from "@/lib/star/realMoments";

/** The pool (with every pick loaded) and a number that changes whenever a mark does. */
export function useGamePool() {
  const [pool, setPool] = useState<RealMomentPool | null>(null);
  const [sync, setSync] = useState<PicksSync | null>(null);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    void ensureRealMomentPicks().then((s) => { setSync(s); setRev((r) => r + 1); });
    void loadRealMomentPool().then((p) => setPool(p));
  }, []);
  const bump = useCallback(() => setRev((r) => r + 1), []);
  return { pool, sync, rev, bump };
}

/** The small tag on a list row. */
export function GameTag({ pool, id }: { pool: RealMomentPool | null; id: string }) {
  if (!pool) return null;
  const st = gameStatus(pool, id);
  if (!st.servable) return null;
  const hand = st.pick !== "auto";
  return (
    <span data-in-game={st.inGame ? "yes" : "no"} style={{ color: st.inGame ? "#5ef0a0" : "#ffb454", fontWeight: 800 }}>
      {st.inGame ? "In game" : "Left out"}{hand ? " (by hand)" : ""}
    </span>
  );
}

const CHOICES: { v: PickState; label: string }[] = [
  { v: "use", label: "Use in game" },
  { v: "dont", label: "Don't use" },
  { v: "auto", label: "Automatic" },
];

/** The picked moment's game panel: where it stands, and the three marks. */
export function GamePickPanel({ pool, id, kind, onChange }: { pool: RealMomentPool | null; id: string; kind: string; onChange: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setMsg(null), [id]);
  if (!pool) return <Note>Loading which moments the game uses…</Note>;
  const st = gameStatus(pool, id);
  if (!st.servable) {
    return (
      <div data-game-pick="not-servable" className="rm-facts" style={{ marginTop: 10 }}>
        In the game: never. {kind === "corner" ? "Corners are not served (open-play shots only)." : st.check ? `It is ${st.check}.` : "Only fully real shots are served."}
      </div>
    );
  }
  const mark = async (v: PickState) => {
    const r = await saveRealMomentPick(id, v);
    setMsg({ ok: r.shared, text: r.message });
    onChange();
  };
  return (
    <div data-game-pick={st.inGame ? "in" : "out"} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="rm-facts">
        In the game: <b style={{ color: st.inGame ? "#5ef0a0" : "#ffb454" }}>{st.inGame ? "yes" : "no"}</b>
        {" · "}{st.pick === "auto" ? (st.check ? `left out automatically: ${st.check}` : "in automatically (passes every check)") : `marked "${PICK_WORDS[st.pick]}"`}
        {isPendingPick(id) ? " · saved on this device only" : ""}
      </div>
      <div className="rm-pills" data-pick-buttons>
        {CHOICES.map((c) => (
          <Pill key={c.v} on={st.pick === c.v} onClick={() => void mark(c.v)} title={PICK_WORDS[c.v]}>{c.label}</Pill>
        ))}
      </div>
      {msg && <div className={msg.ok ? "rm-count" : "rm-faults"} data-pick-msg>{msg.text}</div>}
    </div>
  );
}

/** The rail panel: how many are in the game, the marks waiting to be committed, Commit. */
export function GamePicksPanel({ pool, sync, rev }: { pool: RealMomentPool | null; sync: PicksSync | null; rev: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const stats = useMemo(() => {
    if (!pool) return null;
    const inGame = inGameIds(pool);
    const byKind = REAL_MOMENT_KINDS.map((k) => [k, (pool.byKind.get(k) ?? []).filter((m) => inGame.has(m.id)).length] as const);
    const servable = REAL_MOMENT_KINDS.reduce((a, k) => a + (pool.byKind.get(k)?.length ?? 0), 0);
    const committed = committedPicks();
    const layer = savedPicks();
    const pending = Object.entries(layer).filter(([id, v]) => (v ?? "auto") !== (committed[id] ?? "auto"))
      .map(([id, v]) => ({ id, value: (v ?? "auto") as PickState }));
    return { inGame: inGame.size, servable, byKind, pending };
  }, [pool, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = async () => {
    if (!stats?.pending.length) return;
    setBusy(true);
    const r = await commitRealMomentPicks(stats.pending);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
  };
  return (
    <Panel title="In the game" note="Real moment highlights">
      {!stats && <Note>Loading…</Note>}
      {stats && (
        <div data-picks-panel style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="rm-count" data-in-game-count>
            {stats.inGame} real moments are in the game ({stats.byKind.map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`).join(", ")});
            {" "}{stats.servable - stats.inGame} more fully real shots of those kinds are left out (set pieces, a failed check, or marked Don&apos;t use).
            With Real moment highlights On, about 1 in {REAL_MOMENT_SHARE_IN} open-play chances of those kinds is one of them.
          </div>
          {sync?.migrationMissing && (
            <div className="rm-faults" data-picks-migration>
              Marks are saved on this device only until supabase/migrations/star_real_moments_picks.sql runs.
            </div>
          )}
          <div className="rm-count">
            {stats.pending.length ? `${stats.pending.length} mark${stats.pending.length === 1 ? "" : "s"} not in the code yet.` : "Every mark is in the code."}
          </div>
          <Btn main onClick={() => void commit()} disabled={busy || !stats.pending.length}>
            {busy ? "Committing…" : "Commit marks to the game"}
          </Btn>
          {msg && <div className={msg.ok ? "rm-count" : "rm-faults"} data-commit-msg>{msg.text}</div>}
        </div>
      )}
    </Panel>
  );
}
