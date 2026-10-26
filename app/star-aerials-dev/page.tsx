"use client";

/**
 * HEADERS AND VOLLEYS — the aerial moves test page (Harry, 26 Oct 2026).
 *
 * Press a move and a header or volley chance plays in the real match
 * (EnginePlay, the one engine) with that move forced: stand, jump or diving
 * header; chest, front or side volley; bicycle; scorpion. "Random" lets the
 * game pick, as in a career (lib/star/aerialMoves.ts pickAerialMove).
 *
 * The force is set by this page (setTestAerialMove) while it is open and
 * cleared when it closes, so it works on the live site for admins (DevGate),
 * not only in a local build. Nothing here touches a career.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Pill, Btn, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import EnginePlay from "@/components/star/EnginePlay";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { AERIAL_MOVES, AERIAL_SPECS, setTestAerialMove, type AerialMove } from "@/lib/star/aerialMoves";

type Kind = "header" | "volley";

const MOVE_NAMES: Record<AerialMove, string> = {
  standHeader: "Standing header", jumpHeader: "Jumping header", divingHeader: "Diving header",
  chestVolley: "Chest volley", frontVolley: "Front volley", sideVolley: "Side volley",
  bicycle: "Bicycle kick", scorpion: "Scorpion kick",
};

export default function AerialsDevPage() {
  const [move, setMove] = useState<AerialMove | "random">("random");
  const [kind, setKind] = useState<Kind>("header");
  const [round, setRound] = useState(0);
  const n = useRef(0);

  // The force lives only while this page is open.
  useEffect(() => { setTestAerialMove(move === "random" ? null : move); }, [move]);
  useEffect(() => () => setTestAerialMove(null), []);

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

  const openOn = useCallback((): Scenario => {
    n.current += 1;
    const rng = mulberry32((round * 7919 + n.current * 104729) >>> 0);
    const sc = buildScenario(kind, rng, 62, 60, 55);
    initDefenders(sc, rng);
    return sc;
  }, [kind, round]);

  return (
    <BroadcastPage title="Headers and volleys" sub="Pick a move and the chance plays in the real match with that move forced. Test page only: the game picks its own." width={480}>
      <PageGuide page="/star-aerials-dev" />
      <div className="flex flex-col gap-4">
        <Panel title="1 · The move">
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
        </Panel>

        <Panel title="2 · The chance" note={move === "random" ? "The game picks the move" : `Forced: ${MOVE_NAMES[move]}`}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Pill on={kind === "header"} onClick={() => pickKind("header")}>Header chance</Pill>
            <Pill on={kind === "volley"} onClick={() => pickKind("volley")}>Volley chance</Pill>
            <Btn onClick={() => setRound((r) => r + 1)}>New chance</Btn>
          </div>
          {round === 0 ? (
            <Note>Press a move or a chance above to play it.</Note>
          ) : (
            <div data-aerials-play>
              <EnginePlay key={`${kind}-${move}-${round}`} seed={round} openOn={openOn} bare />
            </div>
          )}
        </Panel>
      </div>
    </BroadcastPage>
  );
}
