"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LeagueSquad } from "@/lib/star/types";
import {
  FORMATIONS, DEFAULT_FORMATION, formationOf, autoPick, refit, bestFitness,
  type Pickable,
} from "@/lib/star/formations";
import { loadLineup, saveLineup } from "@/lib/star/lineupStore";
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
  const { formationId, xi, bench7, manager } = sheet;

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

  // Load the saved side, or pick one. Runs on every club change.
  useEffect(() => {
    if (squad.length === 0) return;
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
  }, [club, squad.length]);

  // Save whenever it settles.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!sheet.club || sheet.xi.length === 0) return;
    const t = window.setTimeout(() => {
      saveLineup(sheet.club, { formation: sheet.formationId, xi: sheet.xi, bench: sheet.bench7, manager: sheet.manager });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
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
      if (here && newBench.length < 7 && !newBench.includes(here)) {
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
        if (displaced && newBench.length < 7 && !newBench.includes(displaced)) {
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
            <span className={`transition-opacity ${saved ? "text-emerald-400 opacity-100" : "opacity-0"}`}>
              Saved ✓
            </span>
          </div>
        </>
      )}
    </div>
  );
}
