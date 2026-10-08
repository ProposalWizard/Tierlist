"use client";
import { useEffect, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { PlayerSearchHit } from "@/lib/star/devTeam";
import { PressButton } from "./ui";
import { SetCard, SetHead, SetNote } from "./settingsKit";

/**
 * DEV SQUAD — search any real player and add him to your team, remove
 * anyone, and pin players into the starting XI. Same unguarded spirit as
 * DevCareerPanel; handlers live in app/star-dev/page.tsx (lib/star/devTeam.ts).
 */
const TONE = "#a78bfa";

export default function DevSquadPanel({
  career, onAddPlayer, onRemovePlayer, onSetPlayerStart,
}: {
  career: CareerState;
  onAddPlayer: (hit: PlayerSearchHit, start: boolean) => void;
  onRemovePlayer: (id: string) => void;
  onSetPlayerStart: (id: string, start: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerSearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [startOnAdd, setStartOnAdd] = useState(true);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setMsg(null); return; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      fetch(`/api/star/player-search?q=${encodeURIComponent(term)}`, { cache: "no-store" })
        .then(r => r.json())
        .then((d: { results?: PlayerSearchHit[]; error?: string }) => {
          if (!alive) return;
          setHits(d.results ?? []);
          setMsg(d.error ? `Search failed: ${d.error}` : (d.results ?? []).length === 0 ? "No player found." : null);
        })
        .catch(() => { if (alive) setMsg("Search failed."); })
        .finally(() => { if (alive) setBusy(false); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const have = new Set((career.squad ?? []).map(p => p.sofifaId).filter(Boolean));
  const squad = [...(career.squad ?? [])].sort((a, b) => Number(!!b.devStart) - Number(!!a.devStart) || (b.overall ?? 0) - (a.overall ?? 0));

  return (
    <SetCard tone={TONE} strength={0.22} className="mt-2.5 p-3">
      <SetHead tone={TONE}>Dev — Squad</SetHead>
      <SetNote>Add any real player to your team, remove anyone, and pin players so they start every match.</SetNote>

      <div className="kit-row mt-2 rounded-xl p-2">
        <div className="text-[10px] font-bold text-white">Add a player</div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by name (Mbappe, Haaland, Kane…)"
          className="kit-input mt-1 w-full rounded-lg px-2 py-1.5 text-[11px] text-white"
        />
        <label className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-white">
          <input type="checkbox" checked={startOnAdd} onChange={e => setStartOnAdd(e.target.checked)} />
          Make him start
        </label>
        {busy && <SetNote>Searching…</SetNote>}
        {msg && <SetNote>{msg}</SetNote>}
        <div className="mt-1.5 space-y-1">
          {hits.map(h => (
            <div key={h.sofifaId} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1">
              <div className="min-w-0 text-[11px] font-bold text-white">
                <span className="font-black tabular-nums">{h.overall}</span>{" "}
                {h.name}
                <span className="block truncate text-[10px] font-semibold text-white/85">
                  {h.positions.split(/[^A-Za-z]+/).filter(Boolean).slice(0, 3).join("/")} · {h.club || "—"}
                </span>
              </div>
              <PressButton
                variant="gold"
                size="none"
                disabled={have.has(h.sofifaId)}
                onClick={() => onAddPlayer(h, startOnAdd)}
                className="whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-black"
              >
                {have.has(h.sofifaId) ? "In squad" : "Add to my squad"}
              </PressButton>
            </div>
          ))}
        </div>
      </div>

      <div className="kit-row mt-2 rounded-xl p-2">
        <div className="text-[10px] font-bold text-white">My squad ({squad.length}) — pinned men start every match</div>
        <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
          {squad.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-1.5 rounded-lg bg-white/5 px-2 py-1">
              <div className="min-w-0 text-[11px] font-bold text-white">
                <span className="font-black tabular-nums">{p.overall ?? "–"}</span> {p.name}
                <span className="ml-1 text-[10px] font-semibold text-white/85">{p.position}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <PressButton
                  variant={p.devStart ? "primary" : "accent"}
                  accent="#38bdf8"
                  size="none"
                  onClick={() => onSetPlayerStart(p.id, !p.devStart)}
                  className="rounded-md px-2 py-1 text-[10px] font-black text-white"
                >
                  {p.devStart ? "Starts ✓" : "Start"}
                </PressButton>
                <PressButton
                  variant="accent"
                  accent="#f43f5e"
                  size="none"
                  onClick={() => onRemovePlayer(p.id)}
                  className="rounded-md px-2 py-1 text-[10px] font-black text-white"
                >
                  Remove
                </PressButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SetCard>
  );
}
