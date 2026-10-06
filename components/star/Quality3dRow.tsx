"use client";
/**
 * Settings → Look → "3D quality: Auto | Low | Med | High" (Harry, 5 Oct
 * 2026: "the less lag is BIG"). One row, its own file, so DeviceSettings.tsx
 * only gains a line. The value lives in lib/star/three3d/quality.ts; every
 * 3D scene (garden, shop, signing, office) reads it when it opens.
 */
import { useEffect, useState } from "react";
import { useQuality3dSetting, setQuality3dSetting, autoQuality3d, type Quality3d } from "@/lib/star/three3d/quality";
import { SegTabs } from "./screenKit";
import { SetNote } from "./settingsKit";

const NAME = { low: "Low", medium: "Medium", high: "High" } as const;

export default function Quality3dRow() {
  const q = useQuality3dSetting();
  // read after mount: what Auto picks on this phone (not known on the server)
  const [auto, setAuto] = useState<Quality3d | null>(null);
  useEffect(() => { setAuto(autoQuality3d()); }, [q]);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-white">3D quality</span>
        <SegTabs className="w-[200px] shrink-0" value={q} onChange={setQuality3dSetting} tabs={[["auto", "Auto"], ["low", "Low"], ["medium", "Med"], ["high", "High"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        Every 3D scene. Lower = smoother on older phones. Auto{auto ? ` picks ${NAME[auto]} here` : " picks for this phone"}. Applies next time one opens.
      </SetNote>
    </>
  );
}
