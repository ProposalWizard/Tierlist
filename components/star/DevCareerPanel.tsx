"use client";
import type { CareerState } from "@/lib/star/types";

/**
 * DEV CAREER — a testing tool, not a gameplay mechanic.
 *
 * Requested directly: "add everything that could affect testing but requires
 * playing the game and takes time to dev tools so the admin user can cheat
 * to test quicker (becoming captain, getting money (already done), getting
 * reputation, fame, stats from training, lifestyle, the club you're at,
 * etc)." Same unguarded "developers and admins" spirit as `DevSkipPanel`/
 * `DevMoneyPanel` right above this on the same screen — no login role or
 * feature flag gates any of them.
 *
 * Club changes go through the real `attachClub` (careerFlow.ts) rather than
 * hand-writing `career.player.club` — that function also handles the
 * contract, the first-signing achievement and the garden-weeks bookkeeping,
 * so a dev-cheated club change leaves the save in exactly the shape a real
 * transfer would.
 */

const SKILL_KEYS = ["pace", "power", "technique", "vision", "freeKick"] as const;

export default function DevCareerPanel({
  career, onSetCaptain, onSetReputation, onSetFame, onMaxSkills, onSetHappiness, onSwitchClub,
}: {
  career: CareerState;
  onSetCaptain: (captain: boolean) => void;
  onSetReputation: (delta: number) => void;
  onSetFame: (delta: number) => void;
  onMaxSkills: () => void;
  onSetHappiness: (delta: number) => void;
  onSwitchClub: (club: string) => void;
}) {
  const clubOptions = career.league.map(t => t.name).filter(n => n !== career.player.club);

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Dev — Career</div>
      <p className="mt-1 text-[11px] font-semibold text-white/90">
        Skip the grind for testing captaincy, boardroom powers, training gains or a club move.
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white/85">
          Captain: <span className={career.captain ? "text-emerald-400" : "text-white/50"}>
            {career.captain ? "Yes" : "No"}
          </span>
        </span>
        <button
          onClick={() => onSetCaptain(!career.captain)}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 font-black text-xs text-black whitespace-nowrap"
        >
          {career.captain ? "Remove captaincy" : "Make captain"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-gray-900/60 p-2">
          <div className="text-[10px] font-bold text-white/70">Reputation ({career.reputation})</div>
          <div className="mt-1 flex gap-1">
            <button onClick={() => onSetReputation(25)} className="flex-1 py-1 rounded bg-sky-600 hover:bg-sky-500 text-[10px] font-black text-white">+25</button>
            <button onClick={() => onSetReputation(100)} className="flex-1 py-1 rounded bg-sky-600 hover:bg-sky-500 text-[10px] font-black text-white">Max</button>
          </div>
        </div>
        <div className="rounded-lg bg-gray-900/60 p-2">
          <div className="text-[10px] font-bold text-white/70">Fame ({career.fame})</div>
          <div className="mt-1 flex gap-1">
            <button onClick={() => onSetFame(1000)} className="flex-1 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-[10px] font-black text-white">+1000</button>
            <button onClick={() => onSetFame(100000)} className="flex-1 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-[10px] font-black text-white">Max</button>
          </div>
        </div>
        <div className="rounded-lg bg-gray-900/60 p-2">
          <div className="text-[10px] font-bold text-white/70">Happiness ({career.happiness})</div>
          <div className="mt-1 flex gap-1">
            <button onClick={() => onSetHappiness(25)} className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-black text-white">+25</button>
            <button onClick={() => onSetHappiness(100)} className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 text-[10px] font-black text-white">Max</button>
          </div>
        </div>
        <div className="rounded-lg bg-gray-900/60 p-2">
          <div className="text-[10px] font-bold text-white/70">
            Skills ({SKILL_KEYS.map(k => career.skills[k]).join("/")})
          </div>
          <button
            onClick={onMaxSkills}
            className="mt-1 w-full py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black text-white"
          >
            Max all to 99
          </button>
        </div>
      </div>

      {clubOptions.length > 0 && (
        <div className="mt-2 rounded-lg bg-gray-900/60 p-2">
          <div className="text-[10px] font-bold text-white/70">
            Club: {career.player.club} — instantly attach elsewhere in this division
          </div>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { onSwitchClub(e.target.value); e.target.value = ""; } }}
            className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white"
          >
            <option value="" disabled>Move to…</option>
            {clubOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
