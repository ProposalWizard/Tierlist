"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y } from "@/lib/star/pitch";
import {
  createShootout, takeNextKick, nextShootoutSide, nextTakerIndex,
  type PenaltyShootoutState,
} from "@/lib/star/shootout";
import {
  attachAutoKick, clearForShootout, planPenalty, type PenaltyTaker,
} from "@/lib/star/penaltyTaking";
import { generateSquad } from "@/lib/star/squadData";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import {
  attemptSeed, shootoutKeeperFor, shootoutOurKeeperFor, shootoutQuality, shootoutTheirRating,
  trialInvisibleStats, teachSeen, markTeachSeen,
} from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import { EngineFeature } from "@/components/star/EnginePlay";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import { ShootoutStrip } from "@/components/star/LiveShootout";
import type { PenaltyRunupId } from "@/lib/star/runupStyles";
import { TeachCard } from "./TrialPenalties";

/**
 * THE PENALTY SHOOTOUT — the trial's last stage (1 Oct 2026).
 *
 * Harry: "maybe a penalty shootout instead of pens as the last one." So the
 * three plain penalties became a real shootout against another side:
 * alternate kicks, five each, the early finish, sudden death after that — the
 * same state machine every shootout in the game runs (lib/star/shootout.ts),
 * drawn with the same strip the live match and Infinite Highlights use.
 *
 * One engine, the way ShootoutPlay (Infinite Highlights) does it: this file
 * only keeps the score, picks whose kick is next, and hands the match one
 * penalty picture per kick through `openOn`. YOUR side's kicks are all yours
 * — it is your trial. THEIR kicks are struck by the match itself
 * (penaltyTaking.ts's automatic kick, the same strike a player's kick goes
 * through) at your keeper. No loop, no physics here. Both keepers get
 * sharper kick by kick on the same ramp (see `shootoutKeeperFor` and
 * `shootoutOurKeeperFor`, trialStages.ts, for why and the measurements).
 *
 * Marked on what was yours: the share of your kicks that went in
 * (`shootoutQuality`). Whether your side won is the story on the strip; it
 * does not move the number, because their kicks were never yours to take.
 */

const US = "Trialists";
const THEM = "Academy";
/** How long the final strip is held before the trial moves on. */
const FINAL_HOLD_MS = 2200;

export interface TrialShootoutProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
  skills?: { power: number; technique: number };
  playerName?: string;
  penaltyRunup?: PenaltyRunupId;
}

/** Their five takers and their keeper — invented lads, seeded off the trial. */
function theirSide(trial: TrialProgress): { takers: PenaltyTaker[] } {
  const rating = shootoutTheirRating(trial);
  const squad = generateSquad((trial.seed ^ 0x51ee) >>> 0);
  const rng = mulberry32((trial.seed ^ 0x7a1e) >>> 0);
  const takers = squad
    .filter(p => p.position !== "GK")
    .slice(0, 5)
    .map((p, i) => ({
      id: `academy-${i}`,
      name: p.name,
      shortName: p.shortName,
      face: p.imageUrl ?? fakeFaceFor(`academy-${i}`),
      // A little spread around the day's rating, best first.
      rating: Math.max(30, Math.min(95, Math.round(rating + (rng() - 0.5) * 10))),
    }))
    .sort((a, b) => b.rating - a.rating);
  return { takers };
}

export default function TrialShootout({
  trial, onDone, skills = { power: 55, technique: 55 }, playerName = "You", penaltyRunup,
}: TrialShootoutProps) {
  const seed = attemptSeed(trial);
  const { takers } = useMemo(() => theirSide(trial), [trial]);
  const you: PenaltyTaker = useMemo(
    () => ({ id: "you", name: playerName, shortName: "You", rating: 60, you: true }),
    [playerName],
  );

  const [state, setState] = useState<PenaltyShootoutState>(createShootout);
  const stateRef = useRef(state);
  stateRef.current = state;
  const yourKicksRef = useRef<boolean[]>([]);
  const doneRef = useRef(false);
  const [line, setLine] = useState("");
  const [struckOnce, setStruckOnce] = useState(false);

  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen("shootout")) setTeachDone(true); }, []);
  const dismissTeach = useCallback(() => { markTeachSeen("shootout"); setTeachDone(true); }, []);

  // Whose kick is up, and (for yours) the keeper the trial's ramp puts there.
  const side = nextShootoutSide(state);
  const yourKickNo = state.kicks.filter(k => k.side === "home").length;
  const theirKeeper = shootoutKeeperFor(trial, yourKickNo);
  const ourKeeper = shootoutOurKeeperFor(state.kicks.filter(k => k.side === "away").length);
  const takersRef = useRef(takers);
  takersRef.current = takers;

  /** The picture for the kick that is up now. */
  const openOn = useCallback((): Scenario => {
    const st = stateRef.current;
    const s = nextShootoutSide(st);
    const n = st.kicks.length;
    const rng = mulberry32((seed * 7919 + n * 2654435761) >>> 0);
    if (s === "home") {
      const k = shootoutKeeperFor(trial, st.kicks.filter(kk => kk.side === "home").length);
      const sc = buildScenario("penalty", rng, k.keeperStrength, 60, 55);
      initDefenders(sc, rng);
      sc.ball = { x: CX, y: PEN_SPOT_Y };
      clearForShootout(sc);
      return sc;
    }
    const order = takersRef.current;
    const taker = order[nextTakerIndex(st, "away", order.length)];
    const ours = shootoutOurKeeperFor(st.kicks.filter(kk => kk.side === "away").length);
    const sc = buildScenario("penalty", rng, ours.keeperStrength, 60, 55);
    initDefenders(sc, rng);
    sc.ball = { x: CX, y: PEN_SPOT_Y };
    clearForShootout(sc);
    if (!st.over) {
      attachAutoKick(sc, {
        side: "them", taker, plan: planPenalty(taker.rating, rng),
        keeper: { strength: ours.keeperStrength, name: "Trialist keeper", shortName: "Your keeper" },
        context: "shootout",
      });
    }
    return sc;
  }, [seed, trial]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current || stateRef.current.over) return;
    setStruckOnce(true);
    const st = stateRef.current;
    const s = nextShootoutSide(st);
    const scored = (info.outcome === "goal" || info.outcome === "rebound") && !info.teammateShot;
    if (s === "home") {
      yourKicksRef.current = [...yourKicksRef.current, scored];
      setLine(scored ? "Scored!" : info.outcome === "saved" || info.outcome === "tipped" || info.outcome === "caught" ? "Saved." : info.outcome === "post" ? "Off the post!" : "Missed.");
    } else {
      setLine(scored ? "They score." : "Your keeper keeps it out!");
    }
    const next = takeNextKick(st, scored, s === "home" ? 1 : takersRef.current.length);
    stateRef.current = next;
    setState(next);
    if (next.over) {
      doneRef.current = true;
      window.setTimeout(() => onDone(shootoutQuality(yourKicksRef.current)), FINAL_HOLD_MS);
    }
  }, [onDone]);

  const order = side === "home" ? [you] : takers;
  const up = order[nextTakerIndex(state, side, order.length)];
  const showTeach = !struckOnce && state.kicks.length === 0 && !teachDone;
  const yours = side === "home" && !state.over;
  const trialStats = trialInvisibleStats();

  return (
    <div className="w-full">
      <div className="mb-1">
        <ShootoutStrip
          fixed
          homeClub={US} awayClub={THEM} homeColor="#38bdf8" awayColor="#f87171"
          state={state} final={state.over}
          upNext={state.over ? null : { side, name: up?.you ? "You" : up?.shortName ?? "…" }}
        />
      </div>
      <div className="relative">
        <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          skills={skills}
          setPieceSkill={trialStats.setPieceSkill}
          // The keeper facing this kick and how well he reads it — theirs on
          // your kicks, yours on theirs (the automatic kick names your keeper
          // and his strength itself; the read comes from here).
          keeperStrength={theirKeeper.keeperStrength}
          penaltyRead={yours ? theirKeeper.read : ourKeeper.read}
          seed={seed}
          scene={{ teammates: false }}
          penaltyRunup={penaltyRunup}
        />
        {showTeach && (
          <TeachCard
            headline="Your side's kicks are all yours."
            short="Every kick is yours."
            lines={[
              "Drag back from the ball, then let go — pull further for more power.",
              "Five each, then sudden death. Then you run up: tap the ball before the ring runs out.",
            ]}
            onDismiss={dismissTeach}
          />
        )}
      </div>
      <p className="mt-1 min-h-[16px] text-center text-[11px] font-bold text-white/70">
        {line || (yours ? "Your kick. Drag back from the ball to aim." : "Their kick — your keeper's in goal.")}
      </p>
    </div>
  );
}
