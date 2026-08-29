"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LeagueSquad } from "@/lib/star/types";
import {
  FORMATIONS, DEFAULT_FORMATION, formationOf, autoPick, refit, bestFitness,
  type Pickable,
} from "@/lib/star/formations";
import {
  loadLineup, saveLineup, exportAll, importAll, fetchSharedLineups, pushLineupShared, pushAllShared,
} from "@/lib/star/lineupStore";
import { kitsOf, labelInk } from "@/lib/star/kits";

/**
 * THE TEAM SHEET.
 *
 * Every club in the division, its squad, and a shape to arrange them in.
 *
 * Two rules it is built to:
 *
 * Selection is tap-then-tap, never drag. The same decision the tierlists made
 * and for the same reason — a drag on a phone fights the browser for the
 * gesture, and this is a phone game. Tap a man to pick him up, tap where he
 * should go, tap him again to put him down.
 *
 * And it fits on one screen. The whole thing sizes itself to whatever height is
 * left below the site nav and never asks the page to scroll: the pitch takes the
 * room that is going, the bench is a grid rather than a list, and the controls
 * are one row. Asked for in those words — "see it all on one page without
 * scrolling down" — and it is the right shape for the job anyway, because
 * picking a side means looking at the side and the bench at the same time.
 */

interface Props {
  clubs: string[];
  squads: LeagueSquad[];
  initialClub?: string;
}

/**
 * A team sheet, and the club it belongs to, in one piece of state.
 *
 * Kept together on purpose. They were four separate `useState`s, and switching
 * club ran the load effect and the save effect in the same commit: the loader
 * called setXi, which does not apply until the next render, so the saver then
 * wrote the PREVIOUS club's eleven under the NEW club's key. A second, correct
 * write followed a moment later and papered over it, but only by luck. One
 * object cannot disagree with itself.
 */
interface Sheet {
  club: string;
  formationId: string;
  xi: (string | null)[];
  /** Up to seven designated substitutes. Everyone else is a reserve. */
  bench7: string[];
  manager: string;
}

export default function LineupBuilder({ clubs, squads, initialClub }: Props) {
  const [club, setClub] = useState(initialClub ?? clubs[0] ?? "");
  const [sheet, setSheet] = useState<Sheet>({ club: "", formationId: DEFAULT_FORMATION, xi: [], bench7: [], manager: "" });
  const [held, setHeld] = useState<string | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const { formationId, xi, bench7, manager } = sheet;

  // Pull the shared table down into the local cache before anything reads
  // it — otherwise the very first render's "load the saved side" effect
  // below would run against whatever (possibly nothing, possibly stale)
  // happened to already be in this browser's storage.
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    fetchSharedLineups().finally(() => setSynced(true));
  }, []);

  // ── One screen ──
  const shellRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = shellRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(420, window.innerHeight - top - 12));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  const formation = formationOf(formationId);

  const squad: Pickable[] = useMemo(() => {
    const found = squads.find(s => s.club === club);
    return (found?.players ?? []).map(p => ({
      id: p.id, name: p.name, position: p.position, positions: p.positions, overall: p.overall,
    }));
  }, [club, squads]);

  // Load the saved side, or pick one. Runs on every club change — but not
  // before the shared-table sync above has landed, or a device with an
  // empty local cache would build a side from scratch and never see the
  // real one that's already on the server.
  useEffect(() => {
    if (!synced || squad.length === 0) return;
    const saved = loadLineup(club);
    const known = new Set(squad.map(p => p.id));
    if (saved && saved.xi.some(id => id && known.has(id))) {
      const loadedXi = saved.xi.map(id => (id && known.has(id) ? id : null));
      const xiSet = new Set(loadedXi.filter(Boolean) as string[]);
      setSheet({
        club,
        formationId: saved.formation,
        xi: loadedXi,
        bench7: (saved.bench ?? []).filter(id => known.has(id) && !xiSet.has(id)).slice(0, 9),
        manager: saved.manager ?? "",
      });
    } else {
      const newXi = autoPick(squad, formationOf(DEFAULT_FORMATION));
      const xiSet = new Set(newXi.filter(Boolean) as string[]);
      const autoBench = squad
        .filter(p => !xiSet.has(p.id))
        .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
        .slice(0, 9)
        .map(p => p.id);
      setSheet({
        club,
        formationId: DEFAULT_FORMATION,
        xi: newXi,
        bench7: autoBench,
        manager: saved?.manager ?? "",
      });
    }
    setHeld(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club, squad.length, synced]);

  // Save whenever it settles — locally first (instant, always works), then
  // pushed to the shared table so it's the same lineup everyone else's
  // career reads too. Only the second half can actually fail (not signed in
  // as admin, offline), so that's the half whose result gets shown.
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    if (!sheet.club || sheet.xi.length === 0) return;
    const t = window.setTimeout(async () => {
      const lineup = { formation: sheet.formationId, xi: sheet.xi, bench: sheet.bench7, manager: sheet.manager };
      saveLineup(sheet.club, lineup);
      const result = await pushLineupShared(sheet.club, lineup);
      if (result.ok) {
        setSaveError(null);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1400);
      } else {
        setSaveError(result.error ?? "Save failed");
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [sheet]);

  const byId = useMemo(() => new Map(squad.map(p => [p.id, p])), [squad]);

  const inXI = useMemo(() => new Set(xi.filter((x): x is string => !!x)), [xi]);
  const inBench7 = useMemo(() => new Set(bench7), [bench7]);
  const bench7Players = useMemo(
    () => bench7.map(id => byId.get(id)).filter((p): p is Pickable => !!p),
    [bench7, byId],
  );
  const reserves = useMemo(
    () => squad.filter(p => !inXI.has(p.id) && !inBench7.has(p.id)),
    [squad, inXI, inBench7],
  );

  const changeFormation = (id: string) => {
    setSheet(s => ({ ...s, formationId: id, xi: refit(s.xi, squad, formationOf(id)) }));
    setHeld(null);
  };

  /** Tap a pitch slot: drop the held man in, or pick this one up. */
  const tapSlot = (index: number) => {
    const here = xi[index] ?? null;
    if (!held) { if (here) setHeld(here); return; }
    if (held === here) { setHeld(null); return; }
    setSheet((s) => {
      const next = [...s.xi];
      const from = next.indexOf(held);
      next[index] = held;
      if (from >= 0) {
        // Swapping within the XI — player displaced goes back to his own slot.
        next[from] = here;
        return { ...s, xi: next };
      }
      // held came from the bench or reserves; remove him from bench7 if he was there.
      let newBench = s.bench7.filter(b => b !== held);
      // The pitch player displaced by this move goes to bench7 if there is room.
      //
      // Reported directly: swapping a bench player into the XI kept dropping
      // the displaced starter straight to reserves instead, shrinking the
      // bench from 9/9 to 8/9 every time. `bench7` is a leftover name from
      // when the bench held seven — the real capacity, shown everywhere else
      // in this file (the "Bench — N/9" label, the other room check just
      // below), is nine. This one check never got updated off the old
      // number, so it started rejecting the displaced player the moment the
      // bench reached 7 — which is exactly what "swapping a bench player in"
      // does: it removes one from the bench first, landing it at 7 or 8, at
      // which point this comparison started refusing him room that was
      // actually there.
      if (here && newBench.length < 9 && !newBench.includes(here)) {
        newBench = [...newBench, here];
      }
      return { ...s, xi: next, bench7: newBench };
    });
    setHeld(null);
  };

  /** Tap a designated bench player. */
  const tapBench7Player = (id: string) => {
    if (held === id) { setHeld(null); return; }
    if (!held) { setHeld(id); return; }

    const fromPitch = xi.indexOf(held);
    if (fromPitch >= 0) {
      // Held is a pitch player — swap: pitch player joins bench, bench player goes to pitch.
      setSheet(s => {
        const n = [...s.xi];
        n[fromPitch] = id;
        return { ...s, xi: n, bench7: s.bench7.map(b => (b === id ? held : b)) };
      });
      setHeld(null);
      return;
    }
    if (inBench7.has(held)) {
      // Reorder within bench7.
      setSheet(s => ({
        ...s,
        bench7: s.bench7.map(b => (b === id ? held : b === held ? id : b)),
      }));
      setHeld(null);
      return;
    }
    // Held is a reserve — swap: reserve onto bench, bench player drops to reserves.
    setSheet(s => ({ ...s, bench7: s.bench7.map(b => (b === id ? held : b)) }));
    setHeld(null);
  };

  /** Tap a reserve player. */
  const tapReserve = (id: string) => {
    if (held === id) { setHeld(null); return; }
    if (!held) {
      // No held player — tap adds directly to bench if there is a slot.
      if (bench7.length < 9) {
        setSheet(s => ({ ...s, bench7: [...s.bench7, id] }));
      } else {
        setHeld(id);
      }
      return;
    }

    const fromPitch = xi.indexOf(held);
    if (fromPitch >= 0) {
      // Held is on the pitch — move reserve to pitch, pitch player falls to bench/reserves.
      setSheet(s => {
        const n = [...s.xi];
        n[fromPitch] = id;
        let newBench = s.bench7.filter(b => b !== id);
        const displaced = xi[fromPitch];
        // Same stale 7-vs-9 bug as tapSlot above — see that comment.
        if (displaced && newBench.length < 9 && !newBench.includes(displaced)) {
          newBench = [...newBench, displaced];
        }
        return { ...s, xi: n, bench7: newBench };
      });
      setHeld(null);
      return;
    }
    if (inBench7.has(held)) {
      // Held is a bench7 player — swap: bench player drops to reserves, reserve goes to bench.
      setSheet(s => ({ ...s, bench7: s.bench7.map(b => (b === held ? id : b)) }));
      setHeld(null);
      return;
    }
    // Both are reserves — just switch who we are holding.
    setHeld(id);
  };

  const kit = kitsOf(club).home;
  const ink = labelInk(kit.shirt);

  const hintText = held
    ? "Tap where he goes"
    : bench7.length < 9
    ? "Tap a reserve to add to bench"
    : "Tap a player then another to swap";

  return (
    <>
    <div
      ref={shellRef}
      className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 overflow-hidden px-2"
      style={height ? { height } : undefined}
    >
      {/* ── Controls: one row, always ── */}
      <div className="flex shrink-0 items-stretch gap-1.5">
        <select
          value={club}
          onChange={e => setClub(e.target.value)}
          aria-label="Club"
          className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-[12px] font-black text-white"
        >
          {clubs.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={formationId}
          onChange={e => changeFormation(e.target.value)}
          aria-label="Formation"
          className="w-[104px] shrink-0 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-[12px] font-black text-white"
        >
          {FORMATIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button
          onClick={() => {
            const newXi = autoPick(squad, formation);
            const xiSet = new Set(newXi.filter(Boolean) as string[]);
            const autoBench = squad
              .filter(p => !xiSet.has(p.id))
              .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
              .slice(0, 7)
              .map(p => p.id);
            setSheet(s => ({ ...s, xi: newXi, bench7: autoBench }));
            setHeld(null);
          }}
          className="shrink-0 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-black uppercase text-white transition hover:bg-emerald-500"
        >
          Best XI
        </button>
        <button
          onClick={() => setShowBackup(true)}
          aria-label="Backup lineups"
          title="Backup / restore all saved lineups"
          className="shrink-0 rounded-lg bg-gray-700 px-2.5 text-[11px] font-black uppercase text-white transition hover:bg-gray-600"
        >
          Backup
        </button>
      </div>

      {/* ── The dugout ── */}
      <input
        value={manager}
        onChange={e => setSheet(s => ({ ...s, manager: e.target.value }))}
        placeholder={`Who manages ${club}?`}
        aria-label="Manager"
        maxLength={40}
        className="shrink-0 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-[12px] font-bold text-white placeholder:font-normal placeholder:text-white/40"
      />

      {squad.length === 0 || sheet.club !== club ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 p-4 text-center text-xs font-bold text-white/75">
          Loading {club}&apos;s squad…
        </div>
      ) : (
        <>
          {/* ── The pitch ── */}
          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-xl border-2 border-emerald-900/70"
            style={{ background: "linear-gradient(#1f9006,#187406)" }}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/40" />
              <div className="absolute left-1/2 top-1/2 h-[16%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
              <div className="absolute left-1/2 top-0 h-[15%] w-[52%] -translate-x-1/2 border-x border-b border-white/40" />
              <div className="absolute bottom-0 left-1/2 h-[15%] w-[52%] -translate-x-1/2 border-x border-t border-white/40" />
            </div>

            {formation.slots.map((slot, i) => {
              const id = xi[i] ?? null;
              const p = id ? byId.get(id) : undefined;
              const isHeld = !!id && held === id;
              const bad = p ? bestFitness(slot.role, p) < 60 : false;
              return (
                <button
                  key={`${slot.role}-${i}`}
                  onClick={() => tapSlot(i)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 leading-none"
                  style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: "21%" }}
                  aria-label={p ? `${p.name}, ${slot.label ?? slot.role}` : `Empty ${slot.role}`}
                >
                  <div
                    className={`mx-auto grid h-7 w-7 place-items-center rounded-full border-2 text-[9px] font-black shadow-md transition ${
                      isHeld ? "scale-110 border-amber-300 ring-2 ring-amber-300" : "border-black/40"}`}
                    style={{ background: p ? kit.shirt : "rgba(0,0,0,0.35)", color: p ? ink : "#ffffff" }}
                  >
                    {slot.label ?? slot.role}
                  </div>
                  <div className="mt-0.5 truncate text-center text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                    {p ? p.name : "—"}
                  </div>
                  {p && (
                    <div className={`mt-px text-center text-[8px] font-bold ${bad ? "text-amber-300" : "text-white/70"}`}>
                      {p.position}{p.overall ? ` ${p.overall}` : ""}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Bench + reserves ── */}
          <div className="shrink-0 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-1" style={{ maxHeight: "30%" }}>
            {/* Bench: up to 7 chosen subs */}
            <div className="mb-1">
              <div className="mb-0.5 px-0.5 text-[8px] font-black uppercase tracking-wider text-white/40">
                Bench — {bench7Players.length}/9
              </div>
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
                {bench7Players.map(p => (
                  <button
                    key={p.id}
                    onClick={() => tapBench7Player(p.id)}
                    className={`flex items-center gap-1 rounded px-1 py-1 text-left transition ${
                      held === p.id ? "bg-amber-500" : "bg-gray-700 hover:bg-gray-600"}`}
                  >
                    <span
                      className="w-7 shrink-0 rounded text-center text-[8px] font-black leading-4"
                      style={{ background: kit.shirt, color: ink }}
                    >
                      {p.position}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[10px] font-bold ${held === p.id ? "text-gray-950" : "text-white"}`}>
                      {p.name}
                    </span>
                    {p.overall ? (
                      <span className={`shrink-0 text-[9px] font-black tabular-nums ${held === p.id ? "text-gray-950" : "text-white/75"}`}>
                        {p.overall}
                      </span>
                    ) : null}
                  </button>
                ))}
                {bench7Players.length === 0 && (
                  <div className="col-span-full px-1 py-1.5 text-[10px] font-bold text-white/50">
                    Tap a reserve below to add to bench
                  </div>
                )}
              </div>
            </div>

            {/* Reserves: everyone not in XI or on bench */}
            {reserves.length > 0 && (
              <div>
                <div className="mb-0.5 px-0.5 text-[8px] font-black uppercase tracking-wider text-white/30">
                  Reserves
                </div>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
                  {reserves.map(p => (
                    <button
                      key={p.id}
                      onClick={() => tapReserve(p.id)}
                      className={`flex items-center gap-1 rounded px-1 py-1 text-left transition ${
                        held === p.id ? "bg-amber-500" : "bg-gray-800 hover:bg-gray-700"}`}
                    >
                      <span
                        className="w-7 shrink-0 rounded text-center text-[8px] font-black leading-4"
                        style={{ background: kit.shirt, color: ink }}
                      >
                        {p.position}
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[10px] font-bold ${held === p.id ? "text-gray-950" : "text-white"}`}>
                        {p.name}
                      </span>
                      {p.overall ? (
                        <span className={`shrink-0 text-[9px] font-black tabular-nums ${held === p.id ? "text-gray-950" : "text-white/75"}`}>
                          {p.overall}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 text-[10px] font-bold">
            <span className="text-white/55">{squad.length} in squad · {bench7Players.length} on bench · {reserves.length} reserves</span>
            <span className="min-w-0 flex-1 truncate text-center text-white/60">{hintText}</span>
            {saveError ? (
              <span className="min-w-0 max-w-[45%] truncate text-red-400" title={saveError}>
                ⚠ {saveError}
              </span>
            ) : (
              <span className={`transition-opacity ${saved ? "text-emerald-400 opacity-100" : "opacity-0"}`}>
                Saved ✓
              </span>
            )}
          </div>
        </>
      )}
    </div>
    {showBackup && <BackupModal onClose={() => setShowBackup(false)} />}
    </>
  );
}

/**
 * Every lineup as one block of JSON — the shared database's own copy, since
 * this browser's local cache mirrors it (see the sync-on-mount effect in
 * LineupBuilder above). Worth keeping a copy of outside any database, and
 * the Restore box below is a genuine bulk-write tool: it pushes every club
 * it's given back up to the shared table, admin access permitting — not
 * just back into this one browser.
 */
function BackupModal({ onClose }: { onClose: () => void }) {
  const [dump] = useState(() => exportAll());
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dump);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission denied or unavailable — the textarea below is
      // already selectable, so manual copy still works.
    }
  };

  const doImport = async () => {
    const r = importAll(pasted);
    if (!r.ok || !r.entries) {
      setResult({ ok: false, text: r.error ?? "Import failed." });
      return;
    }
    setRestoring(true);
    const { succeeded, failed } = await pushAllShared(r.entries);
    setRestoring(false);
    if (failed.length === 0) {
      setResult({ ok: true, text: `Restored ${succeeded.length} club${succeeded.length === 1 ? "" : "s"} — live for everyone now.` });
    } else {
      setResult({
        ok: succeeded.length > 0,
        text: `${succeeded.length} club${succeeded.length === 1 ? "" : "s"} restored; ${failed.length} failed`
          + ` (${failed[0].error}${failed.length > 1 ? `, and ${failed.length - 1} more` : ""}).`
          + " Failed clubs only saved locally — make sure you're signed in as admin.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white">Backup lineups</h2>
          <button onClick={onClose} className="rounded-lg bg-gray-700 px-2.5 py-1 text-[11px] font-black text-white hover:bg-gray-600">
            Close
          </button>
        </div>

        <div>
          <div className="mb-1 text-[11px] font-bold text-white/70">
            Every club&apos;s formation, eleven, bench and manager, as text. Copy it
            somewhere safe — a notes app, an email to yourself — as a copy outside the
            database, in case anything ever needs rebuilding from scratch.
          </div>
          <textarea
            readOnly
            value={dump}
            onFocus={e => e.currentTarget.select()}
            className="h-40 w-full resize-none rounded-lg border border-gray-700 bg-gray-950 p-2 font-mono text-[10px] text-white/85"
          />
          <button
            onClick={copy}
            className="mt-1.5 w-full rounded-lg bg-emerald-600 py-1.5 text-[11px] font-black uppercase text-white transition hover:bg-emerald-500"
          >
            {copied ? "Copied ✓" : "Copy to clipboard"}
          </button>
        </div>

        <div className="border-t border-gray-700 pt-3">
          <div className="mb-1 text-[11px] font-bold text-white/70">
            Paste a backup back in and it&apos;s pushed live to every club it covers —
            visible to everyone, not just this browser. Clubs not mentioned in the paste
            are left untouched. Requires admin access.
          </div>
          <textarea
            value={pasted}
            onChange={e => { setPasted(e.target.value); setResult(null); }}
            placeholder="Paste the backup JSON here"
            className="h-24 w-full resize-none rounded-lg border border-gray-700 bg-gray-950 p-2 font-mono text-[10px] text-white placeholder:text-white/40"
          />
          <button
            onClick={doImport}
            disabled={!pasted.trim() || restoring}
            className="mt-1.5 w-full rounded-lg bg-gray-700 py-1.5 text-[11px] font-black uppercase text-white transition hover:bg-gray-600 disabled:opacity-40"
          >
            {restoring ? "Restoring…" : "Restore"}
          </button>
          {result && (
            <div className={`mt-1.5 text-[11px] font-bold ${result.ok ? "text-emerald-400" : "text-red-300"}`}>
              {result.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
