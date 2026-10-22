"use client";

/**
 * A WHOLE PENALTY SHOOTOUT, ON THE REAL MATCH — Infinite Highlights' Shootout
 * (v0.15 plan, item 7).
 *
 * Harry: "Add a Shootout option to Infinite Highlights."
 *
 * A feature around EnginePlay, the one way a test screen plays the game: this
 * file keeps the score (lib/star/shootout.ts's state machine), decides the
 * order and hands the engine one penalty picture per kick (`openOn`). A kick
 * that is not yours carries an automatic kick (lib/star/penaltyTaking.ts) and
 * the engine strikes it through the same strike a player's kick is; yours you
 * take. It reads each result back through `onChanceResolved`. No loop, no
 * physics, no drawing of the pitch here.
 *
 * The two sides are the Play Area's test fixture — the same club, opponent,
 * real squads and kits EnginePlay plays (buildTestCareer + the real squads).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnginePlay, { realSquadsFor } from "./EnginePlay";
import { ShootoutStrip } from "./LiveShootout";
import type { ChanceResolved } from "./CanvasMatch";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { stageScene } from "@/lib/star/scenePicture";
import { mulberry32 } from "@/lib/star/season";
import {
  createShootout, takeNextKick, nextShootoutSide, nextTakerIndex,
  type PenaltyShootoutState, type ShootoutSide,
} from "@/lib/star/shootout";
import {
  attachAutoKick, clearForShootout, planPenalty, shootoutOrder, takerRating, yourPenaltyRating,
  type PenaltyTaker,
} from "@/lib/star/penaltyTaking";
import { buildTestCareer, testMatchKits } from "@/lib/star/engineProfile";
import { loadPlaySettings, sanitizePlaySettings } from "@/lib/star/playArea";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "@/lib/star/teamsheet";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import type { CareerState, Fixture } from "@/lib/star/types";
import {
  aimedCrossX, pastKickFrom, readKickHabits,
  type KeeperHabitRead, type PastKick, type PenaltyReadSettings,
} from "@/lib/star/penaltyKeeper";

type Keeper = { strength: number; id?: string; name?: string; shortName?: string; face?: string };
interface Sides {
  homeClub: string; awayClub: string; yourSide: ShootoutSide;
  home: PenaltyTaker[]; away: PenaltyTaker[];
  homeKeeper: Keeper; awayKeeper: Keeper;
}

/** Both sides' orders and keepers, off the same test career EnginePlay plays. */
function sidesFor(career: CareerState, fixture: Fixture, keeperDial: number, realKeeper: boolean, youTakeEvery = false): Sides {
  const roles = startingTeammateRoles(career, fixture);
  const ours = onPitchToday(fillMissingFromFullRoster(career.squad ?? [], roles, career), roles);
  const mates: PenaltyTaker[] = ours.map((p) => ({
    id: p.id, name: p.name, shortName: p.shortName, face: p.imageUrl ?? fakeFaceFor(p.id),
    rating: takerRating(p), isGK: p.position === "GK",
  }));
  for (let i = mates.filter((m) => !m.isGK).length; i < 5; i++) {
    mates.push({ id: `mate-${i}`, name: `Team-mate ${i + 1}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`mate-${i}`), rating: 62 });
  }
  const you: PenaltyTaker = {
    id: "you", name: `${career.player.firstName} ${career.player.lastName}`, shortName: career.player.lastName,
    face: DEFAULT_FAKE_FACE, rating: yourPenaltyRating(career.skills, career.starRating), you: true,
  };
  const xi = opponentStartingXI(career, fixture) ?? [];
  const theirs: PenaltyTaker[] = xi.map((p) => ({
    id: p.id, name: p.name, shortName: p.short, face: p.face ?? fakeFaceFor(p.id),
    rating: takerRating({ overall: p.overall }), isGK: p.role === "GK",
  }));
  for (let i = theirs.filter((m) => !m.isGK).length; i < 5; i++) {
    theirs.push({ id: `opp-${i}`, name: `Their No. ${i + 7}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`opp-${i}`), rating: 62 });
  }
  const ourGk = ours.find((p) => p.position === "GK");
  const theirGk = xi.find((p) => p.role === "GK");
  const clubStrength = career.league.find((t) => t.name === career.player.club)?.strength ?? 70;
  const ourKeeper: Keeper = {
    strength: Math.max(20, Math.min(99, ourGk?.overall ?? clubStrength)),
    id: ourGk?.id, name: ourGk?.name, shortName: ourGk?.shortName, face: ourGk ? (ourGk.imageUrl ?? fakeFaceFor(ourGk.id)) : undefined,
  };
  const theirKeeper: Keeper = {
    strength: Math.max(20, Math.min(99, realKeeper && theirGk?.overall !== undefined ? theirGk.overall : keeperDial)),
    id: theirGk?.id, name: theirGk?.name, shortName: theirGk?.short, face: theirGk ? (theirGk.face ?? fakeFaceFor(theirGk.id)) : undefined,
  };
  // A shootout can be over after three rounds, never sooner — so on this
  // screen, which exists to play your kick, you take one of the first three:
  // every shootout reaches you (final playtest: 0 kicks for you in 4).
  // youTakeEvery (the habits test page): you take every one of your side's kicks.
  const ourOrder = youTakeEvery ? [you] : shootoutOrder(mates, you, 3), theirOrder = shootoutOrder(theirs);
  const home = fixture.home !== false;
  return {
    homeClub: home ? career.player.club : fixture.opponent,
    awayClub: home ? fixture.opponent : career.player.club,
    yourSide: home ? "home" : "away",
    home: home ? ourOrder : theirOrder, away: home ? theirOrder : ourOrder,
    homeKeeper: home ? ourKeeper : theirKeeper, awayKeeper: home ? theirKeeper : ourKeeper,
  };
}

export default function ShootoutPlay({ seed = 1, width, onExit, readsHabits = false, onHabits, youTakeEvery = false, rememberKicks = false }: {
  seed?: number;
  width?: number;
  onExit?: () => void;
  /**
   * The keeper reads your habits (Leo, 22 Oct 2026; /star-shootout-dev only):
   * your earlier kicks in this shootout go to the keeper facing YOUR kicks
   * (lib/star/penaltyKeeper.ts `habit`). Absent/false: exactly as before.
   */
  readsHabits?: boolean;
  /** Your kicks so far in this shootout (oldest first) and the keeper's read of
   *  them, after every kick of yours and at a new shootout. Watching only. */
  onHabits?: (kicks: PastKick[], read: KeeperHabitRead) => void;
  /** You take every one of your side's kicks (the habits test page, so you
   *  get enough kicks to be read). Absent/false: one slot in the order, as before. */
  youTakeEvery?: boolean;
  /** "Another shootout" keeps your kicks, so the keeper still remembers them
   *  (the habits test page; it forgets on a remount). Absent/false: forgotten. */
  rememberKicks?: boolean;
}) {
  const s = useMemo(() => sanitizePlaySettings(loadPlaySettings()), []);
  const built = useMemo(() => buildTestCareer(s, seed), [s, seed]);
  const kits = useMemo(() => testMatchKits(s, seed), [s, seed]);
  const [sides, setSides] = useState<Sides | null>(null);
  const [state, setState] = useState<PenaltyShootoutState>(createShootout);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  // The match restarts every KICKS_PER_MOUNT kicks (onChanceResolved).
  const [seg, setSeg] = useState(0);
  const chancesRef = useRef(0);
  // Your kicks this shootout, as you see them (penaltyKeeper.ts PastKick).
  const [kicks, setKicks] = useState<PastKick[]>([]);
  const kicksRef = useRef(kicks);
  kicksRef.current = kicks;
  const onHabitsRef = useRef(onHabits);
  onHabitsRef.current = onHabits;
  useEffect(() => { onHabitsRef.current?.(kicks, readKickHabits(kicks)); }, [kicks]);
  // Where the ball is heading at the goal line and how high, from the last
  // two ball steps that moved it towards goal (read-only, onBallStep).
  const goalMidRef = useRef(0);
  const flightRef = useRef<{ prev: { x: number; y: number; z: number } | null; cross: number | null; z: number; frozen?: boolean }>({ prev: null, cross: null, z: 0 });
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const f = flightRef.current;
    const p = f.prev;
    f.prev = { x: b.x, y: b.y, z: b.z };
    if (f.frozen || !p || !(b.y < p.y - 1e-4)) return; // not flying towards goal
    f.cross = aimedCrossX({ pos: { x: b.x, y: b.y }, vel: { x: b.x - p.x, y: b.y - p.y } } as Parameters<typeof aimedCrossX>[0]);
    // Height AT the goal line: once it crosses, take it there and stop.
    if (b.y <= 0 && p.y > 0) { const t = p.y / (p.y - b.y); f.z = p.z + (b.z - p.z) * t; f.frozen = true; }
    else f.z = b.z;
  }, []);

  useEffect(() => {
    if (!built) return;
    let live = true;
    const key = `${s.division}|${built.career.player.club}`;
    const make = (c: CareerState) => { if (live) setSides(sidesFor(c, built.fixture, s.keeperStrength, s.realKeeper, youTakeEvery)); };
    const fallback = setTimeout(() => make(built.career), 4000);
    realSquadsFor(built.career, key).then((real) => { clearTimeout(fallback); make({ ...built.career, ...real }); }, () => make(built.career));
    return () => { live = false; clearTimeout(fallback); };
  }, [built, s, youTakeEvery]);

  // Start every taker's and keeper's photo loading as soon as the orders are
  // known, so the browser has it by his turn (the match still shows a fake
  // face until it has — never a blank head).
  useEffect(() => {
    if (!sides) return;
    const faces = [...sides.home, ...sides.away].map((t) => t.face)
      .concat(sides.homeKeeper.face, sides.awayKeeper.face);
    for (const f of faces) if (f) { const img = new Image(); img.src = f; }
  }, [sides]);

  const sidesRef = useRef(sides);
  sidesRef.current = sides;

  /** The picture for the kick that is up now. */
  const openOn = useCallback((): Scenario => {
    const sd = sidesRef.current!;
    const st = stateRef.current;
    const side = nextShootoutSide(st);
    const order = side === "home" ? sd.home : sd.away;
    const taker = order[nextTakerIndex(st, side, order.length)];
    const keeper = side === "home" ? sd.awayKeeper : sd.homeKeeper;
    const n = st.kicks.length;
    const rng = mulberry32((seed * 7919 + run * 104729 + n * 2654435761) >>> 0);
    const sc = buildScenario("penalty", rng, keeper.strength, 60, 55);
    initDefenders(sc, rng);
    stageScene(sc, { teammates: false });
    clearForShootout(sc);
    goalMidRef.current = (sc.goal.x1 + sc.goal.x2) / 2;
    flightRef.current = { prev: null, cross: null, z: 0 };
    if (!taker.you && !st.over) {
      attachAutoKick(sc, {
        side: side === sd.yourSide ? "us" : "them", taker, plan: planPenalty(taker.rating, rng), keeper, context: "shootout",
      });
    }
    return sc;
  }, [seed, run]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const sd = sidesRef.current;
    if (!sd || stateRef.current.over) return;
    const scored = info.outcome === "goal" || info.outcome === "rebound";
    // One of YOUR kicks: remember where it went (the keeper's habit read).
    const f = flightRef.current;
    if (!info.autoKick && info.youShot) {
      const cross = f.cross ?? info.ball?.x;
      if (cross !== undefined && Number.isFinite(cross)) {
        const k = pastKickFrom(cross, goalMidRef.current, f.z);
        const list = [...kicksRef.current, k];
        kicksRef.current = list;
        setKicks(list);
      }
    }
    const next = takeNextKick(stateRef.current, scored, 11);
    stateRef.current = next;
    setState(next);
    if (next.over) window.setTimeout(() => setDone(true), 2600);
    // Every kick is one chance of the match EnginePlay is playing, and that
    // match ends (its FULL TIME card) after a handful of chances. A long
    // shootout (sudden death, or you taking every kick) would run into it, so
    // the match starts again every few kicks, once this kick's result has shown.
    else if (++chancesRef.current >= KICKS_PER_MOUNT) {
      chancesRef.current = 0;
      window.setTimeout(() => setSeg((n) => n + 1), 2400);
    }
  }, []);

  const again = () => { const fresh = createShootout(); stateRef.current = fresh; setState(fresh); setDone(false); setRun((r) => r + 1); chancesRef.current = 0; if (!rememberKicks) { kicksRef.current = []; setKicks([]); } };

  // The keeper's habit read goes in only for YOUR kick, and only with the
  // prop on and a real lean; otherwise nothing is passed — as before.
  const habitRead = useMemo(() => readKickHabits(kicks), [kicks]);

  if (!built) return <div style={{ padding: 20, color: "#8a97aa" }}>No clubs in that division.</div>;
  if (!sides) {
    return <div style={{ padding: 20, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#8a97aa" }}>Picking the takers…</div>;
  }
  const side = nextShootoutSide(state);
  const order = side === "home" ? sides.home : sides.away;
  const up = order[nextTakerIndex(state, side, order.length)];
  const penaltyRead: Partial<PenaltyReadSettings> | undefined =
    readsHabits && up?.you && !state.over && habitRead.strength > 0 ? { habit: habitRead } : undefined;
  const homeColor = kits ? (built.fixture.home !== false ? kits.ours.shirt : kits.theirs.shirt) : undefined;
  const awayColor = kits ? (built.fixture.home !== false ? kits.theirs.shirt : kits.ours.shirt) : undefined;

  return (
    <div style={{ width: "100%", display: "grid", gap: 8, justifyItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <ShootoutStrip
          fixed
          homeClub={sides.homeClub} awayClub={sides.awayClub} homeColor={homeColor} awayColor={awayColor}
          state={state} final={state.over}
          upNext={state.over ? null : { side, name: up?.you ? "You" : up?.shortName ?? "…" }}
        />
      </div>
      {done ? (
        <div style={{ display: "grid", gap: 10, justifyItems: "center", padding: "18px 12px" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {/* From your side: "Won 4–2", never "Won 2–4" when you are away. */}
            {state.winner === sides.yourSide ? "Won" : "Lost"}{" "}
            {sides.yourSide === "home" ? state.homeScore : state.awayScore}–{sides.yourSide === "home" ? state.awayScore : state.homeScore} on penalties
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={again} style={btn}>Another shootout</button>
            {onExit && <button onClick={onExit} style={btn}>Back to highlights</button>}
          </div>
        </div>
      ) : (
        <EnginePlay
          key={`${run}-${seg}`} seed={seed + seg} openOn={openOn} bare width={width} onChanceResolved={onChanceResolved}
          onBallStep={onBallStep} penaltyRead={penaltyRead}
        />
      )}
    </div>
  );
}

/** Kicks one EnginePlay match plays before it starts again (its match ends after a few more). */
const KICKS_PER_MOUNT = 3;

const btn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: 12, cursor: "pointer",
  border: "1px solid rgba(56,189,248,0.55)", background: "rgba(14,116,144,0.38)",
  color: "#e0f2fe", fontSize: 14.5, fontWeight: 800,
};
