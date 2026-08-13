"use client";
import { useEffect, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  FORMATIONS, DEFAULT_FORMATION, formationOf, autoPick, refit, fitness,
  type Pickable,
} from "@/lib/star/formations";
import { loadLineup, saveLineup } from "@/lib/star/lineupStore";
import { kitsOf, labelInk } from "@/lib/star/kits";

/**
 * THE TEAM SHEET.
 *
 * Every club in the division, its squad, and a shape to arrange them in.
 *
 * Selection is tap-then-tap, not drag — the same decision the tierlists made and
 * for the same reason: a drag on a phone fights the browser for the gesture, and
 * this is a phone game. Tap a man to pick him up, tap where he should go. Tap
 * him again to put him down.
 *
 * Everything is saved per club the moment it changes, so coming back to Everton
 * finds the Everton side you picked.
 */

interface Props {
  career: CareerState;
}

export default function LineupBuilder({ career }: Props) {
  const clubs = useMemo(
    () => career.league.map(t => t.name).sort((a, b) => a.localeCompare(b)),
    [career.league],
  );
  const [club, setClub] = useState(career.player.club);
  const [formationId, setFormationId] = useState(DEFAULT_FORMATION);
  const [xi, setXi] = useState<(string | null)[]>([]);
  const [held, setHeld] = useState<string | null>(null);

  const formation = formationOf(formationId);

  /**
   * Everybody available at this club.
   *
   * Your own is `career.squad`, which is the full thing — those men play. The
   * other nineteen are the thin `leagueSquads` rows. Both flatten to the same
   * four fields here.
   */
  const squad: Pickable[] = useMemo(() => {
    if (club === career.player.club) {
      return (career.squad ?? []).map(p => ({
        id: p.id, name: p.shortName || p.name, position: p.position, overall: p.overall,
      }));
    }
    const found = (career.leagueSquads ?? []).find(s => s.club === club);
    return (found?.players ?? []).map(p => ({
      id: p.id, name: p.name, position: p.position, overall: p.overall,
    }));
  }, [club, career.squad, career.leagueSquads, career.player.club]);

  // Load the saved side, or pick one. Runs on every club change.
  useEffect(() => {
    if (squad.length === 0) { setXi([]); return; }
    const saved = loadLineup(club);
    const known = new Set(squad.map(p => p.id));
    if (saved && saved.xi.some(id => id && known.has(id))) {
      const shape = formationOf(saved.formation);
      setFormationId(saved.formation);
      // A saved id that is no longer in the squad is dropped rather than shown
      // as a hole with a stranger's name in it.
      setXi(saved.xi.map(id => (id && known.has(id) ? id : null)));
    } else {
      setFormationId(DEFAULT_FORMATION);
      setXi(autoPick(squad, formationOf(DEFAULT_FORMATION)));
    }
    setHeld(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club, squad.length]);

  // Save whenever it settles.
  useEffect(() => {
    if (xi.length === 0) return;
    saveLineup(club, { formation: formationId, xi });
  }, [club, formationId, xi]);

  const byId = useMemo(() => new Map(squad.map(p => [p.id, p])), [squad]);
  const bench = useMemo(() => {
    const picked = new Set(xi.filter((x): x is string => !!x));
    return squad.filter(p => !picked.has(p.id));
  }, [squad, xi]);

  const changeFormation = (id: string) => {
    setFormationId(id);
    // The men you chose stay chosen — they stand somewhere else. See refit.
    setXi(prev => refit(prev, squad, formationOf(id)));
    setHeld(null);
  };

  /** Tap a slot: drop the held man in, or pick this one up. */
  const tapSlot = (index: number) => {
    const here = xi[index] ?? null;
    if (!held) { if (here) setHeld(here); return; }
    if (held === here) { setHeld(null); return; }
    setXi((prev) => {
      const next = [...prev];
      const from = next.indexOf(held);
      next[index] = held;
      // He was already on the pitch: the two swap places rather than one of them
      // vanishing, which is what a straight assignment would do.
      if (from >= 0) next[from] = here;
      return next;
    });
    setHeld(null);
  };

  const tapBench = (id: string) => {
    if (held === id) { setHeld(null); return; }
    if (!held) { setHeld(id); return; }
    // Holding somebody from the pitch and tapping a substitute swaps them.
    const from = xi.indexOf(held);
    if (from >= 0) {
      setXi((prev) => { const n = [...prev]; n[from] = id; return n; });
      setHeld(null);
      return;
    }
    setHeld(id);
  };

  const kit = kitsOf(club).home;
  const ink = labelInk(kit.shirt);

  if (squad.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-gray-600 bg-gray-700 p-3 text-xs font-bold text-white/80">
        No squad for {club} yet. The division loads in the background the first time you open a
        career — come back in a moment.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {/* ── Club and shape ── */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-white/70">Club</span>
          <select
            value={club}
            onChange={e => setClub(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-xs font-black text-white"
          >
            {clubs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-white/70">Formation</span>
          <select
            value={formationId}
            onChange={e => changeFormation(e.target.value)}
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-xs font-black text-white"
          >
            {FORMATIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      </div>

      {/* ── The pitch ── */}
      <div
        className="relative w-full overflow-hidden rounded-xl border-2 border-emerald-900/70"
        style={{ aspectRatio: "3 / 4", background: "linear-gradient(#1f9006,#187406)" }}
      >
        {/* Markings, drawn as plain boxes so they cost nothing. */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/45" />
          <div className="absolute left-1/2 top-1/2 h-[18%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45" />
          <div className="absolute left-1/2 top-0 h-[16%] w-[54%] -translate-x-1/2 border-x border-b border-white/45" />
          <div className="absolute bottom-0 left-1/2 h-[16%] w-[54%] -translate-x-1/2 border-x border-t border-white/45" />
        </div>

        {formation.slots.map((slot, i) => {
          const id = xi[i] ?? null;
          const p = id ? byId.get(id) : undefined;
          const isHeld = !!id && held === id;
          const bad = p ? fitness(slot.role, p.position) < 60 : false;
          return (
            <button
              key={`${slot.role}-${i}`}
              onClick={() => tapSlot(i)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: "23%" }}
              aria-label={p ? `${p.name}, ${slot.label ?? slot.role}` : `Empty ${slot.role}`}
            >
              <div
                className={`mx-auto grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-black shadow-md transition ${
                  isHeld ? "scale-110 border-amber-300 ring-2 ring-amber-300" : "border-black/40"}`}
                style={{ background: p ? kit.shirt : "rgba(0,0,0,0.35)", color: p ? ink : "#ffffff" }}
              >
                {slot.label ?? slot.role}
              </div>
              <div className="mt-0.5 truncate text-center text-[9px] font-black leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {p ? p.name : "—"}
              </div>
              {p && (
                <div className={`text-center text-[8px] font-bold leading-none ${bad ? "text-amber-300" : "text-white/75"}`}>
                  {p.position}{p.overall ? ` · ${p.overall}` : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] font-bold text-white/70">
        {held
          ? "Now tap where he should go — a shirt on the pitch, or a substitute to swap him for."
          : "Tap a player to pick him up, then tap another to swap them. Amber means he is out of position."}
      </p>

      {/* ── The bench ── */}
      <div className="rounded-lg border border-gray-600 bg-gray-700 overflow-hidden">
        <div className="bg-gray-800 px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
          Substitutes · {bench.length}
        </div>
        <div className="max-h-[220px] overflow-y-auto">
          {bench.map((p, i) => (
            <button
              key={p.id}
              onClick={() => tapBench(p.id)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs font-bold transition ${
                held === p.id ? "bg-amber-500 text-gray-950"
                  : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"}`}
            >
              <span className="w-9 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-black"
                style={{ background: kit.shirt, color: ink }}>
                {p.position}
              </span>
              <span className="flex-1 truncate">{p.name}</span>
              {p.overall ? <span className="tabular-nums text-[11px] font-black text-white/85">{p.overall}</span> : null}
            </button>
          ))}
          {bench.length === 0 && (
            <div className="px-2 py-2 text-[11px] font-bold text-white/70">Everybody is on the pitch.</div>
          )}
        </div>
      </div>

      <button
        onClick={() => { setXi(autoPick(squad, formation)); setHeld(null); }}
        className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-500"
      >
        Pick the best side
      </button>
    </div>
  );
}
