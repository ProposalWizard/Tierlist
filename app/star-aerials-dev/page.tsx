"use client";

/**
 * HEADERS AND VOLLEYS — the test page (Harry, 26 Oct 2026; the five ways to
 * hit it, 28 Nov 2026: "the headers and volleys system just has never worked
 * with WHEN you hit the ball … just make that into a test page, will come
 * back to that soon").
 *
 * 1 · How you hit it: today's ball screen, or one of five ideas. Ideas 1-4
 * play in the real match (EnginePlay, the one engine) with the whole cross on
 * the pitch (lib/star/airControl.ts, components/star/AirControlLab.tsx). Idea
 * 5 (the first-person pro camera) is not built: its drawn frames and the
 * honest effort are shown instead.
 * 2 · The chance: header or volley, Replay (the same chance again) and New
 * chance. 3 · The move: one aerial move forced, or Random.
 *
 * The switches (setTestAirControl, setTestAerialMove) are set by this page
 * while it is open and cleared when it closes. The game keeps the ball screen
 * and picks its own move. Nothing here touches a career.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill, Btn, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import EnginePlay from "@/components/star/EnginePlay";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { AERIAL_MOVES, AERIAL_SPECS, setTestAerialMove, type AerialMove } from "@/lib/star/aerialMoves";
import { AIR_CONTROL_INFO, AIR_CONTROL_MODES, AIR_CONTROL_NUMBERS, GROUND_NUMBERS, setTestAirControl, type AirControlMode } from "@/lib/star/airControl";

type Kind = "header" | "volley";
/** The picker: the five playable modes and idea 5, which is not built. */
type Pick = AirControlMode | "procam";
const PICKS: readonly Pick[] = [...AIR_CONTROL_MODES, "procam"];
const PROCAM = {
  name: "5 · Pro camera",
  line: "The camera drops to your eyes as the ball is crossed: you see it fly at you, aim on the goal you can see, and time it by a ring (idea 1) or the bar (idea 4).",
};
const SUITS: Record<Pick, string> = {
  screen: "both (the game today)",
  ghost: "volleys: where it drops IS the volley",
  preaim: "headers: easiest, but you have no say in WHEN",
  swipe: "volleys: feels like a leg swing, least accurate",
  beat: "headers: jump, hang, nod (volleys work too)",
  procam: "headers, then volleys: a showcase for big moments",
};

const MOVE_NAMES: Record<AerialMove, string> = {
  standHeader: "Standing header", jumpHeader: "Jumping header", divingHeader: "Diving header",
  chestVolley: "Chest volley", frontVolley: "Front volley", sideVolley: "Side volley",
  bicycle: "Bicycle kick", scorpion: "Scorpion kick",
};

export default function AerialsDevPage() {
  const [move, setMove] = useState<AerialMove | "random">("random");
  const [kind, setKind] = useState<Kind>("header");
  const [round, setRound] = useState(0);
  const [replay, setReplay] = useState(0);
  const n = useRef(0);
  const [pick, setPick] = useState<Pick>("screen");
  const control: AirControlMode = pick === "procam" ? "screen" : pick;
  // ?control=ghost|preaim|swipe|beat|procam opens on one.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("control");
    if ((PICKS as readonly string[]).includes(q ?? "")) setPick(q as Pick);
  }, []);
  // The switches live only while this page is open.
  useEffect(() => { setTestAirControl(control); }, [control]);
  useEffect(() => () => setTestAirControl(null), []);
  useEffect(() => { setTestAerialMove(move === "random" ? null : move); }, [move]);
  useEffect(() => () => setTestAerialMove(null), []);

  const pickControl = (c: Pick) => { setTestAirControl(c === "procam" ? "screen" : c); setPick(c); setRound((r) => Math.max(1, r + 1)); };
  const pickMove = (m: AerialMove | "random") => {
    setTestAerialMove(m === "random" ? null : m);
    if (m !== "random") setKind(AERIAL_SPECS[m].kind);
    setMove(m);
    setRound((r) => r + 1);
  };
  const pickKind = (k: Kind) => {
    setKind(k);
    if (move !== "random" && AERIAL_SPECS[move].kind !== k) { setTestAerialMove(null); setMove("random"); }
    setRound((r) => r + 1);
  };
  // Replay: the same chance again (the same seed from the first chance on).
  const doReplay = () => { n.current = 0; setReplay((x) => x + 1); };
  const doNew = () => setRound((r) => r + 1);

  const openOn = useCallback((): Scenario => {
    n.current += 1;
    const rng = mulberry32((round * 7919 + n.current * 104729) >>> 0);
    const sc = buildScenario(kind, rng, 62, 60, 55);
    initDefenders(sc, rng);
    return sc;
    // replay is in the deps so a Replay rebuilds the same first chance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, round, replay]);

  const info = pick === "procam" ? PROCAM : AIR_CONTROL_INFO[pick];
  const nums = pick === "procam" ? null : AIR_CONTROL_NUMBERS[pick];

  return (
    <BroadcastPage title="Headers and volleys" sub="Test page: five ways to decide WHEN and HOW you hit a header or volley, side by side on the real match. The game keeps today's ball screen until one is picked." width={480}>
      <PageGuide page="/star-aerials-dev" />
      <div className="flex flex-col gap-4">
        <Panel title="1 · How you hit it" note={`Suits: ${SUITS[pick]}`}>
          <div className="flex flex-wrap gap-1.5" data-air-controls>
            {PICKS.map((c) => (
              <Pill key={c} on={pick === c} onClick={() => pickControl(c)}>{c === "procam" ? PROCAM.name : AIR_CONTROL_INFO[c].name}</Pill>
            ))}
          </div>
          <Note>{info.line}</Note>
          {nums && (
            <div data-air-numbers className="mt-2 text-[12px] leading-snug">
              <Label>Bot numbers (an assumed average thumb, not people)</Label>
              <div>Goals per 100 at Aerial 30 / 60 / 90 · header <b>{nums.header.join(" / ")}</b> · volley <b>{nums.volley.join(" / ")}</b></div>
              {nums.cleanH !== undefined && <div>Clean hits at Aerial 60 · header <b>{nums.cleanH}%</b> · volley <b>{nums.cleanV}%</b></div>}
              {nums.note && <div>{nums.note}</div>}
              <div className="opacity-70">Ground shots, same bot: one-on-one {GROUND_NUMBERS.oneOnOne} · tight angle {GROUND_NUMBERS.tightAngle} · long range {GROUND_NUMBERS.longRange}</div>
            </div>
          )}
        </Panel>

        {pick === "procam" ? (
          <Panel title="2 · Pro camera: not built yet" note="Drawn frames, not the engine">
            <div className="grid grid-cols-3 gap-1.5" data-procam-frames>
              {[1, 2, 3].map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={`/star/aerials/pro-camera-${i}.webp`} alt={["The cross is coming", "Aim on the goal, time by the ring", "Nodded in"][i - 1]} className="w-full rounded-md" />
              ))}
            </div>
            <Note>
              Not built. The honest effort: the 3D match view (lib/star/style3d/engineView.ts) already draws every frame of the real engine,
              so the route is a new eye-level camera there for the two seconds of the cross, with idea 1&apos;s ring or idea 4&apos;s bar on top.
              Medium-hard, only on phones that run 3D, so the 2D match still needs one of ideas 1-4. A faked first person in 2D would be a new
              renderer: not recommended.
            </Note>
          </Panel>
        ) : (
          <Panel title="2 · The chance" note={move === "random" ? "The game picks the move" : `Forced: ${MOVE_NAMES[move]}`}>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Pill on={kind === "header"} onClick={() => pickKind("header")}>Header chance</Pill>
              <Pill on={kind === "volley"} onClick={() => pickKind("volley")}>Volley chance</Pill>
              <Btn onClick={doReplay}>Replay</Btn>
              <Btn onClick={doNew}>New chance</Btn>
            </div>
            {round === 0 ? (
              <Note>Press Header chance or Volley chance to play it.</Note>
            ) : (
              <div data-aerials-play>
                <EnginePlay key={`${kind}-${move}-${round}-${control}-${replay}`} seed={round} openOn={openOn} bare />
              </div>
            )}
          </Panel>
        )}

        <Panel title="3 · The move">
          <Label>Headers</Label>
          <div className="flex flex-wrap gap-1.5 mb-3 mt-1">
            {AERIAL_MOVES.filter((m) => AERIAL_SPECS[m].kind === "header").map((m) => (
              <Pill key={m} on={move === m} onClick={() => pickMove(m)}>{MOVE_NAMES[m]}</Pill>
            ))}
          </div>
          <Label>Volleys</Label>
          <div className="flex flex-wrap gap-1.5 mb-3 mt-1">
            {AERIAL_MOVES.filter((m) => AERIAL_SPECS[m].kind === "volley").map((m) => (
              <Pill key={m} on={move === m} onClick={() => pickMove(m)}>{MOVE_NAMES[m]}</Pill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill on={move === "random"} onClick={() => pickMove("random")}>🎲 Random (game picks)</Pill>
          </div>
          <Note>The move is drawn with today&apos;s ball screen. The five ideas strike through the same engine but do not play the move&apos;s clip yet.</Note>
        </Panel>
      </div>
    </BroadcastPage>
  );
}
