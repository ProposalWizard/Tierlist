"use client";
/**
 * "Real moment highlights: Off | On" (Harry, 20 Oct 2026), the second switch
 * inside the Full highlights rebuild row. Shown only while the rebuild is On
 * (it only counts then). The value: lib/star/fhr/realMomentToggle.ts; what it
 * does: lib/star/fhr/realMomentHighlights.ts.
 */
import { useEffect } from "react";
import { useFhrMode } from "@/lib/star/fhr/toggle";
import { useRealMomentsMode, setRealMomentsMode } from "@/lib/star/fhr/realMomentToggle";
import { loadRealMomentPool, REAL_MOMENT_OF_ALL_IN } from "@/lib/star/fhr/realMomentHighlights";
import { SegTabs } from "./screenKit";
import { SetNote } from "./settingsKit";

export default function RealMomentsRow() {
  const fhr = useFhrMode() === "on";
  const m = useRealMomentsMode();
  // Switched On: start loading the real moments now, so the first match already has them.
  useEffect(() => { if (fhr && m === "on") void loadRealMomentPool(); }, [fhr, m]);
  if (!fhr) return null;
  return (
    <div className="ml-2 border-l-2 border-emerald-400/40 pl-2.5" data-real-moments-row>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-white">Real moment highlights</span>
        <SegTabs className="w-[120px] shrink-0" value={m} onChange={setRealMomentsMode} tabs={[["off", "Off"], ["on", "On"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        On: about 1 in {REAL_MOMENT_OF_ALL_IN} open-play chances is a real one, every player where he really stood, with the real build-up first.
      </SetNote>
    </div>
  );
}
