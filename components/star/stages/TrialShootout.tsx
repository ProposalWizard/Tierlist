"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y } from "@/lib/star/pitch";
import { attachAutoKick, clearForShootout, type PenaltyTaker } from "@/lib/star/penaltyTaking";
import { generateSquad } from "@/lib/star/squadData";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { runupName, takerPenaltyRunup } from "@/lib/star/runupStyles";
import {
  attemptSeed, shootoutKeeperFor, shootoutOurKeeperFor, shootoutQuality, shootoutTheirRating,
  trialInvisibleStats, teachSeen, markTeachSeen,
} from "@/lib/star/trialStages";
import {
  createRig, createRigScript, rigApply, rigNextSide, rigIntent, rigKicksTaken, rigPlanFor, rigKeeperRead,
  isYourKick, winningPenaltyScored, rigGoals, pickRunups, idForRunup, MISS_LINE, SHOOTOUT_KICKS,
  type RigKick, type RigState, type RigScript,
} from "@/lib/star/trialShootoutRig";
import type { TrialProgress } from "@/lib/star/trial";
import { EngineFeature } from "@/components/star/EnginePlay";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import type { PenaltyRunupId } from "@/lib/star/runupStyles";
import { TeachCard } from "./TrialPenalties";

/**
 * THE PENALTY SHOOTOUT — the trial's last stage.
 *
 * The rig is `lib/star/trialShootoutRig.ts` (read its header). Since v0.24
 * (Harry, 2 Oct 2026): two team-mates take the Trialists' first two kicks,
 * the Academy take their three, and you take the last one — always the
 * winning penalty. How it gets to level before your kick changes from save
 * to save (0-0, 1-1 or 2-2, and which kicks go in), the misses look
 * different (wide, skied, over the bar), and every taker has his own run-up.
 *
 * One engine, as before: this file keeps the score, picks whose kick is next,
 * and hands the match one penalty picture per kick through `openOn` (the real
 * match's own penalty — keeper, ball, run-up, drag). YOUR kick is yours.
 * Every other kick is struck by the match itself (penaltyTaking.ts's automatic
 * kick) with the plan the rig chose. No loop, no physics here.
 *
 * Marked on what was yours: your one kick. What the trial hands on is whether
 * it went in — it tilts where the scout who spotted you sends you.
 */

const US = "Trialists";
const THEM = "Academy";
/** How long the final card is held before the trial moves on. */
const FINAL_HOLD_MS = 1500;
/** Kicks the team-mates take before yours. */
const MATE_KICKS = SHOOTOUT_KICKS - 1;

export interface TrialShootoutProps {
  trial: TrialProgress;
  /** `quality` is the share of YOUR kicks that scored (you take one);
   *  `finalPenScored` is whether that winning penalty went in. */
  onDone: (quality: number, finalPenScored: boolean) => void;
  skills?: { power: number; technique: number };
  playerName?: string;
  penaltyRunup?: PenaltyRunupId;
}

/**
 * Both sides' takers — invented lads, seeded off the trial. Their ids are
 * chosen so the five of them run up five different ways.
 */
function takersFor(trial: TrialProgress, seed: number): { them: PenaltyTaker[]; mates: PenaltyTaker[] } {
  const rating = shootoutTheirRating(trial);
  const runups = pickRunups(seed, SHOOTOUT_KICKS + MATE_KICKS);
  const rng = mulberry32((trial.seed ^ 0x7a1e) >>> 0);
  const side = (squadSeed: number, n: number, base: string, runupFrom: number): PenaltyTaker[] =>
    generateSquad(squadSeed)
      .filter(p => p.position !== "GK")
      .slice(0, n)
      .map((p, i) => ({
        id: idForRunup(`${base}-${i}`, runups[runupFrom + i]),
        name: p.name,
        shortName: p.shortName,
        face: p.imageUrl ?? fakeFaceFor(`${base}-${i}`),
        rating: Math.max(30, Math.min(95, Math.round(rating + (rng() - 0.5) * 10))),
      }));
  return {
    them: side((trial.seed ^ 0x51ee) >>> 0, SHOOTOUT_KICKS, "academy", 0),
    // Interleaved in kick order: Academy 1, mate 1, Academy 2, mate 2, …
    mates: side((trial.seed ^ 0x3a7e) >>> 0, MATE_KICKS, "trialist", SHOOTOUT_KICKS),
  };
}

function Slot({ k, you }: { k?: RigKick; you?: boolean }) {
  return (
    <span
      className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${
        !k ? `border-2 ${you ? "border-sky-400" : "border-gray-300"} bg-white`
          : k.scored ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
    >
      {k ? (k.scored ? "✓" : "✗") : you ? <span className="text-[8px] text-sky-500">★</span> : ""}
    </span>
  );
}

/** The score card — light, plain, no dark panel (Harry: "I like the pitch and the white and the basic"). */
function ShootoutCard({ rig, upNext }: { rig: RigState; upNext: string | null }) {
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
            Next: <span className={`font-black ${upNext === THEM ? "text-rose-600" : "text-sky-600"}`}>{upNext}</span>
          </span>
        )}
      </div>
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <div className="text-[11px] font-black text-sky-600">{US}</div>
          {/* The last slot is yours (★): the first two are your team-mates'. */}
          <div className="mt-0.5 flex gap-1">{row("you").map((k, i) => <Slot key={i} k={k} you={i === SHOOTOUT_KICKS - 1} />)}</div>
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
  const { them: takers, mates } = useMemo(() => takersFor(trial, seed), [trial, seed]);
  const script = useMemo<RigScript>(() => createRigScript(seed), [seed]);
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

  // Whose kick is up, and the keepers the trial's ramp puts there. Your one
  // kick faces the keeper the ramp has for the Trialists' third kick — the
  // same keeper the winning penalty always faced.
  const side = rigNextSide(rig.kicks);
  const ourKickNo = rigKicksTaken(rig.kicks, "you");
  const theirKickNo = rigKicksTaken(rig.kicks, "them");
  const theirKeeper = shootoutKeeperFor(trial, ourKickNo);
  const ourKeeper = shootoutOurKeeperFor(theirKickNo);
  const yours = isYourKick(rig);
  const intent = rig.over || yours ? false : rigIntent(rig, script);
  const scriptRef = useRef(script);
  scriptRef.current = script;
  const takersRef = useRef({ takers, mates });
  takersRef.current = { takers, mates };

  /** Who is on the ball for the kick that is up now (null: you). */
  const takerNow = (st: RigState): PenaltyTaker | null => {
    if (st.over || isYourKick(st)) return null;
    const s = rigNextSide(st.kicks);
    const list = s === "them" ? takersRef.current.takers : takersRef.current.mates;
    return list[Math.min(rigKicksTaken(st.kicks, s), list.length - 1)];
  };

  /** The picture for the kick that is up now. */
  const openOn = useCallback((): Scenario => {
    const st = rigRef.current;
    const s = rigNextSide(st.kicks);
    const n = st.kicks.length;
    const rng = mulberry32((seed * 7919 + n * 2654435761) >>> 0);
    const ourNo = rigKicksTaken(st.kicks, "you");
    // Once the shootout is over there is no next taker: keep the last picture
    // (the "you" penalty) instead of asking for one. Fixes a null `taker` crash.
    if (st.over || (s === "you" && isYourKick(st))) {
      const k = shootoutKeeperFor(trial, ourNo);
      const sc = buildScenario("penalty", rng, k.keeperStrength, 60, 55);
      initDefenders(sc, rng);
      sc.ball = { x: CX, y: PEN_SPOT_Y };
      clearForShootout(sc);
      return sc;
    }
    const taker = takerNow(st)!;
    const sc0 = s === "them"
      ? buildScenario("penalty", rng, shootoutOurKeeperFor(rigKicksTaken(st.kicks, "them")).keeperStrength, 60, 55)
      : buildScenario("penalty", rng, shootoutKeeperFor(trial, ourNo).keeperStrength, 60, 55);
    initDefenders(sc0, rng);
    sc0.ball = { x: CX, y: PEN_SPOT_Y };
    clearForShootout(sc0);
    const scr = scriptRef.current;
    const goes = rigIntent(st, scr);
    attachAutoKick(sc0, {
      side: s === "them" ? "them" : "us",
      taker,
      plan: rigPlanFor(goes, scr.sides[n] ?? 1, taker.rating, scr.misses[n] ?? "wide"),
      keeper: s === "them"
        ? { strength: shootoutOurKeeperFor(rigKicksTaken(st.kicks, "them")).keeperStrength, name: "Trialist keeper", shortName: "Your keeper" }
        : { strength: shootoutKeeperFor(trial, ourNo).keeperStrength, name: "Academy keeper", shortName: "Their keeper" },
      context: "shootout",
    });
    return sc0;
    // `takerNow` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, trial]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current || rigRef.current.over) return;
    setStruckOnce(true);
    const st = rigRef.current;
    const n = st.kicks.length;
    const scored = (info.outcome === "goal" || info.outcome === "rebound") && !info.teammateShot;
    if (isYourKick(st)) {
      yourKicksRef.current = [...yourKicksRef.current, scored];
      setLine(scored ? "Scored!" : info.outcome === "saved" || info.outcome === "tipped" || info.outcome === "caught" ? "Saved." : info.outcome === "post" ? "Off the post!" : "Missed.");
    } else {
      const who = takerNow(st);
      const miss = scriptRef.current.misses[n] ?? "wide";
      const how = info.outcome === "saved" || info.outcome === "caught" || info.outcome === "tipped" ? "Saved!" : MISS_LINE[miss];
      if (rigNextSide(st.kicks) === "them") setLine(scored ? "They score." : `${who?.shortName ?? "Their man"}: ${how}`);
      else setLine(scored ? `${who?.shortName ?? "He"} scores!` : `${who?.shortName ?? "He"}: ${how}`);
    }
    const next = rigApply(st, scored);
    rigRef.current = next;
    setRig(next);
    if (next.over) {
      doneRef.current = true;
      window.setTimeout(() => onDone(shootoutQuality(yourKicksRef.current), winningPenaltyScored(next)), FINAL_HOLD_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);

  const taker = takerNow(rig);
  const upNext = rig.over ? null : yours ? "You" : side === "them" ? THEM : (taker?.shortName ?? US);
  const showTeach = !struckOnce && rig.kicks.length === 0 && !teachDone;
  const trialStats = trialInvisibleStats();
  // Who is stepping up, and how he runs up (Harry: "you could explain players
  // have different run-ups for each one").
  const stepsUp = taker ? `${taker.shortName} steps up — ${runupName(takerPenaltyRunup(taker.id))}.` : "";

  return (
    <div className="w-full">
      <ShootoutCard rig={rig} upNext={upNext} />
      <div className="relative">
        <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          skills={skills}
          setPieceSkill={trialStats.setPieceSkill}
          // The keeper facing this kick and how well he reads it. On a rigged
          // goal he still dives but guesses wrong (rigKeeperRead); the
          // automatic kick names the keeper and his strength itself.
          keeperStrength={theirKeeper.keeperStrength}
          penaltyRead={
            yours ? theirKeeper.read
              : side === "them" ? rigKeeperRead(intent, ourKeeper.read)
              : rigKeeperRead(intent, theirKeeper.read)
          }
          seed={seed}
          scene={{ teammates: false }}
          penaltyRunup={penaltyRunup}
        />
        {showTeach && (
          <TeachCard
            headline="Three kicks each. Yours is the last one."
            lines={[
              "Two team-mates take our first two kicks. Every taker has his own run-up.",
              "Your kick wins it: drag back from the ball, let go, then tap the ball before the ring runs out.",
            ]}
            onDismiss={dismissTeach}
          />
        )}
      </div>
      {/* What just happened, then who is up next. */}
      <p className="mt-1 min-h-[16px] text-center text-[11px] font-bold text-gray-500">{line}</p>
      <p className="min-h-[16px] text-center text-[12px] font-black text-gray-800">
        {rig.over ? "" : yours ? "The winning penalty — it's all on you." : stepsUp}
      </p>
    </div>
  );
}
