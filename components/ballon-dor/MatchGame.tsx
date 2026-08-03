"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BDPosition } from "@/lib/ballonDorTypes";
import { pickOpponentScorer } from "@/lib/ballonDorEngine";
import { shuffle } from "@/lib/shuffle";

// ── Types ────────────────────────────────────────────────────────────
type MomentType = 'power_bar' | 'goal_grid' | 'timing_bar' | 'decision';
type Outcome = 'perfect' | 'good' | 'ok' | 'miss';

interface DecisionChoice { emoji: string; label: string; desc: string; successChance: number }

interface Moment {
  id: number;
  minute: number;
  type: MomentType;
  label: string;
  situation: string;
  isGoalChance: boolean;
  isAssistChance: boolean;
  isDefensive: boolean;
  isSave: boolean;
  choices?: DecisionChoice[];
  // Rare high-risk / high-reward moment — extra drama and fame framing.
  isWonder?: boolean;
}

interface MomentResult {
  outcome: Outcome;
  isGoal: boolean;
  isAssist: boolean;
  isSave: boolean;
  didConcede: boolean;
  highlight: string;
  scorerName?: string; // opponent player who scored, if applicable
}

export interface MatchGameResult {
  playerGoals: number;
  playerAssists: number;
  playerRating: number;
  teamGoals: number;
  opponentGoals: number;
  isWin: boolean;
  isDraw: boolean;
  cleanSheet: boolean;
  // Extra fame earned from a big-match win/goal (applied by the engine)
  fameBonus?: number;
  bigMatchBonus?: boolean;
}

interface Props {
  opponent: string;
  competition: string;
  isHome: boolean;
  opponentPrestige: number;
  clubName: string;
  clubPrestige: number;
  playerPosition: BDPosition;
  playerOverall: number;
  isBigMatch?: boolean;
  onComplete: (result: MatchGameResult) => void;
}

// ── Moment templates per position ────────────────────────────────────
function getMoments(position: BDPosition): Omit<Moment, 'id' | 'minute'>[] {
  if (position === 'ATT') return [
    { type: 'goal_grid',   label: '⚽ 1-on-1!',     situation: 'The defence splits wide open — just the keeper to beat!',           isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'power_bar',   label: '⚽ Shooting!',    situation: 'The ball drops to you on the edge of the box — drive it!',           isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'timing_bar',  label: '🤜 Header!',      situation: 'Corner swings in perfectly — time your run and attack the ball!',   isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'decision',    label: '🎯 Decision!',    situation: 'A cross finds you in the six-yard box — snap decision needed.',     isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false, choices: [
      { emoji: '🚀', label: 'Shoot first time',  desc: 'Hit it hard on the volley',  successChance: 0.62 },
      { emoji: '🏃', label: 'Chest and shoot',   desc: 'Control then fire',          successChance: 0.54 },
      { emoji: '📤', label: 'Lay it off',        desc: 'Square for a tap-in',        successChance: 0.45 },
    ]},
    { type: 'power_bar',   label: '⚽ Long range!',  situation: 'A yard of space opens 25 yards out — go for goal!',                 isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'goal_grid',   label: '⚽ Penalty!',     situation: 'Foul in the box — YOU step up from the spot.',                     isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'timing_bar',  label: '⚽ Poacher!',     situation: 'The keeper spills it — react quickest and pounce!',                isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'decision',    label: '🎯 Counter!',     situation: 'You break clear on the counter, defender closing — decide!',       isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false, choices: [
      { emoji: '🚀', label: 'Go alone',        desc: 'Take on the keeper',        successChance: 0.55 },
      { emoji: '📤', label: 'Slip in support', desc: 'Play the killer pass',      successChance: 0.66 },
      { emoji: '🪄', label: 'Nutmeg him',      desc: 'Humiliate the defender',    successChance: 0.42 },
    ]},
    { type: 'power_bar',   label: '📤 Cutback!',     situation: 'You reach the byline — pick out a teammate in the middle!',        isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false },
    { type: 'goal_grid',   label: '✨ OVERHEAD KICK!', situation: 'The cross hangs behind you — dare you try the bicycle kick?!',    isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false, isWonder: true },
  ];
  if (position === 'MID') return [
    { type: 'power_bar',   label: '📤 Key pass!',    situation: 'Your striker makes a run — thread the through ball perfectly!',    isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false },
    { type: 'decision',    label: '🎯 Decision!',    situation: 'You win the ball in a tight midfield battle — what next?',         isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: false, choices: [
      { emoji: '🚀', label: 'Drive forward',   desc: 'Carry it into the box',      successChance: 0.55 },
      { emoji: '📤', label: 'Switch the play', desc: 'Find space on the far side',  successChance: 0.70 },
      { emoji: '🔄', label: 'Recycle ball',    desc: 'Keep possession safely',      successChance: 0.85 },
    ]},
    { type: 'power_bar',   label: '⚽ Long range!',  situation: 'A gap appears — thunderous effort from 30 yards!',                  isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'decision',    label: '🛡️ Defensive!',   situation: 'Their winger bursts forward — press or hold position?',           isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false, choices: [
      { emoji: '⚡', label: 'Press hard',      desc: 'Win the ball back now',      successChance: 0.55 },
      { emoji: '🧱', label: 'Hold shape',      desc: 'Slow them down',             successChance: 0.72 },
      { emoji: '🏃', label: 'Track the run',   desc: 'Stay goal-side',             successChance: 0.65 },
    ]},
    { type: 'power_bar',   label: '📤 Cross!',       situation: 'You burst into space on the right — float it in for the striker!', isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false },
    { type: 'timing_bar',  label: '📤 Set piece!',   situation: 'Free kick 35 yards out — deliver it to the back post!',           isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false },
    { type: 'goal_grid',   label: '⚽ Arriving late!', situation: 'You ghost into the box unmarked — meet the cutback first time!',  isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'decision',    label: '🎯 Tempo!',       situation: 'The game is stretched — how do you run the midfield?',             isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false, choices: [
      { emoji: '🪄', label: 'Split them open', desc: 'Defence-splitting pass',   successChance: 0.50 },
      { emoji: '📤', label: 'Quick one-two',   desc: 'Combine and release',      successChance: 0.68 },
      { emoji: '🔄', label: 'Dictate tempo',   desc: 'Control the rhythm',       successChance: 0.82 },
    ]},
    { type: 'timing_bar',  label: '🛡️ Ball-winner!', situation: 'Time your challenge to snuff out their attack!',                  isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false },
    { type: 'power_bar',   label: '✨ SCREAMER!',    situation: 'It drops to you 30 yards out — the crowd rises. Let it fly?!',     isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false, isWonder: true },
  ];
  if (position === 'DEF') return [
    { type: 'decision',    label: '🛡️ 1-on-1!',      situation: 'Their striker runs in behind — do you step in or hold?',          isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false, choices: [
      { emoji: '⚡', label: 'Slide tackle',    desc: 'Win the ball — risky',        successChance: 0.58 },
      { emoji: '🧱', label: 'Block the shot',  desc: 'Body on the line',            successChance: 0.68 },
      { emoji: '🏃', label: 'Hold and delay',  desc: 'Force him wide',              successChance: 0.75 },
    ]},
    { type: 'timing_bar',  label: '🤜 Aerial!',      situation: 'Corner comes in — win the header and clear your lines!',           isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false },
    { type: 'decision',    label: '🛡️ Interception!', situation: 'A through ball threatens your back line — react!',                isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false, choices: [
      { emoji: '⚡', label: 'Step and intercept', desc: 'Read the pass',           successChance: 0.62 },
      { emoji: '🏃', label: 'Sprint back',        desc: 'Track and recover',       successChance: 0.70 },
      { emoji: '📢', label: 'Hold the line',      desc: 'Trust the offside trap',  successChance: 0.50 },
    ]},
    { type: 'power_bar',   label: '📤 Long ball!',   situation: 'You have time on the ball deep — launch it long!',                 isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'timing_bar',  label: '🤜 Clearance!',   situation: 'Cross fizzes into your box — meet it first!',                     isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false },
    { type: 'decision',    label: '🛡️ Last man!',    situation: 'Stoppage time — you are the last man as they break!',              isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false, choices: [
      { emoji: '⚡', label: 'Foul if needed', desc: 'Take the yellow, stop the goal', successChance: 0.80 },
      { emoji: '🧱', label: 'Block the shot', desc: 'Get your body in the way',       successChance: 0.60 },
      { emoji: '🏃', label: 'Sprint to cover', desc: 'Try to recover the position',   successChance: 0.45 },
    ]},
    { type: 'timing_bar',  label: '🛡️ Sliding block!', situation: 'A shot is goalbound — throw yourself in the way!',              isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false },
    { type: 'power_bar',   label: '📤 Line-break!',  situation: 'You step out with the ball — thread it through the lines!',        isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false },
    { type: 'decision',    label: '🛡️ Hold the line!', situation: 'They load the box for a corner — organise the defence!',        isGoalChance: false, isAssistChance: false, isDefensive: true,  isSave: false, choices: [
      { emoji: '📢', label: 'Push up',        desc: 'Spring the offside trap',   successChance: 0.55 },
      { emoji: '🧱', label: 'Zonal marking',  desc: 'Hold your zone',            successChance: 0.70 },
      { emoji: '🤼', label: 'Man-mark',       desc: 'Stick to their danger man', successChance: 0.63 },
    ]},
    { type: 'timing_bar',  label: '✨ THUNDERBASTARD!', situation: 'A defender wandering forward — the ball sits up 30 yards out!',  isGoalChance: true,  isAssistChance: false, isDefensive: false, isSave: false, isWonder: true },
  ];
  // GK
  return [
    { type: 'goal_grid',   label: '🧤 Save!',        situation: 'Fierce long-range drive — pick your side!',                       isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'timing_bar',  label: '🧤 Reaction!',    situation: 'Point-blank header from a corner — pure reflexes!',               isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'goal_grid',   label: '🧤 1-on-1!',      situation: 'Their striker breaks free — spread yourself!',                    isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'power_bar',   label: '📤 Distribution', situation: 'Quick throw to start a counter-attack — weight it perfectly!',   isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: false },
    { type: 'goal_grid',   label: '🧤 Penalty save!', situation: 'Penalty. One chance. Where do you dive?',                       isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'timing_bar',  label: '🧤 Crucial stop!', situation: 'A shot deflects in the box — react in time!',                   isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'timing_bar',  label: '🧤 Rush out!',    situation: 'A through ball splits your defence — sweep it up in time!',        isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'goal_grid',   label: '🧤 Tip over!',    situation: 'A dipping shot arrows for the top corner — pick your side!',       isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true },
    { type: 'power_bar',   label: '📤 Launch it!',   situation: 'You claim it and spot a runner — launch the counter perfectly!',   isGoalChance: false, isAssistChance: true,  isDefensive: false, isSave: false },
    { type: 'goal_grid',   label: '✨ TRIPLE SAVE!', situation: 'Wave after wave crashes in — can you keep it out?!',              isGoalChance: false, isAssistChance: false, isDefensive: false, isSave: true, isWonder: true },
  ];
}

// Spread 6 moments across the 90 minutes in natural match bands
function generateMatchMinutes(): number[] {
  const pick = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  return [
    pick(4,  15),
    pick(18, 30),
    pick(33, 44),
    pick(47, 59),
    pick(62, 76),
    pick(79, 89),
  ];
}

// ── Outcome helpers ───────────────────────────────────────────────────
// center and hw (half-width) define the perfect zone position
function barOutcome(pos: number, center: number, hw: number): Outcome {
  const dist = Math.abs(pos - center);
  if (dist <= hw)      return 'perfect';
  if (dist <= hw + 13) return 'good';
  if (dist <= hw + 26) return 'ok';
  return 'miss';
}

// Difficulty < 1.0 = harder (facing a stronger team)
function goalFromOutcome(outcome: Outcome, isAttacking: boolean, chance = 1.0, difficulty = 1.0): boolean {
  if (!isAttacking) return false;
  const d = chance * difficulty;
  if (outcome === 'perfect') return Math.random() < 0.60 * d;
  if (outcome === 'good')    return Math.random() < 0.28 * d;
  return false;
}

function assistFromOutcome(outcome: Outcome): boolean {
  if (outcome === 'perfect') return Math.random() < 0.70;
  if (outcome === 'good')    return Math.random() < 0.35;
  return false;
}

function saveFromOutcome(outcome: Outcome): boolean {
  if (outcome === 'perfect') return true;
  if (outcome === 'good')    return Math.random() < 0.72;
  if (outcome === 'ok')      return Math.random() < 0.35;
  return false;
}

function outcomeLabel(outcome: Outcome): string {
  if (outcome === 'perfect') return '✨ Perfect!';
  if (outcome === 'good')    return '👍 Good';
  if (outcome === 'ok')      return '👌 Ok';
  return '❌ Missed';
}

// ── Final result computation ──────────────────────────────────────────
function computeResult(
  momentResults: MomentResult[],
  position: BDPosition,
  clubPrestige: number,
  opponentPrestige: number,
  isHome: boolean,
  isBigMatch = false,
): MatchGameResult {
  const playerGoals   = momentResults.filter(m => m.isGoal).length;
  const playerAssists = momentResults.filter(m => m.isAssist).length;
  const playerSaves   = momentResults.filter(m => m.isSave).length;
  const missCount     = momentResults.filter(m => m.outcome === 'miss').length;
  const perfCount     = momentResults.filter(m => m.outcome === 'perfect').length;
  const goodCount     = momentResults.filter(m => m.outcome === 'good').length;
  const defConcedes   = momentResults.filter(m => m.didConcede).length;

  // Teammate goals: based on club prestige ratio.
  // Every assist the player made must correspond to a teammate goal.
  const presRatio    = clubPrestige / (clubPrestige + opponentPrestige);
  const homeAdv      = isHome ? 0.08 : -0.05;
  const tmMean       = (presRatio + homeAdv) * 2.2;
  const tmGoals      = Math.max(playerAssists, Math.round(tmMean + (Math.random() - 0.5)));
  const teamGoals    = playerGoals + tmGoals;

  // Opponent goals — can never be fewer than the concedes the player watched happen live
  const oppRatio     = opponentPrestige / (clubPrestige + opponentPrestige);
  const defFail      = (position === 'DEF' || position === 'GK') ? defConcedes * 0.6 : 0;
  const oppMean      = (oppRatio - homeAdv) * 2.0 + defFail;
  const rawOppGoals  = Math.max(0, Math.round(oppMean + (Math.random() - 0.3)));
  // GK saves reduce conceded, but never below the goals that visibly went in
  const adjustedOpp   = position === 'GK' ? Math.max(0, rawOppGoals - Math.floor(playerSaves * 0.6)) : rawOppGoals;
  const opponentGoals = Math.max(adjustedOpp, defConcedes);

  const isWin  = teamGoals > opponentGoals;
  const isDraw = teamGoals === opponentGoals;
  const cleanSheet = opponentGoals === 0;

  // Big-match bonus: rising to the occasion against elite opposition earns
  // extra fame and a rating bump on a win or a goal.
  const earnedBigBonus = isBigMatch && (isWin || playerGoals > 0);
  const bigRating = earnedBigBonus ? 0.1 : 0;

  // Rating
  const baseRating = isWin ? 7.2 : isDraw ? 6.9 : 6.4;
  const perfBonus  = perfCount * 0.45 + goodCount * 0.18 - missCount * 0.28;
  const statBonus  = playerGoals * 0.40 + playerAssists * 0.24 + playerSaves * 0.32;
  const playerRating = Math.round(Math.min(9.9, Math.max(5.0, baseRating + perfBonus + statBonus + bigRating)) * 10) / 10;

  return {
    playerGoals, playerAssists, playerRating, teamGoals, opponentGoals, isWin, isDraw, cleanSheet,
    fameBonus: earnedBigBonus ? 3 : 0,
    bigMatchBonus: earnedBigBonus,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function MatchGame({
  opponent, competition, isHome, opponentPrestige,
  clubName, clubPrestige, playerPosition, playerOverall,
  isBigMatch = false,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<'intro' | 'moment' | 'flash' | 'result'>('intro');

  // Generate random minutes once per match. Shuffle the (now larger) moment pool
  // so matches vary and the wonder/rare moments occasionally appear.
  const [moments] = useState<Moment[]>(() => {
    const mins = generateMatchMinutes();
    const pool = shuffle(getMoments(playerPosition));
    return pool.slice(0, 6).map((m, i) => ({ ...m, id: i, minute: mins[i] }));
  });

  const [momentIdx, setMomentIdx] = useState(0);
  const [momentResults, setMomentResults] = useState<MomentResult[]>([]);
  const [lastMomentResult, setLastMomentResult] = useState<MomentResult | null>(null);
  const [teamScore, setTeamScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  // difficulty: 1.0 = evenly matched, lower = harder (facing stronger team).
  // Big matches are ~15% harder.
  const baseDifficulty = Math.max(0.45, Math.min(1.35, 1.0 - (opponentPrestige - clubPrestige) / 75));
  const difficulty = isBigMatch ? baseDifficulty * 0.87 : baseDifficulty;

  // Intro auto-advance
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('moment'), 2000);
    return () => clearTimeout(t);
  }, [phase]);

  function handleMomentComplete(result: MomentResult) {
    const newResults = [...momentResults, result];
    setMomentResults(newResults);
    setLastMomentResult(result);
    if (result.isGoal) setTeamScore(s => s + 1);
    if (result.didConcede) setOppScore(s => s + 1);

    setPhase('flash');
    setTimeout(() => {
      if (momentIdx + 1 >= moments.length) {
        const finalResult = computeResult(newResults, playerPosition, clubPrestige, opponentPrestige, isHome, isBigMatch);
        setTeamScore(finalResult.teamGoals);
        setOppScore(finalResult.opponentGoals);
        setTimeout(() => setPhase('result'), 600);
        setLastMomentResult({ ...result, _finalResult: finalResult } as MomentResult & { _finalResult: MatchGameResult });
      } else {
        setMomentIdx(i => i + 1);
        setPhase('moment');
      }
    }, 2600);
  }

  const currentMoment = moments[momentIdx];
  const comp = COMP_STYLE[competition] ?? COMP_STYLE.default;

  // ── Intro ─────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center px-4">
        <div className="text-center" style={{ animation: 'fadeIn 0.6s ease-out' }}>
          <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest mb-6 ${comp.badge}`}>
            {comp.icon} {competition}
          </span>
          {isBigMatch && (
            <div className="mb-5">
              <span className="inline-block rounded-full border border-orange-500/50 bg-orange-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-orange-300 animate-pulse">
                🔥 Big Match
              </span>
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">{isHome ? 'HOME' : 'AWAY'}</p>
              <p className="text-lg font-black text-white">{clubName}</p>
            </div>
            <p className="text-3xl font-black text-gray-600">vs</p>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">{isHome ? 'AWAY' : 'HOME'}</p>
              <p className="text-lg font-black text-white">{opponent}</p>
            </div>
          </div>
          <div className="flex justify-center gap-1.5">
            {[0, 200, 400].map(d => (
              <div key={d} className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-600 animate-pulse">Kick off…</p>
        </div>
      </div>
    );
  }

  // ── Flash: moment result shown briefly ───────────────────────────
  if (phase === 'flash' && lastMomentResult) {
    const isGoal   = lastMomentResult.isGoal;
    const isAssist = lastMomentResult.isAssist;
    const isSave   = lastMomentResult.isSave;
    const isMiss   = lastMomentResult.outcome === 'miss';
    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center px-4">
        <ScoreBar teamScore={teamScore} oppScore={oppScore} clubName={clubName} opponent={opponent} minute={currentMoment.minute} />
        <div className="text-center mt-12" style={{ animation: 'dropIn 0.3s ease-out' }}>
          {isGoal && (
            <>
              <p className="text-6xl mb-3">⚽</p>
              <p className="text-4xl font-black text-amber-400">GOAL!</p>
              <p className="mt-2 text-sm text-gray-400">{lastMomentResult.highlight}</p>
            </>
          )}
          {isAssist && !isGoal && (
            <>
              <p className="text-5xl mb-3">🎯</p>
              <p className="text-3xl font-black text-green-400">ASSIST!</p>
              <p className="mt-2 text-sm text-gray-400">{lastMomentResult.highlight}</p>
            </>
          )}
          {isSave && (
            <>
              <p className="text-5xl mb-3">🧤</p>
              <p className="text-3xl font-black text-blue-400">SAVED!</p>
              <p className="mt-2 text-sm text-gray-400">{lastMomentResult.highlight}</p>
            </>
          )}
          {lastMomentResult.didConcede && (
            <>
              <p className="text-5xl mb-3">😤</p>
              {lastMomentResult.scorerName ? (
                <>
                  <p className="text-2xl font-black text-red-400">{lastMomentResult.scorerName} scores!</p>
                  <p className="mt-1 text-sm text-gray-300">{opponent} pull one back</p>
                </>
              ) : (
                <p className="text-2xl font-black text-red-400">They score!</p>
              )}
              <p className="mt-2 text-sm text-gray-300">{lastMomentResult.highlight}</p>
            </>
          )}
          {!isGoal && !isAssist && !isSave && !lastMomentResult.didConcede && (
            <>
              <p className="text-4xl mb-3">{isMiss ? '💨' : '👊'}</p>
              <p className={`text-2xl font-black ${isMiss ? 'text-red-400' : 'text-gray-300'}`}>
                {outcomeLabel(lastMomentResult.outcome)}
              </p>
              <p className="mt-2 text-sm text-gray-300">{lastMomentResult.highlight}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────
  if (phase === 'result') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalResult: MatchGameResult = (lastMomentResult as any)?._finalResult ?? computeResult(
      momentResults, playerPosition, clubPrestige, opponentPrestige, isHome, isBigMatch,
    );
    const perfCount = momentResults.filter(m => m.outcome === 'perfect').length;
    const isMotm    = finalResult.playerRating >= 9.0;
    const hatTrick  = finalResult.playerGoals >= 3;

    const resultGrad  = finalResult.isWin ? 'border-green-700/30 from-green-950/40' : finalResult.isDraw ? 'border-amber-700/30 from-amber-950/40' : 'border-red-700/30 from-red-950/40';
    const resultLabel = finalResult.isWin ? 'WIN' : finalResult.isDraw ? 'DRAW' : 'LOSS';
    const resultColor = finalResult.isWin ? 'text-green-400' : finalResult.isDraw ? 'text-amber-400' : 'text-red-400';

    const home = isHome ? clubName : opponent;
    const away = isHome ? opponent : clubName;
    const hg   = isHome ? finalResult.teamGoals : finalResult.opponentGoals;
    const ag   = isHome ? finalResult.opponentGoals : finalResult.teamGoals;

    return (
      <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
          {/* Score */}
          <div className={`rounded-2xl border bg-gradient-to-b to-gray-900 p-5 ${resultGrad}`}>
            <div className="flex items-center justify-between mb-4">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${comp.badge}`}>
                {comp.icon} {competition}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-black bg-gray-950/50 ${resultColor}`}>{resultLabel}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-2 mb-5">
              <p className="text-sm font-bold text-white text-right leading-tight">{home}</p>
              <div className="text-center">
                <p className="text-5xl font-black tracking-tight leading-none">
                  <span className={isHome ? resultColor : 'text-white'}>{hg}</span>
                  <span className="text-gray-700 text-3xl mx-1">–</span>
                  <span className={!isHome ? resultColor : 'text-white'}>{ag}</span>
                </p>
              </div>
              <p className="text-sm font-bold text-white text-left leading-tight">{away}</p>
            </div>

            {hatTrick && <div className="mb-4 rounded-xl bg-amber-500/20 border border-amber-500/30 py-2.5 text-center"><p className="text-sm font-black text-amber-400">🎩 Hat-Trick Hero!</p></div>}
            {isMotm && !hatTrick && <div className="mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 py-2.5 text-center"><p className="text-sm font-black text-yellow-300">⭐ Player of the Match</p></div>}
            {finalResult.bigMatchBonus && <div className="mb-4 rounded-xl bg-orange-500/15 border border-orange-500/30 py-2.5 text-center"><p className="text-sm font-black text-orange-300">🔥 Big match bonus — +3 Fame · +0.1 Rating</p></div>}

            <div className="flex items-center justify-center gap-6">
              {(playerPosition === 'ATT' || playerPosition === 'MID') && (
                <>
                  <div className="text-center"><p className="text-2xl font-black text-white">{finalResult.playerGoals}</p><p className="text-[9px] text-gray-500 uppercase mt-0.5">Goals</p></div>
                  <div className="text-center"><p className="text-2xl font-black text-white">{finalResult.playerAssists}</p><p className="text-[9px] text-gray-500 uppercase mt-0.5">Assists</p></div>
                </>
              )}
              {(playerPosition === 'DEF' || playerPosition === 'GK') && finalResult.cleanSheet && (
                <div className="text-center"><p className="text-2xl">🧤</p><p className="text-[9px] text-gray-500 uppercase mt-0.5">Clean Sheet</p></div>
              )}
              <div className="text-center">
                <p className={`text-2xl font-black ${finalResult.playerRating >= 8 ? 'text-amber-400' : finalResult.playerRating < 6.5 ? 'text-red-400' : 'text-white'}`}>
                  {finalResult.playerRating.toFixed(1)}
                </p>
                <p className="text-[9px] text-gray-500 uppercase mt-0.5">Rating</p>
              </div>
            </div>
          </div>

          {/* Performance breakdown */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-3">Your Performance</p>
            <div className="space-y-1.5">
              {momentResults.map((mr, i) => {
                const m = moments[i];
                const col = mr.outcome === 'perfect' ? 'text-amber-400' : mr.outcome === 'good' ? 'text-green-400' : mr.outcome === 'ok' ? 'text-gray-400' : 'text-red-400';
                const badge = mr.isGoal ? '⚽' : mr.isAssist ? '🎯' : mr.isSave ? '🧤' : '';
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-700 w-6 text-right">{m.minute}&apos;</span>
                    <span className="text-xs text-gray-500 flex-1 truncate">{m.label}</span>
                    {badge && <span className="text-sm">{badge}</span>}
                    <span className={`text-[10px] font-black ${col}`}>{outcomeLabel(mr.outcome)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-black text-amber-400">{perfCount}</p>
                <p className="text-[9px] text-gray-600">Perfect</p>
              </div>
              <div>
                <p className="text-lg font-black text-green-400">{momentResults.filter(m => m.outcome === 'good').length}</p>
                <p className="text-[9px] text-gray-600">Good</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-400">{momentResults.filter(m => m.outcome === 'miss').length}</p>
                <p className="text-[9px] text-gray-600">Missed</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onComplete(finalResult)}
            className="w-full rounded-xl bg-amber-500 py-4 text-sm font-black text-black hover:bg-amber-400 transition"
          >
            Full Time →
          </button>
        </div>
      </div>
    );
  }

  // ── Moment ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <ScoreBar teamScore={teamScore} oppScore={oppScore} clubName={clubName} opponent={opponent} minute={currentMoment.minute} />

      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-3">
        {moments.map((_, i) => (
          <span key={i} className={`w-2 h-2 rounded-full transition-all ${
            i < momentIdx ? 'bg-gray-600' : i === momentIdx ? 'bg-amber-400 scale-125' : 'bg-gray-800'
          }`} />
        ))}
      </div>

      {/* Moment content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mx-auto max-w-sm pt-2 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
              {currentMoment.minute}&apos; — Moment {momentIdx + 1} of {moments.length}
            </p>
            <h3 className="text-lg font-black text-white mb-1">{currentMoment.label}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{currentMoment.situation}</p>
          </div>

          {currentMoment.type === 'power_bar' && (
            <PowerBarGame
              key={`pb_${currentMoment.id}`}
              moment={currentMoment}
              difficulty={difficulty}
              opponent={opponent}
              onComplete={handleMomentComplete}
            />
          )}
          {currentMoment.type === 'goal_grid' && (
            <GoalGridGame
              key={`gg_${currentMoment.id}`}
              moment={currentMoment}
              difficulty={difficulty}
              opponent={opponent}
              onComplete={handleMomentComplete}
            />
          )}
          {currentMoment.type === 'timing_bar' && (
            <TimingBarGame
              key={`tb_${currentMoment.id}`}
              moment={currentMoment}
              difficulty={difficulty}
              opponent={opponent}
              onComplete={handleMomentComplete}
            />
          )}
          {currentMoment.type === 'decision' && currentMoment.choices && (
            <DecisionGame
              key={`dc_${currentMoment.id}`}
              moment={currentMoment}
              choices={currentMoment.choices}
              difficulty={difficulty}
              opponent={opponent}
              onComplete={handleMomentComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────
function ScoreBar({ teamScore, oppScore, clubName, opponent, minute }: {
  teamScore: number; oppScore: number; clubName: string; opponent: string; minute: number;
}) {
  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <p className="text-sm font-black text-white truncate max-w-[30%]">{clubName}</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-white">{teamScore}</span>
          <span className="text-xs text-gray-600">{minute}&apos;</span>
          <span className="text-2xl font-black text-white">{oppScore}</span>
        </div>
        <p className="text-sm font-black text-white truncate max-w-[30%] text-right">{opponent}</p>
      </div>
    </div>
  );
}

// ── Power bar game ─────────────────────────────────────────────────────
function PowerBarGame({ moment, difficulty, opponent, onComplete }: {
  moment: Moment; difficulty: number; opponent: string; onComplete: (r: MomentResult) => void;
}) {
  const [pos, setPos] = useState(5);
  const [stopped, setStopped] = useState(false);
  const [stoppedPos, setStoppedPos] = useState<number | null>(null);
  const dirRef = useRef(1);
  // Faster oscillation: 3.5–5.0 (was 2.2–3.0)
  const speedRef = useRef(3.5 + Math.random() * 1.5);
  // Randomise perfect zone: centre between 30–70, half-width 8 (16% wide, was 20%)
  const zoneCenterRef = useRef(30 + Math.floor(Math.random() * 41));
  const PERFECT_HW = 8;
  const GOOD_HW    = PERFECT_HW + 13;
  const OK_HW      = PERFECT_HW + 26;

  const zoneCenter = zoneCenterRef.current;

  // Compute segment widths for the dynamic zone display
  const seg = {
    missL:    Math.max(0, zoneCenter - OK_HW),
    okL:      Math.max(0, zoneCenter - GOOD_HW),
    goodL:    Math.max(0, zoneCenter - PERFECT_HW),
    perfectL: Math.max(0, zoneCenter - PERFECT_HW),
    perfectR: Math.min(100, zoneCenter + PERFECT_HW),
    goodR:    Math.min(100, zoneCenter + GOOD_HW),
    okR:      Math.min(100, zoneCenter + OK_HW),
  };

  const w = {
    missL:   seg.missL,
    okL:     seg.okL - seg.missL,
    goodL:   seg.goodL - seg.okL,
    perfect: seg.perfectR - seg.perfectL,
    goodR:   seg.goodR - seg.perfectR,
    okR:     seg.okR - seg.goodR,
    missR:   100 - seg.okR,
  };

  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => {
      setPos(p => {
        let n = p + dirRef.current * speedRef.current;
        if (n >= 100) { dirRef.current = -1; n = 100; }
        if (n <= 0)   { dirRef.current =  1; n = 0;   }
        return n;
      });
    }, 30);
    return () => clearInterval(id);
  }, [stopped]);

  const stop = useCallback(() => {
    if (stopped) return;
    setStopped(true);
    setStoppedPos(pos);
    const outcome = barOutcome(pos, zoneCenter, PERFECT_HW);
    const isGoal   = goalFromOutcome(outcome, moment.isGoalChance, 1.0, difficulty);
    const isAssist = moment.isAssistChance && assistFromOutcome(outcome);
    const didConcede = moment.isDefensive && outcome === 'miss' && Math.random() < 0.5;

    const highlights: Record<string, Record<string, string>> = {
      perfect: { goal: 'Unstoppable. Top corner!', assist: 'Perfectly weighted — striker taps in!', default: 'Inch-perfect execution.' },
      good:    { goal: 'Good finish — finds the net!', assist: 'Good delivery — a tap-in for your striker!', default: 'Solid technique.' },
      ok:      { goal: '', assist: '', default: 'A bit wayward — keeper claims.' },
      miss:    { goal: '', assist: '', default: 'Completely off target.' },
    };

    const hl = highlights[outcome]?.[isGoal ? 'goal' : isAssist ? 'assist' : 'default'] ?? '';
    const scorerName = didConcede ? (pickOpponentScorer(opponent) ?? undefined) : undefined;
    setTimeout(() => onComplete({ outcome, isGoal, isAssist, isSave: false, didConcede, highlight: hl, scorerName }), 600);
  }, [stopped, pos, moment, difficulty, zoneCenter, opponent, onComplete]);

  const stoppedOutcome = stoppedPos !== null ? barOutcome(stoppedPos, zoneCenter, PERFECT_HW) : null;
  const cursorColor = stoppedOutcome === 'perfect' ? 'bg-green-400' : stoppedOutcome === 'good' ? 'bg-yellow-400' : stoppedOutcome === 'ok' ? 'bg-orange-400' : stoppedOutcome === 'miss' ? 'bg-red-500' : 'bg-white';

  return (
    <div className="space-y-6">
      {/* Bar */}
      <div
        className="relative h-14 rounded-2xl overflow-hidden cursor-pointer select-none touch-none"
        onClick={stop}
        onTouchStart={stop}
      >
        {/* Dynamic zone gradient */}
        <div className="absolute inset-0 flex">
          {w.missL  > 0 && <div className="h-full bg-red-900/70"    style={{ width: `${w.missL}%` }} />}
          {w.okL    > 0 && <div className="h-full bg-orange-800/60"  style={{ width: `${w.okL}%` }} />}
          {w.goodL  > 0 && <div className="h-full bg-yellow-700/60"  style={{ width: `${w.goodL}%` }} />}
          {w.perfect > 0 && <div className="h-full bg-green-600/80"  style={{ width: `${w.perfect}%` }} />}
          {w.goodR  > 0 && <div className="h-full bg-yellow-700/60"  style={{ width: `${w.goodR}%` }} />}
          {w.okR    > 0 && <div className="h-full bg-orange-800/60"  style={{ width: `${w.okR}%` }} />}
          {w.missR  > 0 && <div className="h-full bg-red-900/70"    style={{ width: `${w.missR}%` }} />}
        </div>
        {/* Perfect label floated over its zone */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
          style={{ left: `${seg.perfectL}%`, width: `${w.perfect}%` }}
        >
          <p className="text-[9px] font-black text-green-300 uppercase tracking-wide">Perfect</p>
        </div>
        {/* Cursor */}
        <div
          className={`absolute top-0 bottom-0 w-1.5 rounded-full transition-none shadow-lg ${stoppedPos !== null ? cursorColor : 'bg-white'}`}
          style={{ left: `calc(${stoppedPos ?? pos}% - 3px)` }}
        />
      </div>

      {stoppedPos !== null && (
        <p className="text-center text-base font-black text-amber-400" style={{ animation: 'fadeIn 0.2s ease' }}>
          {outcomeLabel(barOutcome(stoppedPos, zoneCenter, PERFECT_HW))}
        </p>
      )}

      {!stopped && (
        <button
          onClick={stop}
          className="w-full rounded-2xl bg-amber-500 py-5 text-xl font-black text-black hover:bg-amber-400 active:scale-95 transition-all select-none"
        >
          SHOOT! 🎯
        </button>
      )}
    </div>
  );
}

// ── Goal grid game ─────────────────────────────────────────────────────
function GoalGridGame({ moment, difficulty, opponent, onComplete }: {
  moment: Moment; difficulty: number; opponent: string; onComplete: (r: MomentResult) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [keeperCells, setKeeperCells] = useState<number[]>([]);

  function pick(cell: number) {
    if (picked !== null) return;
    const all = [0, 1, 2, 3, 4, 5];
    const kc = shuffle(all).slice(0, 2);
    setPicked(cell);
    setKeeperCells(kc);

    const covered = kc.includes(cell);

    // Apply difficulty: covered shots are fully blocked; uncovered apply difficulty to goal chance
    const isGoal   = moment.isGoalChance && !covered && Math.random() < 0.82 * difficulty;
    const isSave   = moment.isSave && covered;
    const didConcede = moment.isSave && !covered;

    // Outcome grade must agree with what actually happened: an uncovered shot
    // that still doesn't go in is only "good", never "perfect"
    const outcome: Outcome = moment.isGoalChance
      ? (isGoal ? 'perfect' : !covered ? 'good' : Math.random() < 0.3 ? 'good' : 'miss')
      : (!covered ? 'perfect' : Math.random() < 0.3 ? 'good' : 'miss');

    const highlight = moment.isSave
      ? (covered ? 'Brilliant dive — the striker is denied!' : 'Goes the wrong way — the ball hits the net.')
      : (isGoal ? 'Keeper goes the wrong way — net bulges!' : covered ? 'Keeper dives the right way — excellent stop!' : 'Great placement, but the keeper scrambles it away!');

    const conc = moment.isSave ? !covered : false;
    const scorerName = conc ? (pickOpponentScorer(opponent) ?? undefined) : undefined;
    setTimeout(() => onComplete({
      outcome: moment.isSave ? (covered ? 'perfect' : 'miss') : outcome,
      isGoal:    moment.isGoalChance ? isGoal : false,
      isAssist:  false,
      isSave:    moment.isSave ? covered : false,
      didConcede: conc,
      highlight,
      scorerName,
    }), 1000);
  }

  const LABELS     = ['Top L', 'Top C', 'Top R', 'Bot L', 'Bot C', 'Bot R'];
  const LABEL_ICONS = ['↖', '↑', '↗', '↙', '↓', '↘'];

  return (
    <div className="space-y-4">
      <div className="border-2 border-gray-600 rounded-lg overflow-hidden">
        <div className="grid grid-cols-3 gap-0.5 bg-gray-800 p-0.5">
          {[0, 1, 2, 3, 4, 5].map(cell => {
            const isKeeper  = keeperCells.includes(cell);
            const isPicked  = picked === cell;
            const isGoalCell = isPicked && !isKeeper;
            return (
              <button
                key={cell}
                onClick={() => pick(cell)}
                disabled={picked !== null}
                className={`h-16 flex flex-col items-center justify-center rounded transition-all duration-200 ${
                  picked === null
                    ? 'bg-gray-900 hover:bg-gray-700 hover:scale-105 active:scale-95'
                    : isGoalCell
                    ? 'bg-green-900/60 border-2 border-green-500'
                    : isKeeper
                    ? 'bg-blue-900/60 border-2 border-blue-500'
                    : isPicked
                    ? 'bg-red-900/60 border-2 border-red-500'
                    : 'bg-gray-900'
                }`}
              >
                {picked === null && (
                  <span className="text-lg text-gray-600">{LABEL_ICONS[cell]}</span>
                )}
                {picked !== null && isKeeper && <span className="text-2xl">🧤</span>}
                {picked !== null && isPicked && !isKeeper && <span className="text-2xl">⚽</span>}
                {picked !== null && !isKeeper && !isPicked && (
                  <span className="text-[9px] text-gray-700">{LABELS[cell]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-xs text-gray-500">
        {moment.isSave ? 'Pick which way to dive' : 'Pick your corner to shoot'}
      </p>
    </div>
  );
}

// ── Timing bar game ────────────────────────────────────────────────────
function TimingBarGame({ moment, difficulty, opponent, onComplete }: {
  moment: Moment; difficulty: number; opponent: string; onComplete: (r: MomentResult) => void;
}) {
  const [pos, setPos] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [pressedPos, setPressedPos] = useState<number | null>(null);
  const dirRef = useRef(1);
  // Randomise sweet spot: centre 25–75, half-width 6 (narrower than power bar)
  const zoneCenterRef = useRef(25 + Math.floor(Math.random() * 51));
  const PERFECT_HW = 6;
  const GOOD_HW    = PERFECT_HW + 12;
  const OK_HW      = PERFECT_HW + 24;

  const zoneCenter = zoneCenterRef.current;

  const seg = {
    perfectL: Math.max(0, zoneCenter - PERFECT_HW),
    perfectR: Math.min(100, zoneCenter + PERFECT_HW),
    goodL:    Math.max(0, zoneCenter - GOOD_HW),
    goodR:    Math.min(100, zoneCenter + GOOD_HW),
    okL:      Math.max(0, zoneCenter - OK_HW),
    okR:      Math.min(100, zoneCenter + OK_HW),
  };

  const w = {
    missL:   seg.okL,
    okL:     seg.goodL - seg.okL,
    goodL:   seg.perfectL - seg.goodL,
    perfect: seg.perfectR - seg.perfectL,
    goodR:   seg.goodR - seg.perfectR,
    okR:     seg.okR - seg.goodR,
    missR:   100 - seg.okR,
  };

  useEffect(() => {
    if (pressed) return;
    // Speed 3.2–4.5 (was 2.8–4.0)
    const speed = 3.2 + Math.random() * 1.3;
    const id = setInterval(() => {
      setPos(p => {
        let n = p + dirRef.current * speed;
        if (n >= 100) { dirRef.current = -1; n = 100; }
        if (n <= 0)   { dirRef.current =  1; n = 0;   }
        return n;
      });
    }, 28);
    return () => clearInterval(id);
  }, [pressed]);

  const press = useCallback(() => {
    if (pressed) return;
    setPressed(true);
    setPressedPos(pos);
    const outcome: Outcome = barOutcome(pos, zoneCenter, PERFECT_HW);
    const isGoal   = goalFromOutcome(outcome, moment.isGoalChance, 0.7, difficulty);
    const isAssist = moment.isAssistChance && assistFromOutcome(outcome);
    const isSave   = moment.isSave && saveFromOutcome(outcome);
    const didConcede = (moment.isDefensive || moment.isSave) && (outcome === 'miss' || (outcome === 'ok' && Math.random() < 0.4));

    const hl = isGoal ? 'Powerful header — back of the net!' :
               isAssist ? 'Perfect delivery — your striker converts!' :
               isSave ? 'Brilliant reflexes — what a stop!' :
               didConcede ? 'He gets there first — it goes in.' :
               outcome === 'perfect' ? 'Excellent execution!' : outcome === 'miss' ? 'Completely mistimed.' : 'Not quite right.';
    const scorerName = didConcede ? (pickOpponentScorer(opponent) ?? undefined) : undefined;
    setTimeout(() => onComplete({ outcome, isGoal, isAssist, isSave, didConcede, highlight: hl, scorerName }), 600);
  }, [pressed, pos, moment, difficulty, zoneCenter, opponent, onComplete]);

  const pressedOutcome = pressedPos !== null ? barOutcome(pressedPos, zoneCenter, PERFECT_HW) : null;
  const cursorColor = pressedOutcome === 'perfect' ? 'bg-green-400' : pressedOutcome === 'good' ? 'bg-yellow-400' : pressedOutcome === 'ok' ? 'bg-orange-400' : pressedOutcome === 'miss' ? 'bg-red-400' : 'bg-white';

  return (
    <div className="space-y-6">
      {/* Timing track */}
      <div
        className="relative h-14 rounded-2xl overflow-hidden cursor-pointer select-none touch-none"
        onClick={press}
        onTouchStart={press}
      >
        <div className="absolute inset-0 flex">
          {w.missL   > 0 && <div className="h-full bg-red-900/70"    style={{ width: `${w.missL}%` }} />}
          {w.okL     > 0 && <div className="h-full bg-orange-800/60"  style={{ width: `${w.okL}%` }} />}
          {w.goodL   > 0 && <div className="h-full bg-yellow-700/60"  style={{ width: `${w.goodL}%` }} />}
          {w.perfect  > 0 && <div className="h-full bg-green-600/80"  style={{ width: `${w.perfect}%` }} />}
          {w.goodR   > 0 && <div className="h-full bg-yellow-700/60"  style={{ width: `${w.goodR}%` }} />}
          {w.okR     > 0 && <div className="h-full bg-orange-800/60"  style={{ width: `${w.okR}%` }} />}
          {w.missR   > 0 && <div className="h-full bg-red-900/70"    style={{ width: `${w.missR}%` }} />}
        </div>
        {/* Sweet spot label over perfect zone */}
        <div
          className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
          style={{ left: `${seg.perfectL}%`, width: `${w.perfect}%` }}
        >
          <p className="text-[8px] font-black text-green-300 uppercase tracking-widest whitespace-nowrap">NOW</p>
        </div>
        {/* Cursor */}
        <div
          className={`absolute top-1 bottom-1 w-2 rounded-full shadow-xl transition-none ${pressedPos !== null ? cursorColor : 'bg-white'}`}
          style={{ left: `calc(${pressedPos ?? pos}% - 4px)` }}
        />
      </div>

      {pressedPos !== null && pressedOutcome && (
        <p className={`text-center text-base font-black ${
          pressedOutcome === 'perfect' ? 'text-green-400' : pressedOutcome === 'good' ? 'text-yellow-400' : pressedOutcome === 'ok' ? 'text-orange-400' : 'text-red-400'
        }`} style={{ animation: 'fadeIn 0.2s ease' }}>
          {outcomeLabel(pressedOutcome)}
        </p>
      )}

      {!pressed && (
        <button
          onClick={press}
          className="w-full rounded-2xl bg-blue-600 py-5 text-xl font-black text-white hover:bg-blue-500 active:scale-95 transition-all select-none"
        >
          NOW! ⚡
        </button>
      )}
    </div>
  );
}

// ── Decision game ──────────────────────────────────────────────────────
function DecisionGame({ moment, choices, difficulty, opponent, onComplete }: {
  moment: Moment; choices: DecisionChoice[]; difficulty: number; opponent: string; onComplete: (r: MomentResult) => void;
}) {
  const [timeLeft, setTimeLeft] = useState(3000);
  const [picked, setPicked] = useState<number | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const doneRef = useRef(false);

  const resolve = useCallback((choiceIdx: number | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const c = choiceIdx !== null ? choices[choiceIdx] : null;
    const s = c ? Math.random() < c.successChance : false;
    setSuccess(s);

    const outcome: Outcome = choiceIdx === null ? 'miss' : s ? (c!.successChance > 0.65 ? 'good' : 'perfect') : 'ok';
    const isGoal   = goalFromOutcome(s ? 'good' : 'ok', moment.isGoalChance, 0.55, difficulty);
    const isAssist = moment.isAssistChance && s && Math.random() < 0.5;
    const didConcede = moment.isDefensive && !s && Math.random() < 0.45;

    const hl = choiceIdx === null ? 'No decision made in time!' :
               isGoal ? `${c!.label} — and it's a goal!` :
               isAssist ? `${c!.label} — perfectly played!` :
               didConcede ? `${c!.label} — he slots it home.` :
               s ? `${c!.label} — good decision!` : `${c!.label} — doesn't quite come off.`;
    const scorerName = didConcede ? (pickOpponentScorer(opponent) ?? undefined) : undefined;
    setTimeout(() => onComplete({ outcome, isGoal, isAssist, isSave: false, didConcede, highlight: hl, scorerName }), 700);
  }, [choices, moment, difficulty, opponent, onComplete]);

  useEffect(() => {
    if (picked !== null) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 100) { clearInterval(id); resolve(null); return 0; }
        return t - 80;
      });
    }, 80);
    return () => clearInterval(id);
  }, [picked, resolve]);

  function choose(idx: number) {
    if (picked !== null || doneRef.current) return;
    setPicked(idx);
    resolve(idx);
  }

  return (
    <div className="space-y-4">
      {/* Countdown bar */}
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-75 ${timeLeft > 1500 ? 'bg-green-500' : timeLeft > 750 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${(timeLeft / 3000) * 100}%` }}
        />
      </div>
      <p className="text-center text-xs text-gray-500">Decide quickly!</p>

      {/* Choices */}
      <div className="space-y-2.5">
        {choices.map((c, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            disabled={picked !== null}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              picked === i
                ? success
                  ? 'border-green-600/50 bg-green-900/30'
                  : 'border-red-600/50 bg-red-900/30'
                : picked !== null
                ? 'border-gray-800 bg-gray-900/30 opacity-40'
                : 'border-gray-700 bg-gray-900 hover:border-amber-500/50 hover:bg-gray-800 active:scale-[0.98]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{c.label}</p>
                <p className="text-xs text-gray-500">{c.desc}</p>
              </div>
              {picked === i && <span className="text-xl">{success ? '✅' : '❌'}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Competition styles ────────────────────────────────────────────────
const COMP_STYLE: Record<string, { badge: string; icon: string }> = {
  'Premier League':    { badge: 'bg-purple-900/40 border border-purple-700/50 text-purple-300', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Champions League':  { badge: 'bg-blue-900/40 border border-blue-700/50 text-blue-300',       icon: '⭐' },
  'Europa League':     { badge: 'bg-orange-900/40 border border-orange-700/50 text-orange-300', icon: '🟠' },
  'FA Cup':            { badge: 'bg-red-900/40 border border-red-700/50 text-red-300',          icon: '🏆' },
  'Pre-Season':        { badge: 'bg-gray-800 border border-gray-700 text-gray-400',             icon: '⚽' },
  default:             { badge: 'bg-gray-800 border border-gray-700 text-gray-400',             icon: '⚽' },
};
