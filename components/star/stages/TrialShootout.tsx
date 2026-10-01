"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y } from "@/lib/star/pitch";
import { attachAutoKick, clearForShootout, type PenaltyTaker } from "@/lib/star/penaltyTaking";
import { generateSquad } from "@/lib/star/squadData";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import {
  attemptSeed, shootoutKeeperFor, shootoutOurKeeperFor, shootoutQuality, shootoutTheirRating,
  trialInvisibleStats, teachSeen, markTeachSeen,
} from "@/lib/star/trialStages";
import {
  createRig, rigApply, rigNextSide, rigTheirIntent, rigKicksTaken, rigPlanFor, rigKeeperRead,
  isWinningPenalty, winningPenaltyScored, rigGoals, SHOOTOUT_KICKS, type RigKick, type RigState,
} from "@/lib/star/trialShootoutRig";
import type { TrialProgress } from "@/lib/star/trial";
import { EngineFeature } from "@/components/star/EnginePlay";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import type { PenaltyRunupId } from "@/lib/star/runupStyles";
import { TeachCard } from "./TrialPenalties";

/**
 * THE PENALTY SHOOTOUT — the trial's last stage, and the only one with more
 * than one kick (Harry, 1 Oct 2026).
 *
 * Reviewing the v0.20 trial he said: every other drill is one attempt, "it's
 * just a tutorial on how to play the game, and then you get a pen shootout to
 * really enjoy that", rigged "so it always has you having to score the winning
 * pen, and that's how it should end". His answers on the page: Trialist versus
 * Academy; up to three kicks each; both keepers harder each kick; keep the
 * bad-luck events.
 *
 * The rig is `lib/star/trialShootoutRig.ts` (read its header): Academy go first
 * in every round and only score when you are ahead, so the score is level when
 * your third kick is up, and that kick is the winning penalty.
 *
 * One engine, as before: this file keeps the score, picks whose kick is next,
 * and hands the match one penalty picture per kick through `openOn` (the real
 * match's own penalty — keeper, ball, run-up, drag). YOUR kicks are yours.
 * THEIR kicks are struck by the match itself (penaltyTaking.ts's automatic
 * kick) with the plan the rig chose. No loop, no physics here. Both keepers get
 * sharper kick by kick on the same ramp (`shootoutKeeperFor`,
 * `shootoutOurKeeperFor`), and the adversity event (a keeper on fire) still
 * lands on your kicks.
 *
 * Marked on what was yours: the share of your kicks that went in. What the
 * trial hands on is whether the LAST one did — it tilts where the scout who
 * spotted you sends you.
 */

const US = "Trialists";
const THEM = "Academy";
/** How long the final card is held before the trial moves on. */
const FINAL_HOLD_MS = 1500;

export interface TrialShootoutProps {
  trial: TrialProgress;
  /** `quality` is the share of YOUR kicks that scored; `finalPenScored` is
   *  whether the winning penalty (your last kick) went in. */
  onDone: (quality: number, finalPenScored: boolean) => void;
  skills?: { power: number; technique: number };
  playerName?: string;
  penaltyRunup?: PenaltyRunupId;
}

/** Their takers — invented lads, seeded off the trial. */
function theirSide(trial: TrialProgress): { takers: PenaltyTaker[] } {
  const rating = shootoutTheirRating(trial);
  const squad = generateSquad((trial.seed ^ 0x51ee) >>> 0);
  const rng = mulberry32((trial.seed ^ 0x7a1e) >>> 0);
  const takers = squad
    .filter(p => p.position !== "GK")
    .slice(0, SHOOTOUT_KICKS)
    .map((p, i) => ({
      id: `academy-${i}`,
      name: p.name,
      shortName: p.shortName,
      face: p.imageUrl ?? fakeFaceFor(`academy-${i}`),
      rating: Math.max(30, Math.min(95, Math.round(rating + (rng() - 0.5) * 10))),
    }));
  return { takers };
}

function Slot({ k }: { k?: RigKick }) {
  return (
    <span
      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
        !k ? "border-2 border-gray-300 bg-white"
          : k.scored ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
    >
      {k ? (k.scored ? "✓" : "✗") : ""}
    </span>
  );
}

/** The score card — light, plain, no dark panel (Harry: "I like the pitch and the white and the basic"). */
function ShootoutCard({ rig, upNext }: { rig: RigState; upNext: "you" | "them" | null }) {
  const row = (side: "you" | "them") => {
    const ks = rig.kicks.filter(k => k.side === side);
    return Array.from({ length: SHOOTOUT_KICKS }, (_, i) => ks[i]);
  };
  const you = rigGoals(rig.kicks, "you"), them = rigGoals(rig.kicks, "them");
  return (
    <div className="mb-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Penalty shootout</span>
        {upNext && (
          <span className="text-[10px] font-bold text-gray-500">
            Next: <span className={`font-black ${upNext === "you" ? "text-sky-600" : "text-rose-600"}`}>{upNext === "you" ? "You" : THEM}</span>
          </span>
        )}
      </div>
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <div className="text-[11px] font-black text-sky-600">{US}</div>
          <div className="mt-0.5 flex gap-1">{row("you").map((k, i) => <Slot key={i} k={k} />)}</div>
        </div>
        <div className="text-xl font-black tabular-nums text-gray-900">{you}–{them}</div>
        <div className="text-right">
          <div className="text-[11px] font-black text-rose-600">{THEM}</div>
          <div className="mt-0.5 flex justify-end gap-1">{row("them").map((k, i) => <Slot key={i} k={k} />)}</div>
        </div>
      </div>
      {rig.over && (
        <div className="mt-1 text-center text-[12px] font-black uppercase tracking-wide text-emerald-600">
          {rig.winner === "you" ? `${US} win ${you}–${them} on penalties` : `Level at ${you}–${them}`}
        </div>
      )}
    </div>
  );
}

export default function TrialShootout({
  trial, onDone, skills = { power: 55, technique: 55 }, playerName = "You", penaltyRunup,
}: TrialShootoutProps) {
  const seed = attemptSeed(trial);
  const { takers } = useMemo(() => theirSide(trial), [trial]);
  void playerName;

  const [rig, setRig] = useState<RigState>(createRig);
  const rigRef = useRef(rig);
  rigRef.current = rig;
  const yourKicksRef = useRef<boolean[]>([]);
  const doneRef = useRef(false);
  const [line, setLine] = useState("");
  const [struckOnce, setStruckOnce] = useState(false);

  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen("shootout")) setTeachDone(true); }, []);
  const dismissTeach = useCallback(() => { markTeachSeen("shootout"); setTeachDone(true); }, []);

  // Whose kick is up, and the keepers the trial's ramp puts there.
  const side = rigNextSide(rig.kicks);
  const yourKickNo = rigKicksTaken(rig.kicks, "you");
  const theirKickNo = rigKicksTaken(rig.kicks, "them");
  const theirKeeper = shootoutKeeperFor(trial, yourKickNo);
  const ourKeeper = shootoutOurKeeperFor(theirKickNo);
  const theirIntent = rigTheirIntent(rig.kicks);
  const takersRef = useRef(takers);
  takersRef.current = takers;

  /** The picture for the kick that is up now. */
  const openOn = useCallback((): Scenario => {
    const st = rigRef.current;
    const s = rigNextSide(st.kicks);
    const n = st.kicks.length;
    const rng = mulberry32((seed * 7919 + n * 2654435761) >>> 0);
    if (s === "you") {
      const k = shootoutKeeperFor(trial, rigKicksTaken(st.kicks, "you"));
      const sc = buildScenario("penalty", rng, k.keeperStrength, 60, 55);
      initDefenders(sc, rng);
      sc.ball = { x: CX, y: PEN_SPOT_Y };
      clearForShootout(sc);
      return sc;
    }
    const k = rigKicksTaken(st.kicks, "them");
    const taker = takersRef.current[Math.min(k, takersRef.current.length - 1)];
    const ours = shootoutOurKeeperFor(k);
    const sc = buildScenario("penalty", rng, ours.keeperStrength, 60, 55);
    initDefenders(sc, rng);
    sc.ball = { x: CX, y: PEN_SPOT_Y };
    clearForShootout(sc);
    if (!st.over) {
      attachAutoKick(sc, {
        side: "them", taker,
        plan: rigPlanFor(rigTheirIntent(st.kicks), rng() < 0.5 ? -1 : 1, taker.rating),
        keeper: { strength: ours.keeperStrength, name: "Trialist keeper", shortName: "Your keeper" },
        context: "shootout",
      });
    }
    return sc;
  }, [seed, trial]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current || rigRef.current.over) return;
    setStruckOnce(true);
    const st = rigRef.current;
    const s = rigNextSide(st.kicks);
    const scored = (info.outcome === "goal" || info.outcome === "rebound") && !info.teammateShot;
    if (s === "you") {
      yourKicksRef.current = [...yourKicksRef.current, scored];
      setLine(scored ? "Scored!" : info.outcome === "saved" || info.outcome === "tipped" || info.outcome === "caught" ? "Saved." : info.outcome === "post" ? "Off the post!" : "Missed.");
    } else {
      setLine(scored ? "They score." : "They miss!");
    }
    const next = rigApply(st, scored);
    rigRef.current = next;
    setRig(next);
    if (next.over) {
      doneRef.current = true;
      window.setTimeout(() => onDone(shootoutQuality(yourKicksRef.current), winningPenaltyScored(next)), FINAL_HOLD_MS);
    }
  }, [onDone]);

  const yours = side === "you" && !rig.over;
  const winning = isWinningPenalty(rig);
  const showTeach = !struckOnce && rig.kicks.length === 0 && !teachDone;
  const trialStats = trialInvisibleStats();

  return (
    <div className="w-full">
      <ShootoutCard rig={rig} upNext={rig.over ? null : side} />
      <div className="relative">
        <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          skills={skills}
          setPieceSkill={trialStats.setPieceSkill}
          // The keeper facing this kick and how well he reads it — theirs on
          // your kicks, yours on theirs. On THEIR rigged goal your keeper still
          // dives but guesses wrong (rigKeeperRead); the automatic kick names
          // your keeper and his strength itself.
          keeperStrength={theirKeeper.keeperStrength}
          penaltyRead={yours ? theirKeeper.read : rigKeeperRead(theirIntent, ourKeeper.read)}
          seed={seed}
          scene={{ teammates: false }}
          penaltyRunup={penaltyRunup}
        />
        {showTeach && (
          <TeachCard
            headline="Three kicks each — the last one wins it."
            short="Three each. Win it with the last."
            lines={[
              "Drag back from the ball, then let go — pull further for more power.",
              "Then you run up: tap the ball before the ring runs out.",
            ]}
            onDismiss={dismissTeach}
          />
        )}
      </div>
      <p className="mt-1 min-h-[16px] text-center text-[11px] font-bold text-gray-600">
        {rig.over
          ? ""
          : yours
            ? (winning ? "The winning penalty — it's all on you." : (line || "Your kick. Drag back from the ball to aim."))
            : (line || "Their kick — your keeper's in goal.")}
      </p>
    </div>
  );
}
