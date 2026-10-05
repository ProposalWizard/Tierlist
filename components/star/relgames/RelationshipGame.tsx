"use client";

/**
 * ONE GAME PER RELATIONSHIP (Mikey, 4 Oct 2026, relationships revamp):
 *   boss      → The manager's penalties (BossPenalties; was Talk to your
 *               manager, BossChat, until 5 Oct 2026: too easy to read)
 *   team      → Woodwork challenge, on the real match engine
 *   fans      → Signing session
 *   happiness → Day off
 * A sponsor's game (Shoot an advert) is played from the Sponsors screen,
 * for one brand. The old emoji memory game (RelationshipMinigame.tsx) is
 * kept for the Old UI only.
 */
import type { CareerState } from "@/lib/star/types";
import type { RelationshipKind } from "../RelationshipMinigame";
import BossPenalties from "./BossPenalties";
import WoodworkChallenge from "./WoodworkChallenge";
import SigningSession from "./SigningSession";
import DayOff from "./DayOff";
import type { GameResult } from "./Shell";

export type { GameResult } from "./Shell";

export default function RelationshipGame({ kind, career, onFinish, onCancel }: {
  kind: RelationshipKind; career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void;
}) {
  if (kind === "boss") return <BossPenalties career={career} onFinish={onFinish} onCancel={onCancel} />;
  if (kind === "team") return <WoodworkChallenge career={career} onFinish={onFinish} onCancel={onCancel} />;
  if (kind === "fans") return <SigningSession career={career} onFinish={onFinish} onCancel={onCancel} />;
  return <DayOff career={career} onFinish={onFinish} onCancel={onCancel} />;
}
