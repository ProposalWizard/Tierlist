"use client";
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "./RelationshipMinigame";

interface Props {
  career: CareerState;
  onOpenShop: (kind: "nrg" | "boots" | "lifestyle") => void;
  onOpenCasino: () => void;
  onOpenSponsors: () => void;
  onOpenAchievements: () => void;
  onOpenTrophies: () => void;
  onOpenContract: () => void;
  onUseDrink: (id: "basic" | "premium" | "elite") => void;
  onPlayRelationshipGame: (kind: RelationshipKind) => void;
}

const TRAINING_ENERGY = 15;

export default function LifeScreen({
  career, onOpenShop, onOpenCasino, onOpenSponsors, onOpenAchievements, onOpenTrophies, onOpenContract, onUseDrink, onPlayRelationshipGame,
}: Props) {
  const canPlay = career.energy >= TRAINING_ENERGY;
  return (
    <div className="mt-2 space-y-3">
      <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
        <RelationshipRow label="Boss" value={career.relationships.boss} icon="💼" onIconClick={canPlay ? () => onPlayRelationshipGame("boss") : undefined} />
        <RelationshipRow label="Team" value={career.relationships.team} icon="👕" onIconClick={canPlay ? () => onPlayRelationshipGame("team") : undefined} />
        <RelationshipRow label="Fans" value={career.relationships.fans} icon="🧣" onIconClick={canPlay ? () => onPlayRelationshipGame("fans") : undefined} />
        <RelationshipRow label="Sponsors" value={career.relationships.sponsors} icon="🤝" onIconClick={canPlay ? () => onPlayRelationshipGame("sponsors") : undefined} />
        <RelationshipRow label="Happiness" value={career.happiness} icon="😊" onIconClick={canPlay ? () => onPlayRelationshipGame("happiness") : undefined} />
        <div className="text-[9px] text-center text-emerald-300 mt-1">Tap an emoji to play a minigame and raise it (★{TRAINING_ENERGY} energy)</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <QuickBtn label="NRG" icon="🥤" onClick={() => onOpenShop("nrg")} />
        <QuickBtn label="Boots" icon="👟" onClick={() => onOpenShop("boots")} />
        <QuickBtn label="Style" icon="💎" onClick={() => onOpenShop("lifestyle")} />
        <QuickBtn label="Casino" icon="🎰" onClick={onOpenCasino} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <QuickBtn label="Sponsors" icon="🤝" onClick={onOpenSponsors} />
        <QuickBtn label="Awards" icon="⭐" onClick={onOpenAchievements} />
        <QuickBtn label="Trophies" icon="🏆" onClick={onOpenTrophies} />
      </div>

      {/* NRG drinks quick-use */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-3">
        <div className="text-[10px] font-black uppercase text-gray-300 tracking-widest mb-2">NRG Drinks</div>
        <div className="grid grid-cols-3 gap-2">
          {(["basic", "premium", "elite"] as const).map((k) => {
            const count = career.nrgDrinks[k];
            const label = k === "basic" ? "Basic" : k === "premium" ? "Premium" : "Elite";
            const restore = k === "basic" ? 25 : k === "premium" ? 50 : 100;
            const color = k === "basic" ? "bg-orange-500" : k === "premium" ? "bg-purple-500" : "bg-emerald-500";
            return (
              <button
                key={k}
                disabled={count === 0}
                onClick={() => onUseDrink(k)}
                className={`p-2 rounded-lg border ${count > 0 ? "border-gray-500 hover:bg-gray-700" : "border-gray-700 opacity-40"}`}
              >
                <div className={`w-8 h-10 mx-auto ${color} rounded border border-black/40 mb-1`} />
                <div className="text-[10px] font-black text-white">{label}</div>
                <div className="text-[9px] text-emerald-300 font-bold">+{restore}</div>
                <div className="text-[9px] text-gray-400">{count} owned</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contract summary */}
      <button
        onClick={onOpenContract}
        className="w-full bg-gray-800 rounded-lg border border-gray-700 p-3 text-left hover:bg-gray-700"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-gray-300 tracking-widest">Contract</div>
            <div className="font-black text-white text-sm">{career.contract.club}</div>
            <div className="text-[10px] text-gray-400">★{career.contract.wage}/match · {career.contract.seasonsRemaining} seasons left</div>
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

function QuickBtn({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg py-2 flex flex-col items-center transition"
    >
      <div className="text-xl">{icon}</div>
      <div className="text-[10px] font-black text-white mt-0.5">{label}</div>
    </button>
  );
}
