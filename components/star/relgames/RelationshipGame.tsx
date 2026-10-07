"use client";

/**
 * ONE GAME PER RELATIONSHIP (Mikey, 4 Oct 2026, relationships revamp):
 *   boss      → pick 1 of 3 (Harry, 6 Oct 2026, MANAGER_PLAN.md):
 *               Penalties (Mikey's BossPenalties, unchanged), Office talk
 *               (BossChat, rules in lib/star/bossTalk.ts) or Extra session
 *               (BossExtraSession). Same cost, same points scale.
 *   team      → Woodwork challenge, on the real match engine
 *   fans      → Signing session
 *   happiness → Day off
 * A sponsor's game (Shoot an advert) is played from the Sponsors screen,
 * for one brand. The old emoji memory game (RelationshipMinigame.tsx) is
 * kept for the Old UI only.
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "../RelationshipMinigame";
import BossPenalties from "./BossPenalties";
import BossChat from "./BossChat";
import BossExtraSession from "./BossExtraSession";
import WoodworkChallenge from "./WoodworkChallenge";
import SigningSession from "./SigningSession";
import DayOff from "./DayOff";
import { GameShell, type GameResult } from "./Shell";

export type { GameResult } from "./Shell";

type BossGame = "penalties" | "talk" | "session";

const BOSS_GAMES: { id: BossGame; icon: string; name: string; line: string }[] = [
  { id: "penalties", icon: "🎯", name: "Penalties", line: "He names a spot. Hit it. Three kicks." },
  { id: "talk", icon: "💬", name: "Office talk", line: "Three questions. Say what he wants to hear." },
  { id: "session", icon: "⚽", name: "Extra session", line: "Four shots while he watches. Each one harder." },
];

export default function RelationshipGame({ kind, career, onFinish, onCancel }: {
  kind: RelationshipKind; career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void;
}) {
  if (kind === "boss") return <BossGames career={career} onFinish={onFinish} onCancel={onCancel} />;
  if (kind === "team") return <WoodworkChallenge career={career} onFinish={onFinish} onCancel={onCancel} />;
  if (kind === "fans") return <SigningSession career={career} onFinish={onFinish} onCancel={onCancel} />;
  return <DayOff career={career} onFinish={onFinish} onCancel={onCancel} />;
}

function BossGames({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const [game, setGame] = useState<BossGame | null>(null);
  const back = () => setGame(null);
  if (game === "penalties") return <BossPenalties career={career} onFinish={onFinish} onCancel={back} />;
  if (game === "talk") return <BossChat career={career} onFinish={onFinish} onCancel={back} />;
  if (game === "session") return <BossExtraSession career={career} onFinish={onFinish} onCancel={back} />;
  const boss = career.manager?.name ?? "The manager";
  return (
    <GameShell title="Your manager" who="Boss" current={career.relationships.boss} tone="#60a5fa" onBack={onCancel}>
      <div className="mb-2 text-[14px] font-bold text-white">{boss} has a few minutes. How do you spend them?</div>
      <div className="space-y-2" data-boss-picker>
        {BOSS_GAMES.map((g) => (
          <button key={g.id} onClick={() => setGame(g.id)} data-boss-game={g.id}
            className="kib-press flex w-full items-center gap-3 bg-blue-500/20 px-3 py-3 text-left ring-1 ring-blue-300/60" style={{ borderRadius: 4 }}>
            <span className="text-[28px] leading-none">{g.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-black uppercase text-white">{g.name}</span>
              <span className="block text-[13px] font-bold text-white">{g.line}</span>
            </span>
            <span className="text-[18px] font-black text-blue-200">›</span>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[12px] font-bold text-white/80">All three move the Boss bar the same amount: up to +6, or −2 if it goes badly.</div>
    </GameShell>
  );
}
