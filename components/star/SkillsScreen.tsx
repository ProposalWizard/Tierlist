"use client";
import type { CareerState, Skills } from "@/lib/star/types";
import { setPieceDuties } from "@/lib/star/setPieces";

interface Props {
  career: CareerState;
  onTrain: (skill: keyof Skills) => void;
}

const SKILL_LABELS: [keyof Skills, string, string, string][] = [
  ["pace", "Pace", "⚡", "Sprint faster, reach through balls"],
  ["power", "Power", "💪", "Long shots and stronger crosses"],
  ["technique", "Technique", "🎯", "Ball control, curl, precise strikes"],
  ["vision", "Vision", "👁️", "Better passing options highlighted"],
  ["freeKick", "Free Kick", "🎪", "Set-piece accuracy, curl — and who takes them"],
];

const ENERGY_COST = 15;

export default function SkillsScreen({ career, onTrain }: Props) {
  const duties = setPieceDuties(career);
  return (
    <div className="mt-2 space-y-2">
      <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3 text-center">
        <div className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Training</div>
        <div className="text-sm text-white mt-0.5">Each session costs {ENERGY_COST} energy</div>
      </div>

      {/* What the free-kick rating actually buys. It was trainable, had an
          achievement and was read by no code at all. */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
        <div className="text-[10px] font-black text-amber-300 uppercase tracking-widest">Set-piece duty</div>
        <div className="mt-1 text-[11px] text-gray-200">
          {duties.freeKicks && duties.penalties
            ? "You take the free kicks and the penalties."
            : duties.penalties
              ? `Penalties are yours. Free kicks need a Free Kick rating of ${duties.freeKickNeeded}.`
              : `${career.player.club} have better takers. Penalties need ${duties.penaltyNeeded}, free kicks ${duties.freeKickNeeded}.`}
        </div>
        <div className="mt-1 text-[10px] text-gray-400">
          Judged against your club — a move up the league can cost you the ball.
        </div>
      </div>

      {SKILL_LABELS.map(([key, label, icon, desc]) => {
        const val = career.skills[key];
        const canTrain = career.energy >= ENERGY_COST && val < 100;
        return (
          <button
            key={key}
            disabled={!canTrain}
            onClick={() => onTrain(key)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition ${
              canTrain
                ? "bg-gray-700 border-gray-600 hover:bg-gray-600 active:scale-[0.98]"
                : "bg-gray-800 border-gray-700 opacity-50"
            }`}
          >
            <div className="text-2xl">{icon}</div>
            <div className="flex-1 text-left">
              <div className="font-black text-white text-sm">{label}</div>
              <div className="text-[10px] text-gray-400">{desc}</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-emerald-400">{val}</div>
              <div className="text-[9px] text-gray-500">/100</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { ENERGY_COST as TRAINING_ENERGY_COST };
