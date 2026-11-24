/**
 * THE 3D PART OF THE TWO NIGHTS (the website's components/star/BallonDorNight.tsx `Stage3D` and
 * SeasonAwardsNight.tsx `Room3D`): the stage and the room, drawn by the website's own scenes
 * (lib/star/ballonDor3d.ts, lib/star/awardsNight3d.ts, not touched) on the phone's GL view through
 * ../../three/Walk3D.tsx. It is only a picture under the words: no touch layer (the screen's own buttons and
 * the tap for the next award are what the player touches), no stick, and it keeps time by `clock`, the night's
 * clock that ./Ceremonies.tsx owns, so the words and the people move together.
 *
 * It starts when the night opens and says `onReady` once the stage is up (the clock starts then; the screen
 * shows "Taking your seats…" until). If the 3D cannot start (the crash guard has it off, the GL is refused, it
 * takes over the website's 20 s) it says `onFail`, shows nothing, and the screen goes on with its drawn stage
 * (the same night, the same beats): a night is never lost. It draws only while the screen is on, the app is in
 * front, and nothing else (Walk3D's own rules).
 */
import { useMemo } from "react";
import type { CareerState } from "@/lib/star/types";
import type { NightPlan } from "@/lib/star/ballonDorNight";
import type { AwardsPlan } from "@/lib/star/awardsNight";
import { Walk3D } from "../../three/Walk3D";
import { loadAwardsStart, loadBallonStart, type AwardsData, type AwardsWalk, type BallonData, type BallonWalk, type NightCallbacks } from "../../three/nightScene";
import { awardsData, ballonData } from "../../three/nightData";

/** The scene's still-picture call, for the web build's checks. */
export interface NightHandle { debugSeek(t: number): void }

/** The longest the 3D may take before the drawn night takes over (the website's LOAD_LIMIT_MS). */
const LOAD_LIMIT_MS = 20000;
const NOTHING = () => ({} as NightCallbacks);
const NO_BACK = () => { /* the screen's own Skip button leaves */ };

interface Props<P> {
  career: CareerState;
  plan: P;
  /** Seconds into the night. */
  clock: () => number;
  handle: { current: NightHandle | null };
  showSpeed: boolean;
  onReady: () => void;
  onFail: () => void;
}

export function BallonStage3D({ career, plan, clock, handle, showSpeed, onReady, onFail }: Props<NightPlan>) {
  // built once: a later change to the save does not rebuild the stage
  const data = useMemo(() => ballonData(career, plan, clock), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Walk3D<BallonData, NightCallbacks, BallonWalk>
      name="The Golden Ball night" cover="#070912" inert load={loadBallonStart} data={data} callbacks={NOTHING}
      onBack={NO_BACK} onFail={() => onFail()} loadLimitMs={LOAD_LIMIT_MS} showSpeed={showSpeed}
      onController={(c) => { handle.current = c; }} onReady={onReady} />
  );
}

export function AwardsStage3D({ career, plan, clock, handle, showSpeed, onReady, onFail }: Props<AwardsPlan>) {
  const data = useMemo(() => awardsData(career, plan, clock), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Walk3D<AwardsData, NightCallbacks, AwardsWalk>
      name="The Season Awards night" cover="#120a07" inert load={loadAwardsStart} data={data} callbacks={NOTHING}
      onBack={NO_BACK} onFail={() => onFail()} loadLimitMs={LOAD_LIMIT_MS} showSpeed={showSpeed}
      onController={(c) => { handle.current = c; }} onReady={onReady} />
  );
}
