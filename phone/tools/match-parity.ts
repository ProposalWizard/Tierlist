/**
 * PARITY CHECK: the phone's match vs the website's call order.
 *
 * For many matches (different careers, fixtures and seeds), two runs with the
 * same inputs and the same player (tools/match-bot.ts):
 *   1. THE PHONE: src/match/driver.ts, ticked frame by frame exactly as the
 *      phone screen ticks it (timers, phases, the commentary clock).
 *   2. THE WEBSITE: `websiteMatch` below, a straight-line transcription of the
 *      lib/star calls components/star/CanvasMatch.tsx makes, in its order
 *      (startSimulation → loadScenario → the frame loop → handleContact →
 *      resolveOutcome → … → finaliseMatch), with no screen, no timers and no
 *      phases: just the calls, one after the other.
 * Every chance's kind, outcome, minute and random-number count, the score,
 * and the whole MatchStats must be identical. Exit code 1 on any difference.
 *
 *   npx esbuild phone/tools/match-parity.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --outfile=/tmp/match-parity.mjs && node /tmp/match-parity.mjs [matches] [--break]
 *
 * `--break` makes the website side draw one extra random number at its first
 * strike: the check must then FAIL (proves it can see a difference).
 */
import {
  buildScenario, launch, stepBall, stepKeeper, stepDefenders, stepReactions, initDefenders,
  chainReturnChance, CHAIN_MAX, applyFirstTouch, goalInView, OUTCOME_TEXT, clamp, dragForFullPower,
  orderableRunners, acceptsCaptainOrders, setOffsideRuleEnabled, setClearanceRules, getClearanceRules,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Vec2, type Viewport,
} from "@/lib/star/canvasEngine";
import { newMatch, advanceTo, resolveScenario, lateSubQuota, noteServedKind, type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent } from "@/lib/star/hiddenMatch";
import { makeChance, pictureMemory, setVisitSalt } from "@/lib/star/chanceMaker";
import { separateBodies } from "@/lib/star/spacing";
import { newSelectionMemory } from "@/lib/star/scenarioSelect";
import { pressFromBehind } from "@/lib/star/pressure";
import { setPieceSkills } from "@/lib/star/setPieces";
import { pickWaveSizes, newRun as newFpRun, stepRun as stepFpRun, wavesBeaten as fpWavesBeaten } from "@/lib/star/firstPersonDribble";
import { dribbleReward } from "@/lib/star/dribbleReward";
import { oldBallPhysics, gameplayVersion } from "@/lib/star/gameplayVersion";
import { setHitboxes } from "@/lib/star/hitbox";
import { setBallPhysics, realBallOn } from "@/lib/star/ballPhysics";
import { getTuning } from "@/lib/star/tuningStore";
import { PITCH_W, CX, HALF_LEN } from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";
import { newChancesOn } from "@/lib/star/newChances";
import { stepPlayOn, carryFrom, carryOnLeadIn, MAX_LAY_OFFS, runAfterWanted, startPlayOnRun, type PlayOn, type CarryFrom } from "@/lib/star/playOn";
import { afterPassStickOn } from "@/lib/star/afterPass";
import { mechanicOpen } from "@/lib/star/mechanics";
import { dealDribble, dribbleLevelFor, newDribbleDeal, type DribbleDeal } from "@/lib/star/dribbleDeal";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { deflectBlock } from "@/lib/star/deflection";
import { steerDeflectionFromOwnGoal, clearLooseWin } from "@/lib/star/defenderTouch";
import { matchInputsFor, careerMatchSpec } from "@/lib/star/matchInputs";
import { commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult } from "@/lib/star/matchCommentary";
import { finaliseMatch, fairRating } from "@/lib/star/matchStats";
import { goalZone, passGrade, missKind } from "@/lib/star/chanceRating";
import { runStretch } from "@/lib/star/stretchRun";
import { hookCheck, subComesOnNow, SUB_OFF_ENERGY, type HookReason } from "@/lib/star/selection";
import type { ChanceEntry } from "@/lib/star/chanceLog";
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import { castScenario, castDefence, creatorOf, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { formationShapeInput } from "@/lib/star/formationShape";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { penaltyRunupOf, freeKickRunupOf, takerRunupFor, yourRunupFor, standBackFor, planRunup, runupPositionAt, RUNUP_MOTION, LEAF_RUNUP, type RunupId } from "@/lib/star/runupStyles";
import { airborneOn, airborneMotion, applyAirborne, type StrikeContact } from "@/lib/star/airborneChance";
import { isAirKind, airZOf } from "@/lib/star/airDrawings";
import { airTapOn, airTapAim, airTapStrike, AIR_TAP_OPEN_S, AIR_TAP_OPEN_NO_LEAD_S, type AirKind } from "@/lib/star/airTap";
import { aerialMovesOn, forcedAerialMove, pickAerialMove, aerialStrikeTint, AERIAL_SPECS, CONTACT_SHOW_S, type AerialMove } from "@/lib/star/aerialMoves";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "@/lib/star/teamsheet";
import { creditChance, assistFor, noteMatePlays, probeMatePlays, type MatePlay } from "@/lib/star/credit";
import { attachAutoKick, autoKickOf, aimFor, planPenalty, takerSkills, takerRating, designatedTaker, AUTO_STAND_MS, type PenaltyTaker } from "@/lib/star/penaltyTaking";
import { divisionOf } from "@/lib/star/calendar";
import type { MatchStats, GoalEvent, OppGoalEvent, SquadPlayer, CareerState, StarPlayer, Fixture } from "@/lib/star/types";
import { stepKnuckle } from "@/lib/star/shotModel";
import { energyFactorFor, energyPerMinute, clampEnergy, tiredKickSkills, fatigueCut, type EnergyMode } from "@/lib/star/energy";
import { aerialOf } from "@/lib/star/aerial";
import { penaltyReadFor, decidePenaltyRead, applyPenaltyRead } from "@/lib/star/penaltyKeeper";
import { strikeKind, stepKind, enforceHardRules, type StrikeDecision } from "@/lib/star/kindRules";
import { switchOn } from "@/lib/star/compareSwitches";
import { strikingPower } from "@/lib/star/strikePower";
import { brainOptionsHere, hasBrain, brainSetup, brainAim, brainRunUp, brainStrike, brainStep } from "@/lib/star/keeperBrain";
import { strikeTimerFor, hasRunup, canNudge, goalLineX, nudgedDir, scuffStrike, cheekyStrike, isCheekyMiss } from "@/lib/star/penaltyRunup";
import { frameForNewView, crossCutCamera, turnWideChance } from "@/lib/star/matchView";
import { hasExtraTime, createShootout, takeNextKick, penaltyConversionChance, type ExtraTimeCompetition } from "@/lib/star/shootout";
import { currentTie as euroCurrentTie, currentLeg as euroCurrentLeg } from "@/lib/star/euro";
import { rollAddedTime, addedTimeSeed } from "@/lib/star/addedTime";
import { leadInEntities, stakesOf, type LeadIn, type LeadEntity, type LeadMoment } from "@/lib/star/leadIn";
import { careerBuildUp } from "@/lib/star/leadInGen";
import { fhrOn } from "@/lib/star/fhr/toggle";
import { cameraTilt } from "@/lib/star/cameraTilt";
import { giveAndGoChance } from "@/lib/star/giveAndGo";
import { airStrikeTimerS, airLateContact } from "@/lib/star/airborneChance";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { NATIONAL_LEAGUE_SOUTH_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS } from "@/lib/star/clubs";
import { MatchDriver } from "../src/match/driver";
import { matchSetupFor, type MatchSetup } from "../src/match/setup";
import { playWithBot, botWait, botContactWait, botContact, botAim, flatPullFor } from "./match-bot";

// A phone has a `window` but no localStorage: lib settings read their defaults, as on the phone.
(globalThis as Record<string, unknown>).window ??= {};

const argv = (globalThis as { process?: { argv: string[]; exit(c: number): never } }).process!.argv;
const BREAK = argv.includes("--break");
const DT = 1 / 60;
/** A setTimeout of `ms` ran this many 60 fps frames later. */
const frames = (ms: number) => Math.max(1, Math.ceil((ms * 60) / 1000 - 1e-9));

interface Out { stats: MatchStats; trace: string[]; score: string }

/**
 * THE WEBSITE: CanvasMatch's lib/star calls for one whole match, in its
 * order, played by the bot. Line references are to components/star/CanvasMatch.tsx.
 */
function websiteMatch(setup: MatchSetup, hw: number, botSeed: number): Out {
  const career = setup.career, fixture = setup.fixture;
  const trace: string[] = [];
  // ── props and refs (843-2240) ──
  const MATCH_DURATION = ruleBookFor(career, "FA").matchLengthMinutes ?? 90;
  setOffsideRuleEnabled(!ruleBookFor(career, "FA").offsideAbolished);
  const ADDED = rollAddedTime(mulberry32(addedTimeSeed(setup.seed)));
  let ceiling = MATCH_DURATION + ADDED;
  const startingXI = startingTeammateRoles(career, fixture);
  const oppXI = opponentStartingXI(career, fixture);
  const oppXIForCast: OpponentSheetPlayer[] | null = oppXI ? oppXI.map((p) => ({ id: p.id, name: p.name, shortName: p.short, position: p.role, overall: p.overall, face: p.face ?? fakeFaceFor(p.id), isGK: p.role === "GK", y: p.y, defending: p.defending })) : null;
  const realKeeper = oppXIForCast?.find((p) => p.isGK)?.overall;
  const strength = realKeeper !== undefined ? Math.max(20, Math.min(99, realKeeper)) : setup.keeperStrength;
  const team = setup.teamRelationship, vision = career.skills.vision ?? 55, oppStrength = setup.oppStrength ?? 65;
  const runupStyle = { pen: penaltyRunupOf(setup.penaltyRunup), fk: freeKickRunupOf(setup.freeKickRunup) };
  const energyFactor = energyFactorFor(career, fixture);
  const onPitch = (sq: SquadPlayer[]) => onPitchToday(fillMissingFromFullRoster(sq, startingXI, career), startingXI);
  const mayTake = (k: ScenarioKind) => { const d = setup.duties; if (!d) return true; if (k === "free_kick") return d.freeKicks; if (k === "penalty") return d.penalties; if (k === "corner") return d.corners ?? true; return true; };
  const resultFor = (r: Outcome): ScenarioResult => OUTCOME_TEXT[r].kind === "goal" ? "goal" : r === "delivered" || r === "touchOn" ? "delivered" : r === "tackled" || r === "blocked" ? "lost" : "saved";

  let seed = setup.seed;
  let st: HiddenMatchState = newMatch(mulberry32(setup.seed));
  const calls = { n: 0 };
  let rng: () => number = Math.random;
  const counted = (s: number) => { const raw = mulberry32(s); calls.n = 0; return () => { calls.n++; return raw(); }; };
  let userScore = 0, oppScore = 0, attempts = 0, matchMinute = 0, energy = career.energy ?? 100, energyClock = 0;
  const energyMode: EnergyMode = "medium";
  const goalEvents: GoalEvent[] = [], oppGoalEvents: OppGoalEvent[] = [], chanceLog: ChanceEntry[] = [];
  const cheekyMisses: { kind: string; minute: number }[] = [];
  const t = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 };
  let hooked: HookReason | null = null, hookedAt: number | null = null, enteredAt = setup.startMinute, subOn = false, subChances = 0, subFitness = 100;
  let etStage = 0, wentET = false, shootout: { home: number; away: number } | null = null, boardShown = false;
  let pendingRequest: ScenarioRequest | null = null, handover: "penalty" | "free_kick" | null = null, setPieceNext: ScenarioKind | null = null;
  let chain: { pos: Vec2; depth: number; ambition: number; kind?: ScenarioKind; touchTouches?: number } | null = null;
  let carryOn: CarryFrom | null = null, lastDeal: ScenarioRequest["deal"] = undefined, dDeal: { deal: DribbleDeal; rng: () => number } | null = null;
  const selMem = newSelectionMemory();
  let chanceNo = 0;
  const playstyle = career.playstyle ?? "balanced";

  const live = (m: number) => hooked ? energy : clampEnergy(energy - Math.max(0, m - energyClock) * energyPerMinute(energyMode, energyFactor));
  const charge = (m: number) => { if (m > energyClock) { energy = live(m); energyClock = m; } };
  const tired = (): KickSkills => { const k = tiredKickSkills(setup.skills, live(matchMinute)); return { power: k.power, technique: k.technique }; };
  const inputs = (): HiddenMatchInputs => matchInputsFor(careerMatchSpec(career, fixture, {
    oppStrength, position: setup.position, kick: setup.skills, energy: live(matchMinute), energyMode, impactSub: setup.startMinute > 0, farewell: false,
    lateSub: subOn ? { enteredAt, owed: Math.max(0, lateSubQuota(enteredAt) - subChances), fitness: subFitness } : undefined,
    addedTime: ADDED, fullTime: MATCH_DURATION, teamFallback: team, playstyle,
  }));
  const rating = () => fairRating({ ...t, passes: t.passesCompleted }, userScore, oppScore).rating;
  const label = () => career.player.lastName || "you";
  const moment = () => { const y = label(); const pool = [`The move works its way to ${y}.`, `It breaks for ${y}.`, `The ball is worked through to ${y}.`, `It's picked out for ${y}.`, `The move reaches ${y}.`, `It comes to ${y}.`, `A gap opens up for ${y}.`, `The ball finds its way to ${y}.`]; return pool[Math.floor(rng() * pool.length)]; };
  const target = (sc: Scenario) => sc.kind === "volley" || sc.kind === "header" ? sc.crosser?.shortName : sc.runner?.who?.shortName ?? sc.secondaryRunners.find((r) => r.role === "target")?.who?.shortName;
  const logChance = (kind: string, outcome: ChanceEntry["outcome"]) => chanceLog.push({ minute: matchMinute, kind, outcome });

  // nameTeamGoals (986): only its draws and its records matter here.
  const nameGoals = (raw: HiddenMatchEvent[], squad: SquadPlayer[], r: () => number) => {
    const attackers = squad.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
    let n = 0;
    for (const e of raw) {
      n++;
      if (!e.isGoal) continue;
      if (!e.teammateGoal) {
        if (oppXI === null) continue;
        const cand = oppXI.map((p) => ({ id: p.id, name: p.name, shortName: p.short, position: p.role }));
        const sco = pickSquadScorer(cand, r) ?? { id: "unnamed", name: "Team-mate", shortName: "Team-mate" };
        const ass = sco.id !== "unnamed" ? pickSquadAssist(cand, sco.id, r) : null;
        oppGoalEvents.push({ minute: e.minute, scorerId: sco.id, scorer: sco.name, assistId: ass?.id, assist: ass?.name });
        continue;
      }
      const sco = pickSquadScorer(attackers.length > 0 ? attackers : squad, r) ?? ({ id: "unnamed", name: "Team-mate", shortName: "Team-mate" } as SquadPlayer);
      const ass = sco.id !== "unnamed" ? pickSquadAssist(squad, sco.id, r) : null;
      goalEvents.push({ minute: e.minute, scorer: sco.name, assist: ass?.name, isUserGoal: false });
    }
    return n;
  };
  const clearanceRules = () => {
    setClearanceRules({ speedMin: getTuning("clearance.speedMin"), speedMax: getTuning("clearance.speedMax"), maxAngleDeg: getTuning("clearance.maxAngle"), miscues: true, miscueWeak: getTuning("clearance.miscueWeak"), miscueStrong: getTuning("clearance.miscueStrong"), bodyLen: getTuning("clearance.bodyLen"), bodyWidth: getTuning("clearance.bodyWidth"), secondBalls: Math.round(getTuning("clearance.secondBalls")) });
    setBallPhysics(oldBallPhysics() ? "old" : "new");
    setHitboxes(gameplayVersion("hitboxes"));
  };
  const eligibility = (): { extraTime: boolean; level: () => boolean } | null => {
    const comp = fixture.competition;
    if (!comp) return null;
    if (comp === "Community Shield" || comp === "Super Cup") return { extraTime: false, level: () => userScore === oppScore };
    if (fixture.kind === "cup") {
      if (fixture.leg === 1) return null;
      let fu = 0, ft = 0;
      if (fixture.leg === 2) {
        const you = career.player.club;
        const cs = career.cupState?.find((c) => c.competition === comp && !c.winner);
        const tie = cs?.rounds[cs.rounds.length - 1]?.ties.find((x) => x.home === you || x.away === you);
        const l1 = tie?.legs?.[0];
        if (tie && l1) { fu = tie.home === you ? l1.hs : l1.as; ft = tie.home === you ? l1.as : l1.hs; }
      }
      return { extraTime: hasExtraTime(comp as ExtraTimeCompetition, fixture.round ?? "Final"), level: () => fu + userScore === ft + oppScore };
    }
    if (fixture.kind === "europe") {
      const es = career.euroState;
      if (!es || comp !== es.competition) return null;
      const tie = euroCurrentTie(es);
      if (!tie) return null;
      if (tie.legs.length > 1 && (euroCurrentLeg(es) ?? 0) === 0) return null;
      const f = tie.legs[0];
      return { extraTime: true, level: () => (f?.us ?? 0) + userScore === (f?.them ?? 0) + oppScore };
    }
    return null;
  };

  // ── the walk of the clock to the match's minute (the queue effects, 2490-2620) ──
  let halfShown = false;
  const walkClockTo = (m: number) => { while (matchMinute < m) { const tg = matchMinute + 1; if (!halfShown && tg > 45 && matchMinute >= 45) { halfShown = true; continue; } charge(tg); matchMinute = tg; } };
  const walkLines = (lines: { minute?: number }[]) => {
    for (const l of lines) {
      if (l.minute !== undefined) { walkClockTo(l.minute); charge(l.minute); matchMinute = l.minute; if (!halfShown && l.minute > 45) halfShown = true; }
    }
  };

  // ════ startSimulation (8923) → returns what the match does next ════
  type Next = { kind: "load"; attacking: boolean } | { kind: "sim" } | { kind: "fulltime" };
  const startSimulation = (): Next => {
    seed += 1;
    const r = counted(seed); rng = r;
    st.userScore = userScore; st.oppScore = oppScore;
    const base = inputs();
    let offAt = Infinity;
    if (subOn && !hooked) { const pm = energyPerMinute(energyMode, energyFactor), e = live(st.minute); if (pm > 0) offAt = e <= SUB_OFF_ENERGY ? st.minute : st.minute + Math.ceil((e - SUB_OFF_ENERGY) / pm); }
    let plannedOff = false;
    const po = setup.plannedOffAt;
    if (po && !hooked && po < offAt) { offAt = Math.max(st.minute, po); plannedOff = true; }
    const end = Math.min(ceiling, offAt);
    const lead: HiddenMatchEvent[] = [];
    const ho = handover; handover = null;
    if (ho) {
      const scored = r() < (ho === "penalty" ? 0.76 : 0.09);
      lead.push(scored ? { minute: st.minute, text: "", isGoal: true, teammateGoal: true } : { minute: st.minute, text: "" });
      resolveScenario(st, scored ? "goal" : "saved");
    }
    let step = hooked ? { events: [...lead, ...advanceTo(st, base, r, ceiling)], request: null as ScenarioRequest | null, fullTime: true } : runStretch(st, base, r, end, mayTake, lead);
    const legsGone = !step.request && offAt < ceiling && st.minute >= offAt;
    if (legsGone) step = { ...step, fullTime: false };
    let nLines = nameGoals(step.events, onPitch(career.squad ?? []), mulberry32(seed * 31 + 7));
    userScore = st.userScore; oppScore = st.oppScore;
    if (nLines === 0) { r(); nLines = 1; }
    if (!hooked && !step.fullTime) {
      const dec = legsGone ? { hooked: true, reason: (plannedOff ? "rested" : "legs") as HookReason }
        : hookCheck({ minute: st.minute, startMinute: enteredAt, liveRating: rating(), scoreDiff: st.userScore - st.oppScore, rng: r, liveEnergy: live(st.minute), cameo: subOn });
      if (dec.hooked) {
        charge(st.minute); hooked = dec.reason; hookedAt = st.minute;
        nameGoals(advanceTo(st, base, r, ceiling), onPitch(career.squad ?? []), r);
        userScore = st.userScore; oppScore = st.oppScore;
        step = { ...step, request: null, fullTime: true };
      }
    }
    pendingRequest = step.request;
    if (step.request && subOn) subChances += 1;
    if (ADDED > 0 && !boardShown && etStage === 0 && st.minute > MATCH_DURATION) boardShown = true;
    // The lines are read out: the clock walks to the last of them, then to the match's own minute.
    walkLines(step.events.map((e) => ({ minute: e.minute })));
    walkClockTo(st.minute);
    if (step.fullTime) return { kind: "fulltime" };
    return { kind: "load", attacking: false };
  };

  // ════ loadScenario (9585) and the chance, frame by frame ════
  let sc!: Scenario, ball: Ball | null = null;
  let lead: { lead: LeadIn; t: number; ents: LeadEntity[]; ends: Vec2[]; ball: Vec2; mates0: number; defs0: number } | null = null;
  let runOn: { lead: LeadIn; t: number; ents: LeadEntity[]; ends: Vec2[] } | null = null;
  let airTapLead: Scenario | null = null, viewport: Viewport = { x1: 0, x2: PITCH_W, y1: 0, y2: HALF_LEN }, facing = "up";
  let presser: Scenario["defenders"][number] | null = null;
  const setUpKeeper = (s: Scenario, sd: number) => { const o = brainOptionsHere(); o.penalty = penaltyReadFor(autoKickOf(s)?.keeper?.strength ?? strength, undefined); brainSetup(s, sd >>> 0, s.keeperStrength, o); };
  const styleFor = (s: Scenario): RunupId => { const a = autoKickOf(s); return a ? takerRunupFor(s.kind, a.taker.id || a.taker.name) : yourRunupFor(s.kind, runupStyle.pen, runupStyle.fk); };
  const standBack = (s: Scenario) => { if (hasRunup(s.kind)) s.player = standBackFor(styleFor(s), s.ball, s.player, s.viewport); };
  const frame = (s: Scenario) => {
    turnWideChance(s, !hasRunup(s.kind), hw);
    const tilt = (x: Scenario) => x.kind === "corner" || x.kind === "byline_cross" || (x.facing ?? "up") !== "up" ? 0 : cameraTilt();
    viewport = { ...frameForNewView(s, hw, false, tilt(s)) };
    facing = s.facing ?? "up";
  };
  const airAerial = () => Math.round(aerialOf(career.skills) * (1 - fatigueCut(live(matchMinute))));
  const motionOf = (s: Scenario) => airborneOn() ? airborneMotion(s.kind, seed) : s.kind === "header" ? "float" : s.kind === "volley" ? "bounce" : (s.kind === "one_on_one" || s.kind === "tight_angle" || s.kind === "long_range") && ((Math.imul(seed, 2654435761) >>> 0) % 100) < 35 ? "bobble" : "still";

  let roSteps = 0;
  const dbg = { lead: 0, aim: 0, contact: 0 };
  const stepRunOn = () => {
    if (runOn) roSteps++;
    if (!runOn) return;
    runOn.t += DT;
    const T = runOn.lead.durS + runOn.t, end = runOn.t >= (runOn.lead.runOnS ?? 0);
    const R = runOn;
    R.ents.forEach((e, i) => {
      const own = e.key === "run" ? !!(sc.runner?.commandedTo || sc.runner?.heldAt) : e.key.startsWith("sec") ? !!(sc.secondaryRunners[Number(e.key.slice(3))]?.commandedTo || sc.secondaryRunners[Number(e.key.slice(3))]?.heldAt)
        : e.key === "follower" ? !!(sc.follower.commandedTo || sc.follower.heldAt) : e.key.startsWith("def") ? !!presser && presser === sc.defenders[Number(e.key.slice(3))] : false;
      if (own) return;
      const p = end ? R.ends[i] : R.lead.posAt(e.key, T);
      if (p) e.set(p);
    });
    if (end) runOn = null;
  };
  /** One frame of the lead-in; true once it has ended in an offside. */
  const stepLead = (): boolean => {
    const L = lead!;
    L.t += DT;
    if (L.t < L.lead.durS) { L.ents.forEach((e) => { const p = L.lead.posAt(e.key, L.t); if (p) e.set(p); }); const b = L.lead.ballAt(L.t); sc.ball.x = b.x; sc.ball.y = b.y; return false; }
    if (L.lead.offside) { lead = null; runOn = null; return true; }
    const keys = new Set(L.lead.runOnS && L.lead.runOnS > 0 ? L.lead.runOnKeys ?? [] : []);
    const re: LeadEntity[] = [], rd: Vec2[] = [];
    L.ents.forEach((e, i) => { if (i >= L.ends.length) return; const p = keys.has(e.key) ? L.lead.posAt(e.key, L.lead.durS) : null; if (p) { e.set(p); re.push(e); rd.push(L.ends[i]); } else e.set(L.ends[i]); });
    sc.teammates.length = L.mates0; sc.defenders.length = L.defs0; sc.ball.x = L.ball.x; sc.ball.y = L.ball.y;
    lead = null; runOn = re.length ? { lead: L.lead, t: 0, ents: re, ends: rd } : null; airTapLead = sc;
    return false;
  };

  // The strike (handleContact, 10614).
  let deflections = 0, matePlays: MatePlay[] = [], strikeAt: Vec2 | null = null, cheeky: string | null = null, strikeRule: StrikeDecision | null = null;
  let playOn: PlayOn | null = null, playOnRng: () => number = Math.random, playOnCaught = false, layOffs = MAX_LAY_OFFS;
  let aerial: { sc: Scenario; move: AerialMove; e: number; preS: number; opened: boolean } | null = null;
  let broken = false;
  const strike = (tap: { cx: number; cy: number; lift?: number; aim?: { dir: Vec2; power: number } }, aim: { dir: Vec2; power: number } | null, over?: { dir: Vec2; power: number; skills?: KickSkills }) => {
    let a = over ? { dir: over.dir, power: over.power } : tap.aim ?? aim!;
    if (argv.includes("--debug")) console.log("WEB   strike", sc.kind, "runOn", roSteps, JSON.stringify(dbg), JSON.stringify([tap, over]), JSON.stringify({k: sc.keeper.x, d: sc.defenders.map((q) => [q.x, q.y]), r: sc.runner?.pos, s: sc.secondaryRunners.map((q) => q.pos), p: sc.player, b: sc.ball}));
    const aerNow = !over && aerial?.sc === sc && aerial.opened ? aerial : null;
    if (aerNow) a = aerialStrikeTint(aerNow.move, a.dir, a.power, (seed ^ Math.imul(calls.n + 1, 0x27d4eb2d)) >>> 0);
    runOn = null;
    let contact: StrikeContact = { cx: tap.cx, cy: tap.cy };
    if (!over && tap.lift !== undefined && (airborneOn() || isAirKind(sc.kind))) { const m = motionOf(sc); if (m === "float" || m === "bounce") contact = { ...contact, air: { kind: m === "float" ? "header" : "volley", lift: tap.lift, cx: tap.cx, cy: tap.cy } }; }
    const auto = over?.skills ? { skills: over.skills } : null;
    const tr = tired(), fk = career.skills.freeKick;
    const sw = auto ? auto.skills : setPieceSkills(tr, fk === undefined ? tr.technique : fk * (1 - fatigueCut(live(matchMinute))), sc.kind);
    const lw = switchOn("powerCurve") ? { ...sw, power: strikingPower(sw.power) } : sw;
    if (contact.air) contact = { ...contact, air: { ...contact.air, tech: lw.technique, aerial: airAerial() } };
    deflections = 0; matePlays = []; strikeAt = { x: sc.ball.x, y: sc.ball.y };
    if (BREAK && !broken) { broken = true; rng(); }
    ball = launch(sc, a.dir, a.power, contact, lw, rng);
    applyAirborne(ball, sc, contact.air);
    if (hasBrain(sc)) brainStrike(sc, ball, ((seed ^ Math.imul(calls.n + 1, 0xc2b2ae35)) ^ 0x4b7f) >>> 0);
    else if (sc.kind === "penalty") { const r2 = mulberry32(((seed ^ Math.imul(calls.n + 1, 0x9e3779b1)) ^ 0x5eed) >>> 0); applyPenaltyRead(sc, decidePenaltyRead(sc, ball, penaltyReadFor(autoKickOf(sc)?.keeper?.strength ?? strength, undefined), [r2(), r2()])); }
    cheeky = auto ? null : cheekyStrike(sc.kind, ball, (sc.goal.x1 + sc.goal.x2) / 2, ball.youStruckAtGoal === true);
    strikeRule = strikeKind(sc, ball, mulberry32(((seed ^ Math.imul(calls.n + 1, 0x85ebca6b)) ^ 0x6b1d) >>> 0), { keeperStrength: strength, setPieceSkill: undefined, power: sw.power, technique: sw.technique, ...(!auto && styleFor(sc) === LEAF_RUNUP ? { runup: LEAF_RUNUP } : {}) });
    playOn = null; playOnCaught = false;
    delete sc.matePace;
    if (runAfterWanted({ kind: sc.kind, youShotAtGoal: ball.youStruckAtGoal === true, auto: !!auto })) {
      playOnRng = mulberry32(((seed ^ Math.imul(calls.n + 1, 0x9e3779b1)) ^ 0x61a7) >>> 0);
      playOn = startPlayOnRun(sc, playOnRng, { x: ball.pos.x + ball.vel.x * 0.8, y: ball.pos.y + ball.vel.y * 0.8 }, { stick: afterPassStickOn() && mechanicOpen(career, "steer"), pace: career.skills.pace, energy: live(matchMinute), bar: 1 });
    }
    if (!(sc.kind === "header" && ball.lastTouch === "defence")) commentaryStrike(sc.kind, rng, target(sc));
  };

  // The flight (7366-7480), to its outcome.
  const fly = (): Outcome => {
    let acc = 0;
    for (let f = 0; f < 100000; f++) {
      // The cut from a side-on camera (7318).
      if (facing !== "up") {
        const view = sc.crossSwitchView ? crossCutCamera(sc.crossSwitchView, hw, ball!.pos, 0) : sc.crossSwitchView;
        if (view && ball!.pos.y < (sc.crossSwitchY ?? 0) && ball!.pos.x > view.x1 - 1 && ball!.pos.x < view.x2 + 1) { facing = "up"; viewport = { ...view }; sc.viewport = { ...view }; }
      }
      const fixed = realBallOn();
      let steps = 3;
      if (fixed) { acc += DT; steps = Math.floor(acc * 180 + 1e-6); acc = Math.max(0, acc - steps / 180); }
      for (let i = 0; i < steps; i++) {
        const b = ball!, h = fixed ? 1 / 180 : DT / steps;
        stepDefenders(sc, h, b.pos, false, b); stepKeeper(sc, h); stepReactions(sc, b, h, rng); stepKind(sc, b, h, strikeRule); brainStep(sc, b, h);
        const inc = { vx: b.vel.x, vy: b.vel.y, vz: b.vz, z: b.z, spin: b.spin };
        const probe = probeMatePlays(sc);
        stepKnuckle(b, h);
        if (playOn) {
          const was = playOn.layOffLive;
          if (stepPlayOn(playOn, sc, b, h, playOnRng, layOffs) === "caught") { playOnCaught = true; return "delivered"; }
          if (playOn.layOffLive && !was) layOffs -= 1;
        }
        let res = stepBall(b, sc, rng, h);
        noteMatePlays(matePlays, probe, sc);
        const clr = getClearanceRules();
        if (res === "blocked" && deflections < 1 && (!clr.miscues || (sc.secondBalls ?? 0) < clr.secondBalls)) {
          deflections += 1;
          if (clr.miscues) sc.secondBalls = (sc.secondBalls ?? 0) + 1;
          deflectBlock(b, sc, inc, mulberry32(((seed ^ Math.imul(calls.n + 1, 0x27d4eb2d)) ^ 0xdef1) >>> 0));
          steerDeflectionFromOwnGoal(b, sc);
          res = null;
        }
        if (res === "short") clearLooseWin(b, sc);
        if (res) return res;
      }
      const ev = ball!.event, rc = sc.receiver;
      if (ev && rc) { const l = rc.who?.shortName ?? rc.roleLabel; if (ev === "received") commentaryReceived(l, rng); else if (ev === "receiverShot") commentaryReceiverShot(l, rng); }
      ball!.event = null;
    }
    return "saved";
  };

  // resolveOutcome (8028): the credit, the match, the commentary, what comes next.
  const resolve = (res: Outcome): Next => {
    const receiverShot = sc.receiverShot === true, auto = autoKickOf(sc);
    const youShot = !auto && ball?.youStruckAtGoal === true && !receiverShot;
    const isSimplePass = !youShot && !receiverShot && sc.passTarget != null;
    const kind = OUTCOME_TEXT[res].kind;
    const finish = auto ? undefined : cheeky === "chip" ? "chip" : [...(ball?.actionLog ?? [])].reverse().find((a) => a.kind === "shot" && a.actor === "you")?.mode === "curl" ? "curl" : undefined;
    if (cheeky && !auto && (sc.kind === "penalty" || youShot) && isCheekyMiss(res)) cheekyMisses.push({ kind: cheeky, minute: matchMinute });
    cheeky = null;
    const assist = assistFor(matePlays);
    const d = creditChance(res, { youShot, receiverShot, isSimplePass, assistYours: assist.yours });
    if (!auto) {
      t.shots += d.shots; t.goals += d.goals; t.passes += d.passes; t.passesCompleted += d.passesCompleted; t.chances += d.chances; t.assists += d.assists;
      if (kind !== "goal" && res !== "delivered" && res !== "touchOn" && !receiverShot) { if (youShot) { t.misses += 1; const mk = missKind(sc.kind, res); if (mk === "penalty") t.missesPen += 1; else if (mk === "oneOnOne") t.misses1v1 += 1; else if (mk === "on") t.missesOn += 1; } else t.lost += 1; }
      if (d.goals > 0) { const z = goalZone(sc.kind, strikeAt); if (z === "penalty") t.goalsPen += d.goals; else if (z === "tapIn") t.goalsTap += d.goals; else if (z === "outside") t.goalsOut += d.goals; }
      if (d.passesCompleted > 0) { const pg = passGrade(sc.passDifficulty, sc.passAmbition); if (pg === "safe") t.passesSafe += d.passesCompleted; else if (pg === "ambitious") t.passesAmb += d.passesCompleted; }
      strikeAt = null;
      if (res !== "touchOn") logChance(sc.kind, kind === "goal" ? (d.goals > 0 ? "goal" : d.assists > 0 ? "assist" : "pass") : res === "delivered" ? "pass" : res === "offside" ? "offside" : receiverShot ? "setup" : youShot ? "miss" : res === "tackled" ? "tackled" : "lost");
      if (kind === "goal") userScore += 1;
      resolveScenario(st, resultFor(res));
    }
    let roleLabel = sc.receiver?.roleLabel;
    if (!auto && kind === "goal") {
      const squad = onPitch(career.squad ?? []), name = `${career.player.firstName} ${career.player.lastName}`;
      const how = res === "rebound" ? "rebound" : sc.kind, distance = Math.hypot(sc.ball.x - (sc.goal.x1 + sc.goal.x2) / 2, sc.ball.y);
      if ((d.assists === 1 || (receiverShot && !assist.yours)) && sc.receiver) {
        const scorer = sc.receiver.who ?? (() => { const fw = squad.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position)); return pickSquadScorer(fw.length > 0 ? fw : squad, rng) ?? undefined; })();
        if (scorer) roleLabel = scorer.shortName;
        goalEvents.push({ minute: matchMinute, scorer: scorer?.name ?? sc.receiver.roleLabel ?? "Team-mate", assist: assist.yours ? name : assist.by?.who?.name, isUserGoal: false, how, distance: Math.round(distance), ...(assist.yours && sc.receivedAt ? { passLength: Math.round(Math.hypot(sc.receivedAt.x - sc.ball.x, sc.receivedAt.y - sc.ball.y)) } : {}) });
      } else if (d.goals === 1) {
        const assister = res === "rebound" ? undefined : creatorOf(sc, squad, rng);
        goalEvents.push({ minute: matchMinute, scorer: name, assist: assister?.name, isUserGoal: true, how, distance: Math.round(distance), ...(finish ? { finish } : {}) });
      } else goalEvents.push({ minute: matchMinute, scorer: name, isUserGoal: true, how, distance: Math.round(distance), ...(finish ? { finish } : {}) });
    }
    commentaryResult(res, rng, { chain: sc.receiver != null, receiverReached: sc.receiverReached === true, roleLabel, isPass: isSimplePass });
    if (auto && auto.context === "match") {
      if (kind === "goal") { userScore += 1; goalEvents.push({ minute: matchMinute, scorer: auto.taker.name, isUserGoal: false, how: "penalty", distance: 11 }); }
      resolveScenario(st, kind === "goal" ? "goal" : "saved");
      trace.push(`res:${sc.kind}:${res}:${matchMinute}:${calls.n}:${ball ? ball.pos.x.toFixed(4) + "," + ball.pos.y.toFixed(4) : "-"}`);
      return { kind: "sim" };
    }
    if (res === "delivered" && playOnCaught) {
      playOnCaught = false;
      if (ball) chain = { pos: { x: ball.pos.x, y: ball.pos.y }, depth: sc.chainDepth ?? 0, ambition: Math.max(sc.passDifficulty, sc.passAmbition ?? 0), touchTouches: sc.touchTouches ?? 0 };
    } else if (res === "delivered") {
      const depth = sc.chainDepth ?? 0, at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
      const rc = !goalInView(sc.kind) && at ? giveAndGoChance(sc, at) : chainReturnChance(sc);
      if (at && depth < CHAIN_MAX && rng() < rc) {
        chain = { pos: { x: at.x, y: at.y }, depth: depth + 1, ambition: Math.max(sc.passDifficulty, sc.passAmbition ?? 0) };
        if (newChancesOn() && !goalInView(sc.kind)) carryOn = carryFrom(sc, ball ? { x: ball.pos.x, y: ball.pos.y } : at);
      }
    }
    attempts += 1;
    trace.push(`res:${sc.kind}:${res}:${matchMinute}:${calls.n}:${ball ? ball.pos.x.toFixed(4) + "," + ball.pos.y.toFixed(4) : "-"}`);
    return chain ? { kind: "load", attacking: true } : { kind: "sim" };
  };

  /** One chance, from loadScenario to what follows it. */
  const loadScenario = (attacking: boolean): Next => {
    clearanceRules();
    seed += 1;
    rng = counted(seed);
    const r = rng;
    const raw = attacking ? null : pendingRequest; pendingRequest = null;
    const ch = chain; chain = null;
    let request = raw;
    if (raw && !ch && newChancesOn()) { dDeal ??= { deal: newDribbleDeal(), rng: mulberry32((setup.seed ^ 0xd21bb1e) >>> 0) }; request = dealDribble(raw, dribbleLevelFor(divisionOf(career), fixture.competition), dDeal.deal, dDeal.rng); }
    const setPiece = ch ? null : setPieceNext; setPieceNext = null;
    chanceNo++;
    lead = null; runOn = null; ball = null; presser = null; aerial = aerial && aerial.sc ? aerial : null;

    // A penalty your side has won that a team-mate takes (9462): he stands over it, runs up, strikes.
    if (!attacking && !ch && request?.penaltyWon && !mayTake("penalty")) {
      const sq = onPitch(career.squad ?? []);
      const all = sq.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.imageUrl ?? fakeFaceFor(p.id), rating: takerRating(p), isGK: p.position === "GK", overall: p.overall }));
      const outfield: PenaltyTaker[] = all.filter((x) => !x.isGK);
      for (let i = outfield.length; i < 5; i++) outfield.push({ id: `mate-${i}`, name: `Team-mate ${i + 1}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`mate-${i}`), rating: 62 });
      const taker = designatedTaker(outfield);
      if (taker) {
        sc = buildScenario("penalty", r, strength, team, vision);
        enforceHardRules(sc); sc.conditions = setup.conditions;
        castScenario(sc, sq.filter((p) => p.id !== taker.id)); initDefenders(sc, r); castDefence(sc, oppXIForCast);
        const kw = sc.keeper.who;
        attachAutoKick(sc, { side: "us", taker, plan: planPenalty(taker.rating, mulberry32((seed ^ 0x7a11c) >>> 0)), context: "match", keeper: { strength, id: kw?.id, name: kw?.name, shortName: kw?.shortName, face: kw?.face } });
        standBack(sc); setUpKeeper(sc, seed ^ 0x4b7e); frame(sc);
        trace.push(`aim:${sc.kind}:${matchMinute}:${calls.n}`);
        for (let i = 0; i < frames(AUTO_STAND_MS) - 1; i++) { stepKeeper(sc, DT); brainAim(sc, DT); }
        const k = autoKickOf(sc)!;
        const a = aimFor(sc, k.plan);
        return runup(a.dir, a.power, { contact: a.contact, skills: takerSkills(k.taker.rating) });
      }
    }

    if (!attacking && request?.dribble) {
      const fp = { waveSizes: pickWaveSizes(r, { minRounds: 3 }), seed: Math.floor(r() * 1e9) };
      moment();
      trace.push(`tdDribble:dribble:${matchMinute}:${calls.n}`);
      const roster = oppXIForCast ? oppXIForCast.filter((p) => !p.isGK).map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.face, defending: p.defending, overall: p.overall })) : undefined;
      const run = newFpRun({ pace: 100, oppStrength: 100, waveSizes: fp.waveSizes, roster, rng: mulberry32(fp.seed), mates: Math.round(getTuning("dribble.mates")) });
      let out: ReturnType<typeof stepFpRun> = "running";
      for (let i = 0; i < 1e6; i++) { out = stepFpRun(run, DT); if (out !== "running") break; }
      const pass = run.pass;
      const beaten = run.defenders.filter((x) => x.phase === "beaten").length;
      attempts += 1;
      if (out === "fouled") {
        if (beaten > 0) t.dribbles += 1;
        logChance("dribble", "dribble");
        trace.push(`dribble:fouled:${matchMinute}:${calls.n}`);
        if (mayTake("free_kick")) { setPieceNext = "free_kick"; resolveScenario(st, "delivered"); return { kind: "load", attacking: true }; }
        handover = "free_kick"; return { kind: "sim" };
      }
      const passed = !!(pass && pass.success);
      if (out === "clear" || passed) {
        if (passed) { t.passes += 1; t.passesCompleted += 1; }
        if (beaten > 0 || out === "clear") t.dribbles += 1;
        logChance("dribble", "dribble");
        const rw = dribbleReward({ cleared: out === "clear", menBeaten: beaten, wavesBeaten: fpWavesBeaten(run), totalWaves: run.roundSizes.length, mateX: passed ? pass!.at?.x : undefined, ...(run.duels ? { bonusMen: 4 } : {}) }, rng);
        chain = { pos: rw.pos, depth: 0, ambition: rw.ambition, kind: rw.kind };
        resolveScenario(st, "delivered");
        trace.push(`dribble:through:${matchMinute}:${calls.n}`);
        return { kind: "load", attacking: true };
      }
      resolveScenario(st, "lost");
      t.chances += 1; t.lost += 1; if (pass && !pass.success) t.passes += 1;
      logChance("dribble", "tackled");
      trace.push(`dribble:lost:${matchMinute}:${calls.n}`);
      return { kind: "sim" };
    }

    const touchOn = ch !== null && ch.touchTouches !== undefined;
    if (!touchOn) layOffs = MAX_LAY_OFFS;
    const carry = ch && !touchOn ? carryOn : null;
    carryOn = null;
    if (request) lastDeal = request.deal;
    const myStrength = career.league.find((x) => x.name === career.player.club)?.strength ?? 65;
    const made = makeChance({
      deal: lastDeal,
      source: ch?.kind ? { from: "kind", kind: ch.kind } : ch ? { from: "chain", pos: ch.pos, ambition: ch.ambition, position: setup.position } : setPiece ? { from: "kind", kind: setPiece } : attacking ? { from: "attacking" } : request ? { from: "request", request, position: setup.position } : { from: "weighted", position: setup.position },
      rng: r, strength: { keeper: strength, team, vision }, memory: pictureMemory("game"), selection: selMem,
      formation: formationShapeInput(fixture.opponent, myStrength, oppStrength),
    });
    sc = made.sc;
    noteServedKind(st, sc.kind);
    if (ch) { sc.chainDepth = ch.depth; sc.touchTouches = ch.touchTouches; }
    sc.conditions = setup.conditions;
    if (!touchOn) castScenario(sc, onPitch(career.squad ?? []));
    initDefenders(sc, r); castDefence(sc, oppXIForCast); setUpKeeper(sc, seed ^ 0x4b7e);
    if (ch && !touchOn) {
      const stance = { x: sc.player.x - sc.ball.x, y: sc.player.y - sc.ball.y };
      applyFirstTouch(sc, tired().technique, r);
      const vp = sc.viewport, inset = 1.4;
      sc.player = { x: Math.min(Math.max(sc.ball.x + stance.x, vp.x1 + inset), vp.x2 - inset), y: Math.min(Math.max(sc.ball.y + stance.y, Math.max(vp.y1 + inset, 0.3)), vp.y2 - inset) };
      separateBodies(sc);
    }
    standBack(sc); frame(sc);
    if (!request?.lateCharge) moment();
    if (!touchOn) commentaryBuildup(sc.kind, rng, target(sc));
    // The build-up (startLeadIn, 6509).
    {
      const m: LeadMoment = { opening: false, fresh: !attacking && !ch && !setPiece, lane: request?.lane, pattern: request?.pattern, seed, us: career.player.club, them: fixture.opponent, themStrength: oppStrength,
        ...(fhrOn() ? { usStrength: inputs().teamStrength, regain: request?.regain, offsideOff: ruleBookFor(career, "FA").offsideAbolished } : {}),
        frame: { ...viewport }, minute: matchMinute, scoreDiff: userScore - oppScore, stakes: stakesOf(fixture) };
      let L: LeadIn | null = null;
      try { L = carry ? carryOnLeadIn(sc, carry) : careerBuildUp(sc, m); } catch { L = null; }
      if (L && L.durS > 0) {
        const ents = leadInEntities(sc), ends = ents.map((e) => e.get());
        for (const j of L.joiners ?? []) { const at = L.posAt(j.key, 0) ?? j.end; const dd: Scenario["defenders"][number] = { x: at.x, y: at.y, homeX: j.end.x, homeY: j.end.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" }; sc.defenders.push(dd); ents.push({ key: j.key, side: "opp", get: () => ({ x: dd.x, y: dd.y }), set: (p) => { dd.x = p.x; dd.y = p.y; } }); ends.push({ ...j.end }); }
        const mates0 = sc.teammates.length;
        for (let i = 0; i < (L.extraMates ?? 0); i++) { const mm = { x: sc.ball.x, y: sc.ball.y }; sc.teammates.push(mm); ents.push({ key: `extra${i}`, side: "mate", get: () => ({ x: mm.x, y: mm.y }), set: (p) => { mm.x = p.x; mm.y = p.y; } }); }
        const defs0 = sc.defenders.length;
        for (let i = 0; i < (L.extraOpps ?? 0); i++) { const at = L.posAt(`oppx${i}`, 0) ?? { x: sc.ball.x, y: sc.ball.y }; const dd: Scenario["defenders"][number] = { x: at.x, y: at.y, homeX: at.x, homeY: at.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" }; sc.defenders.push(dd); ents.push({ key: `oppx${i}`, side: "opp", get: () => ({ x: dd.x, y: dd.y }), set: (p) => { dd.x = p.x; dd.y = p.y; } }); }
        lead = { lead: L, t: 0, ents, ends, ball: { x: sc.ball.x, y: sc.ball.y }, mates0, defs0 };
        ents.forEach((e) => { const p = L!.posAt(e.key, 0); if (p) e.set(p); });
        { const b = L.ballAt(0); sc.ball.x = b.x; sc.ball.y = b.y; }
      }
    }
    trace.push(`aim:${sc.kind}:${matchMinute}:${calls.n}`);

    // ── The aim, frame by frame (the frame loop's aim branch) ──
    let aimFrames = 0;
    let airWait: number | null = null;
    for (let f = 0; f < 100000; f++) {
      if (lead) dbg.lead++; else dbg.aim++;
      if (!lead) {
        aimFrames++;
        if (aimFrames === botWait(botSeed, chanceNo)) {
          // The bot's drag (onPointerDown / Move / Up, 10235-10580).
          if (!(isAirKind(sc.kind) && airTapOn())) {
            const b = sc.ball, pull = flatPullFor(viewport, facing);
            const dragAt = botAim(b, viewport, facing, botSeed, chanceNo);
            const drag = { x: b.x + (dragAt.x - b.x), y: b.y + (dragAt.y - b.y) };
            if (acceptsCaptainOrders(sc.kind) && pull(drag, b) >= 0.008 && setup.pressure > 0) {
              let best: Scenario["defenders"][number] | null = null, bd = Infinity;
              for (const dd of sc.defenders) { const dist = Math.hypot(dd.x - b.x, dd.y - b.y); if (dist < bd) { bd = dist; best = dd; } }
              presser = best; void pressFromBehind;
            }
            const power = clamp(pull(drag, b) / dragForFullPower(setup.skills.power), 0, 1);
            const dir = { x: b.x - drag.x, y: b.y - drag.y };
            if (hasRunup(sc.kind)) return runup(dir, power);
            return contactScreen({ dir, power }, null, false);
          }
        }
        stepKeeper(sc, DT); brainAim(sc, DT);
      }
      // Headers and volleys open their own strike screen (7203-7243).
      if (!lead && isAirKind(sc.kind) && airTapOn() && !autoKickOf(sc)) {
        if (aerialMovesOn()) {
          if (!aerial || aerial.sc !== sc) {
            const kind = sc.kind as "header" | "volley", mate = sc.teammates[0];
            const move = forcedAerialMove(kind) ?? pickAerialMove({ kind, ballZ: airZOf(sc), inDir: mate ? { x: sc.ball.x - mate.x, y: sc.ball.y - mate.y } : { x: 0, y: -1 }, toGoal: { x: CX - sc.ball.x, y: -sc.ball.y }, aerial: airAerial() ?? 60, flair: career.skills.technique ?? setup.skills.technique ?? 50, seed: (seed ^ Math.imul(Math.round(sc.ball.x * 100), 31) ^ Math.round(sc.ball.y * 100)) >>> 0 });
            aerial = { sc, move, e: 0, preS: airTapLead === sc ? 0 : AIR_TAP_OPEN_NO_LEAD_S - AIR_TAP_OPEN_S, opened: false };
          } else aerial.e += DT;
          if (!aerial.opened && aerial.e >= aerial.preS + AERIAL_SPECS[aerial.move].riseS + CONTACT_SHOW_S) { aerial.opened = true; stepRunOn(); return contactScreen(airTapAim(sc.kind as AirKind, sc.ball, 0), null, true); }
        } else {
          airWait = airWait === null ? 0 : airWait + DT;
          if (airWait >= (airTapLead === sc ? AIR_TAP_OPEN_S : AIR_TAP_OPEN_NO_LEAD_S)) { stepRunOn(); return contactScreen(airTapAim(sc.kind as AirKind, sc.ball, 0), null, true); }
        }
      }
      stepRunOn();
      if (lead) {
        if (stepLead()) {
          trace.push(`${sc.kind}:offside:${matchMinute}:${calls.n}`);
          resolveScenario(st, resultFor("offside"));
          return { kind: "sim" };
        }
      }
    }
    return { kind: "sim" };
  };

  /** The strike screen: frames until the bot taps (or the countdown runs out), then the beat before the kick. */
  const contactScreen = (aim: { dir: Vec2; power: number }, timerS: number | null, inTick: boolean): Next => {
    const motion = motionOf(sc);
    const air = motion === "float" || motion === "bounce";
    const limit = timerS && timerS > 0 ? timerS : air ? airStrikeTimerS(motion === "float" ? "header" : "volley", airAerial()) : undefined;
    const period = 2.2 + Math.max(0, Math.min(100, setup.skills.technique) - 40) / 60 * 1.2;
    const at = (n: number) => {
      // ContactBall's ballMotionAt, n frames after the screen opened.
      const tt = n / 60;
      if (motion === "still") return { x: 0, y: 0 };
      const ph = (tt / period) % 2, sw = ph < 1 ? ph : 2 - ph, x = -0.12 + 0.24 * (0.5 - 0.5 * Math.cos(Math.PI * sw));
      if (motion === "float") return { x, y: -0.42 - 0.08 * Math.sin(Math.PI * sw) };
      if (motion === "bounce") return { x, y: -0.26 * Math.abs(Math.sin(Math.PI * 2.5 * sw)) };
      return { x: x * 0.6, y: -0.05 * Math.abs(Math.sin(Math.PI * 6 * sw)) };
    };
    const liftAt = (y: number) => Math.max(0, Math.min(1, -y / (motion === "float" ? 0.5 : motion === "bounce" ? 0.26 : 0.05)));
    // Opened between two frames (you let go of the aim): frame 1 is the next one. Opened inside a
    // frame (a header's own timing, the end of a run-up): that frame has already gone by, uncounted.
    const tapAfter = botContactWait(botSeed, chanceNo) - (inTick ? 1 : 0);
    const tapNow = (F: number): Next => {
      const c = botContact(chanceNo), p = at(F);
      for (let k = 0; k < frames(air ? 300 : 200) - 1; k++) stepRunOn();
      return afterTap(air ? { cx: c.cx, cy: c.cy, lift: liftAt(p.y) } : { cx: c.cx, cy: c.cy }, aim);
    };
    if (tapAfter === 0) return tapNow(0);
    for (let F = 1; F < 100000; F++) {
      dbg.contact++;
      // The countdown (ContactBall's timer, from its second frame).
      if (limit) {
        const tt = Math.max(0, F / 60 - 2 / 60);
        if (!(Math.max(0, 1 - tt / limit) > 0)) {
          const p = at(F);
          stepRunOn();
          for (let k = 0; k < frames(350) - 1; k++) stepRunOn();
          if (air && !(timerS && timerS > 0)) return afterTap({ ...airLateContact(motion === "float" ? "header" : "volley", liftAt(p.y), p.x), late: true }, aim);
          const sr = scuffStrike(aim.dir, aim.power, mulberry32(((seed ^ Math.imul(calls.n + 1, 0x27d4eb2d)) ^ 0x5c0f) >>> 0));
          strike(sr.contact, aim, { dir: sr.dir, power: sr.power });
          return land(fly());
        }
      }
      stepRunOn();
      if (F === tapAfter) return tapNow(F);
    }
    return { kind: "sim" };
  };
  const afterTap = (tap: { cx: number; cy: number; lift?: number; late?: boolean }, aim: { dir: Vec2; power: number }): Next => {
    if (isAirKind(sc.kind) && airTapOn()) { const s2 = airTapStrike(sc.kind as AirKind, sc.ball, tap, airAerial()); strike({ ...s2.contact, aim: s2.aim }, aim); }
    else strike(tap, aim);
    return land(fly());
  };
  /** The chance is over: resolveOutcome, then the rest of that frame's words (the frame loop reads the ball's event after the steps). */
  const land = (res: Outcome): Next => {
    const ev = ball?.event, rc = sc.receiver;
    const next = resolve(res);
    if (ev && rc) { const l = rc.who?.shortName ?? rc.roleLabel; if (ev === "received") commentaryReceived(l, rng); else if (ev === "receiverShot") commentaryReceiverShot(l, rng); }
    if (ball) ball.event = null;
    return next;
  };
  /** The run-up (startRunup 10588, the runup frame 7266). */
  const runup = (rawDir: Vec2, power: number, auto?: { contact: { cx: number; cy: number }; skills: KickSkills }): Next => {
    const L = Math.hypot(rawDir.x, rawDir.y) || 1, dir0 = { x: rawDir.x / L, y: rawDir.y / L };
    const id = styleFor(sc), styled = planRunup(id, sc.ball, sc.player), runS = RUNUP_MOTION[id].runS;
    // An aim you can still swing on the way (a penalty), unswung: nudgedDir by 0 m.
    const dirNow = !auto && canNudge(sc.kind) ? nudgedDir(sc.ball, dir0, 0) : dir0;
    runOn = null; // the run-up is not the aim: the men still running stop where they are
    let tt = 0;
    for (let f = 0; f < 100000; f++) {
      stepKeeper(sc, DT);
      tt += DT;
      brainRunUp(sc, DT, tt, goalLineX(sc.ball, dirNow));
      sc.player = runupPositionAt(styled, tt);
      if (tt >= runS) {
        if (auto) { strike(auto.contact, null, { dir: dirNow, power, skills: auto.skills }); return land(fly()); }
        stepRunOn();
        return contactScreen({ dir: dirNow, power }, strikeTimerFor(sc.kind), true);
      }
    }
    return { kind: "sim" };
  };

  // ════ The match (the mount effect, 2990-3080; the feed's go, 2589) ════
  clearanceRules();
  let next: Next;
  if (setup.startMinute > 0) {
    seed += 1; rng = counted(seed);
    const jitter = ((career.week ?? 0) * 37 + (career.season ?? 0) * 11) % 5;
    const before = advanceTo(st, inputs(), rng, 50);
    while (st.minute < 88 && !subComesOnNow(st.minute, st.userScore - st.oppScore, jitter, setup.startMinute)) before.push(...advanceTo(st, inputs(), rng, st.minute + 1));
    enteredAt = st.minute; subOn = true; subChances = 0; userScore = st.userScore; oppScore = st.oppScore; energyClock = st.minute; subFitness = live(st.minute); matchMinute = st.minute; halfShown = st.minute > 45;
    nameGoals(before, onPitch(career.squad ?? []), rng);
  } else enteredAt = 0;
  next = startSimulation();
  for (let guard = 0; guard < 400; guard++) {
    if (next.kind === "load") { next = loadScenario(next.attacking); continue; }
    if (next.kind === "sim") { next = startSimulation(); continue; }
    // Full time (9159).
    if (etStage === 1) { etStage = 2; ceiling = MATCH_DURATION + ADDED + 30; next = startSimulation(); continue; }
    const el = eligibility();
    if (etStage === 2) { if (el && el.level()) shootout = settleShootout(); break; }
    walkClockTo(MATCH_DURATION + ADDED); charge(MATCH_DURATION + ADDED); matchMinute = MATCH_DURATION + ADDED;
    if (!el || !el.level()) break;
    if (!el.extraTime) { shootout = settleShootout(); break; }
    wentET = true; etStage = 1; ceiling = MATCH_DURATION + ADDED + 15; next = startSimulation();
  }
  // OUT OF DATE: the phone's driver now plays a shootout live, kick by kick
  // (CanvasMatch startShootout / LiveShootout); tools/match-features.ts checks
  // that. The matches this check plays are league games and never reach
  // penalties; a knockout case here would need the bot to take your kick.
  function settleShootout() {
    const r = mulberry32((setup.seed ^ 0x5400) >>> 0);
    let s = createShootout();
    const ours = penaltyConversionChance(career.skills.freeKick ?? setup.skills.technique), theirs = penaltyConversionChance(oppStrength);
    const home = fixture.home !== false;
    while (!s.over && s.kicks.length < 40) { const hk = s.kicks.length % 2 === 0; s = takeNextKick(s, r() < (hk === home ? ours : theirs)); }
    return { home: s.homeScore, away: s.awayScore };
  }
  const stats: MatchStats = {
    ...finaliseMatch(attempts, t.goals, t.assists, t.passesCompleted, Math.max(1, (hookedAt ?? matchMinute) - enteredAt), userScore, oppScore, career, goalEvents, hooked, oppGoalEvents, fixture,
      { misses: t.misses, lost: t.lost, dribbles: t.dribbles, goalsPen: t.goalsPen, goalsTap: t.goalsTap, goalsOut: t.goalsOut, passesSafe: t.passesSafe, passesAmb: t.passesAmb, missesOn: t.missesOn, missesPen: t.missesPen, misses1v1: t.misses1v1 }),
    ...(subOn ? { cameo: true, enteredAt } : {}), chanceLog: chanceLog.slice(),
    endEnergy: live(hookedAt ?? matchMinute), kibCansUsed: 0, playstyle,
    ...(wentET ? { wentToExtraTime: true } : {}), ...(shootout ? { shootout } : {}),
    ...(cheekyMisses.length ? { cheekyMisses: [...cheekyMisses] } : {}),
  } as MatchStats;
  return { stats, trace, score: `${userScore}-${oppScore}` };
}

// ── The phone's side: the driver, played by the same bot, its chances read the same way ──
function phoneMatch(setup: MatchSetup, hw: number, botSeed: number): Out {
  const d = new MatchDriver(setup, { hw });
  const trace: string[] = [];
  // Read the driver's chances as they end: the result line and the outcome.
  const origPush = d.pushLine.bind(d);
  let lastKind = "";
  let lastPhase = "";
  const tickOrig = d.tick.bind(d);
  d.tick = () => {
    tickOrig();
    if (d.phase !== lastPhase) {
      if (d.phase === "aim") { lastKind = d.sc.kind; trace.push(`aim:${d.sc.kind}:${d.matchMinute}:${d.rngDrawn}`); }
      lastPhase = d.phase;
    }
  };
  void origPush; void lastKind;
  const dd = d as unknown as { resolveOutcome(r: Outcome): void };
  const orig = dd.resolveOutcome.bind(d);
  dd.resolveOutcome = (r: Outcome) => { orig(r); trace.push(`res:${d.sc.kind}:${r}:${d.matchMinute}:${d.rngDrawn}:${d.ball ? d.ball.pos.x.toFixed(4) + "," + d.ball.pos.y.toFixed(4) : "-"}`); };
  const pd = { lead: 0, aim: 0, contact: 0 }; { const tk = d.tick.bind(d); d.tick = () => { if (d.phase === "aim") { if (d.lead) pd.lead++; else pd.aim++; } if (d.phase === "contact") pd.contact++; tk(); }; }
  if (argv.includes("--debug")) { const tc = d.tapContact.bind(d); d.tapContact = (a: number, b: number) => { console.log("PHONE tap", d.tickNo, d.contactT0, d.sc.kind); tc(a, b); }; const pu = d.pointerUp.bind(d); d.pointerUp = (f) => { console.log("PHONE up", d.tickNo, d.phase, d.sc.kind); pu(f); console.log("PHONE after up", d.phase); }; }
  let ro = 0; if (argv.includes("--debug")) { const ds = d as unknown as { stepRunOn(dt: number): void; runOn: unknown }; const os = ds.stepRunOn.bind(d); ds.stepRunOn = (x: number) => { if (ds.runOn) ro++; os(x); }; }
  if (argv.includes("--debug")) { const dh = d as unknown as { handleContact(...a: unknown[]): void }; const oh = dh.handleContact.bind(d); dh.handleContact = (...a: unknown[]) => { console.log("PHONE strike", d.sc.kind, "runOn", ro, JSON.stringify(pd), JSON.stringify(a), JSON.stringify({k: d.sc.keeper.x, d: d.sc.defenders.map((q) => [q.x, q.y]), r: d.sc.runner?.pos, s: d.sc.secondaryRunners.map((q) => q.pos), p: d.sc.player, b: d.sc.ball})); oh(...a); }; }
  playWithBot(d, botSeed);
  return { stats: d.finalStats!, trace, score: `${d.userScore}-${d.oppScore}` };
}

// ── Careers to play ──
function career(i: number): CareerState {
  const clubs = i % 2 === 0 ? [...NATIONAL_LEAGUE_SOUTH_CLUBS] : [...NATIONAL_LEAGUE_NORTH_CLUBS];
  const player = { firstName: "Test", lastName: `Player${i}`, age: 16, skinTone: "light", club: clubs[i % clubs.length], clubBadge: null, position: ["ST", "CAM", "LW", "CM"][i % 4], nationality: "England", startYear: 2026 } as StarPlayer;
  const c = makeInitialCareer(player, clubs, i % 2 === 0 ? "national_league_south" : "national_league_north");
  // Every third career is an older save (every move open: headers, volleys, corners) with a better player.
  if (i % 3 === 2) {
    return { ...c, unlocks: { ...(c.unlocks ?? {}), story: false }, skills: { ...c.skills, power: 72, technique: 74, vision: 73, freeKick: 70, pace: 70 } } as CareerState;
  }
  return c;
}

const N = Number(argv.find((a, i) => i >= 2 && /^\d+$/.test(a)) ?? 12);
let bad = 0, chancesSeen = 0;
const kindsSeen: Record<string, number> = {};
for (let m = 0; m < N; m++) {
  const c0 = career(m);
  const fx: Fixture = c0.fixtures.filter((f) => !f.played)[m % 6];
  const c = { ...c0, week: fx.week, season: 1 + (m % 3) };
  const hw = [1.6, 1.9, 2.1][m % 3];
  const botSeed = 1000 + m * 17;
  // Same starting conditions for both: no visit salt, an empty picture memory.
  setVisitSalt(0);
  pictureMemory("game").clear();
  const phone = phoneMatch(matchSetupFor(c, fx), hw, botSeed);
  setVisitSalt(0);
  pictureMemory("game").clear();
  const web = websiteMatch(matchSetupFor(c, fx), hw, botSeed);
  const webAims = web.trace.filter((s) => s.startsWith("aim:") || s.startsWith("res:"));
  const same = JSON.stringify(phone.stats) === JSON.stringify(web.stats) && phone.score === web.score && JSON.stringify(phone.trace) === JSON.stringify(webAims);
  chancesSeen += webAims.filter((s) => s.startsWith("aim:")).length;
  for (const s of web.trace) { const k = s.startsWith("aim:") ? s.split(":")[1] : s.startsWith("tdDribble:") ? "dribble" : null; if (k) kindsSeen[k] = (kindsSeen[k] ?? 0) + 1; }
  console.log(`${same ? "SAME" : "DIFF"}  match ${m + 1}: ${fx.home ? "H" : "A"} v ${fx.opponent.padEnd(24)} phone ${phone.score}  website ${web.score}  chances ${webAims.filter((s) => s.startsWith("aim:")).length}/${phone.trace.filter((s) => s.startsWith("aim:")).length}  goals ${phone.stats.goals}/${web.stats.goals}  rating ${phone.stats.rating}/${web.stats.rating}`);
  if (!same) {
    bad++;
    const a = phone.trace, b = webAims;
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(`   first different step #${i + 1}: phone ${a[i]}  website ${b[i]}`); break; }
    if (argv.includes("--dump")) { console.log("   phone:   " + a.join("  ")); console.log("   website: " + b.join("  ")); }
    for (const k of Object.keys(web.stats) as (keyof MatchStats)[]) if (JSON.stringify(phone.stats[k]) !== JSON.stringify(web.stats[k])) console.log(`   ${String(k)}: phone ${JSON.stringify(phone.stats[k])?.slice(0, 120)}  website ${JSON.stringify(web.stats[k])?.slice(0, 120)}`);
  }
}
console.log(`\nKinds played: ${JSON.stringify(kindsSeen)}`);
console.log(`\n${N - bad}/${N} matches identical (${chancesSeen} chances).${BREAK ? "  [--break: a difference was planted on the website side]" : ""}`);
if (bad > 0) (globalThis as { process?: { exit(c: number): never } }).process!.exit(1);
