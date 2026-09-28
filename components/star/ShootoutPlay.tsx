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

type Keeper = { strength: number; id?: string; name?: string; shortName?: string; face?: string };
interface Sides {
  homeClub: string; awayClub: string; yourSide: ShootoutSide;
  home: PenaltyTaker[]; away: PenaltyTaker[];
  homeKeeper: Keeper; awayKeeper: Keeper;
}

/** Both sides' orders and keepers, off the same test career EnginePlay plays. */
function sidesFor(career: CareerState, fixture: Fixture, keeperDial: number, realKeeper: boolean): Sides {
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
  const ourOrder = shootoutOrder(mates, you, 3), theirOrder = shootoutOrder(theirs);
  const home = fixture.home !== false;
  return {
    homeClub: home ? career.player.club : fixture.opponent,
    awayClub: home ? fixture.opponent : career.player.club,
    yourSide: home ? "home" : "away",
    home: home ? ourOrder : theirOrder, away: home ? theirOrder : ourOrder,
    homeKeeper: home ? ourKeeper : theirKeeper, awayKeeper: home ? theirKeeper : ourKeeper,
  };
}

export default function ShootoutPlay({ seed = 1, width, onExit }: {
  seed?: number;
  width?: number;
  onExit?: () => void;
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

  useEffect(() => {
    if (!built) return;
    let live = true;
    const key = `${s.division}|${built.career.player.club}`;
    const make = (c: CareerState) => { if (live) setSides(sidesFor(c, built.fixture, s.keeperStrength, s.realKeeper)); };
    const fallback = setTimeout(() => make(built.career), 4000);
    realSquadsFor(built.career, key).then((real) => { clearTimeout(fallback); make({ ...built.career, ...real }); }, () => make(built.career));
    return () => { live = false; clearTimeout(fallback); };
  }, [built, s]);

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
    const next = takeNextKick(stateRef.current, scored, 11);
    stateRef.current = next;
    setState(next);
    if (next.over) window.setTimeout(() => setDone(true), 2600);
  }, []);

  const again = () => { const fresh = createShootout(); stateRef.current = fresh; setState(fresh); setDone(false); setRun((r) => r + 1); };

  if (!built) return <div style={{ padding: 20, color: "#8a97aa" }}>No clubs in that division.</div>;
  if (!sides) {
    return <div style={{ padding: 20, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#8a97aa" }}>Picking the takers…</div>;
  }
  const side = nextShootoutSide(state);
  const order = side === "home" ? sides.home : sides.away;
  const up = order[nextTakerIndex(state, side, order.length)];
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
        <EnginePlay key={run} seed={seed} openOn={openOn} bare width={width} onChanceResolved={onChanceResolved} />
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  minHeight: 44, padding: "0 16px", borderRadius: 12, cursor: "pointer",
  border: "1px solid rgba(56,189,248,0.55)", background: "rgba(14,116,144,0.38)",
  color: "#e0f2fe", fontSize: 14.5, fontWeight: 800,
};
