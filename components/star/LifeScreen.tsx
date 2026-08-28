"use client";
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "./RelationshipMinigame";
import { actionsLeft, WEEK_ACTIONS, REST_ENERGY } from "@/lib/star/week";

interface Props {
  career: CareerState;
  onOpenContract: () => void;
  onPlayRelationshipGame: (kind: RelationshipKind) => void;
  onRest: () => void;
}

const TRAINING_ENERGY = 15;

export default function LifeScreen({
  career, onOpenContract, onPlayRelationshipGame, onRest,
}: Props) {
  const left = actionsLeft(career);
  const canPlay = career.energy >= TRAINING_ENERGY && left > 0;
  return (
    <div className="mt-2 space-y-3">
      {/* The week between matches. Energy used to be a one-way street — it never
          came back, so after two or three games you could never train again. */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">This week</span>
          <span className="text-[10px] font-bold text-white/70">Energy {Math.round(career.energy)}%</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {Array.from({ length: WEEK_ACTIONS }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full ${i < left ? "bg-emerald-400" : "bg-white/15"}`} />
          ))}
        </div>
        <div className="mt-1 text-[10px] text-white/85">
          {left > 0
            ? `${left} of ${WEEK_ACTIONS} days left. Train, work on a relationship, or rest.`
            : "The week is gone. The next match is the next week."}
        </div>
        <button
          onClick={onRest}
          disabled={left === 0 || career.energy >= 100}
          className={`mt-2 w-full py-2 rounded-lg font-black text-sm transition ${
            left === 0 || career.energy >= 100
              ? "bg-gray-700 text-white/65"
              : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]"}`}
        >
          {career.energy >= 100 ? "Fully rested" : `Rest — +${REST_ENERGY} energy 😴`}
        </button>
      </div>
      <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
        <RelationshipRow label="Boss" value={career.relationships.boss} icon="💼" onIconClick={canPlay ? () => onPlayRelationshipGame("boss") : undefined} />
        <RelationshipRow label="Team" value={career.relationships.team} icon="👕" onIconClick={canPlay ? () => onPlayRelationshipGame("team") : undefined} />
        <RelationshipRow label="Fans" value={career.relationships.fans} icon="🧣" onIconClick={canPlay ? () => onPlayRelationshipGame("fans") : undefined} />
        <RelationshipRow label="Sponsors" value={career.relationships.sponsors} icon="🤝" onIconClick={canPlay ? () => onPlayRelationshipGame("sponsors") : undefined} />
        <RelationshipRow label="Happiness" value={career.happiness} icon="😊" onIconClick={canPlay ? () => onPlayRelationshipGame("happiness") : undefined} />
        <div className="text-[9px] text-center text-emerald-300 mt-1">
          Tap an emoji to play a minigame and raise it (a day and {TRAINING_ENERGY} energy)
        </div>
      </div>

      {/* Contract summary */}
      <button
        onClick={onOpenContract}
        className="w-full bg-gray-800 rounded-lg border border-gray-700 p-3 text-left hover:bg-gray-700"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-white/85 tracking-widest">Contract</div>
            <div className="font-black text-white text-sm">{career.contract.club}</div>
            <div className="text-[10px] text-white/75">★{career.contract.wage}/match · {career.contract.seasonsRemaining} seasons left</div>
          </div>
          <div className="text-emerald-400 font-black">Renew →</div>
        </div>
      </button>
    </div>
  );
}

function RelationshipRow({ label, value, icon, onIconClick }: { label: string; value: number; icon: string; onIconClick?: () => void }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
  const IconEl = onIconClick ? "button" : "div";
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <div className={`relative flex-1 h-9 rounded-lg overflow-hidden bg-gray-700 border border-gray-600`}>
        <div className={`absolute inset-y-0 left-0 ${color} transition-all`} style={{ width: `${value}%` }} />
        <div className="relative flex items-center justify-center h-full">
          <span className="font-black text-white text-sm">{label}</span>
          <span className="ml-2 font-black text-white text-xs bg-black/40 rounded-full px-2">{value}</span>
        </div>
      </div>
      <IconEl
        onClick={onIconClick}
        className={`w-9 h-9 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-xl transition ${
          onIconClick ? "hover:bg-emerald-600 hover:border-emerald-400 cursor-pointer active:scale-90" : "cursor-default opacity-60"
        }`}
      >{icon}</IconEl>
    </div>
  );
}
