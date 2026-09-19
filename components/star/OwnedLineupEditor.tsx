"use client";
import type { CareerState, LeagueSquad } from "@/lib/star/types";
import type { SavedLineup } from "@/lib/star/lineupStore";
import LineupBuilder from "./LineupBuilder";

/**
 * THE BOARDROOM'S OWN LINEUP EDITOR — SAVE-SCOPED, NEVER THE GLOBAL TEMPLATE.
 *
 * Reuses `LineupBuilder.tsx` wholesale for the actual tap-to-swap editing
 * (formation picker, pitch slots, bench/reserves) — nothing about that
 * interaction needed rebuilding, so it isn't. The only thing that changes is
 * WHERE it reads from and writes to: `LineupBuilder`'s new `persistence`
 * prop redirects both away from `lineupStore.ts`'s shared table and onto
 * `career.ownedLineups[club]` instead (see types.ts's own doc on that
 * field, and clubPowers.ts's `setOwnedLineup`, which validates every id
 * against the club's REAL current squad in this save before it's ever
 * written). `lockClub` hides the club dropdown — this modal is always for
 * exactly one club, the one the Boardroom is already open on — and the
 * Backup tool is hidden automatically (LineupBuilder skips it whenever
 * `persistence` is provided, since a per-save override has nothing to do
 * with the shared table Backup reads and restores).
 */
export default function OwnedLineupEditor({
  club, squad, career, onClose, onSave,
}: {
  club: string;
  squad: LeagueSquad;
  career: CareerState;
  onClose: () => void;
  onSave: (club: string, lineup: SavedLineup) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col gap-1.5 rounded-xl border border-gray-700 bg-gray-900 p-3">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-sm font-black text-white">Edit lineup — this save only</h2>
          <button onClick={onClose} className="rounded-lg bg-gray-700 px-2.5 py-1 text-[11px] font-black text-white hover:bg-gray-600">
            Done
          </button>
        </div>
        <div className="mb-1 shrink-0 text-[10px] font-semibold text-white/70">
          Changes here decide this club&apos;s real matchday XI from now on — but only in THIS career. Every other
          save (and the global lineup template at /lineups) is completely untouched.
        </div>
        <div className="min-h-0 flex-1">
          <LineupBuilder
            clubs={[club]}
            squads={[squad]}
            initialClub={club}
            lockClub
            persistence={{
              load: c => career.ownedLineups?.[c] ?? null,
              save: (c, lineup) => onSave(c, lineup),
            }}
          />
        </div>
      </div>
    </div>
  );
}
