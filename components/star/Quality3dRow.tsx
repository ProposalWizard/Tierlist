"use client";
/**
 * Settings → Look → "3D quality: Auto | Low | Med | High" (Harry, 5 Oct
 * 2026: "the less lag is BIG"). One row, its own file, so DeviceSettings.tsx
 * only gains a line. The value lives in lib/star/three3d/quality.ts; every
 * 3D scene (garden, shop, signing, office) reads it when it opens.
 *
 * Right under it: "Texture pack" (Harry, 13 Oct 2026), how the 3D match's
 * world is dressed (lib/star/style3d/texturePack.ts). Shown wherever 3D
 * quality is (Settings and the in-match ⚙).
 */
import { useEffect, useState } from "react";
import { useQuality3dSetting, setQuality3dSetting, autoQuality3d, type Quality3d } from "@/lib/star/three3d/quality";
import { useTexturePack, setTexturePack } from "@/lib/star/style3d/texturePack";
import { SegTabs } from "./screenKit";
import { SetNote } from "./settingsKit";

const NAME = { low: "Low", medium: "Medium", high: "High" } as const;

export default function Quality3dRow({ when = "Applies next time one opens." }: { when?: string } = {}) {
  const q = useQuality3dSetting();
  // read after mount: what Auto picks on this phone (not known on the server)
  const [auto, setAuto] = useState<Quality3d | null>(null);
  useEffect(() => { setAuto(autoQuality3d()); }, [q]);
  return (
    <>
      <div className="flex items-center justify-between gap-2" data-quality3d-row>
        <span className="text-[14px] font-bold text-white">3D quality</span>
        <SegTabs className="w-[200px] shrink-0" value={q} onChange={setQuality3dSetting} tabs={[["auto", "Auto"], ["low", "Low"], ["medium", "Med"], ["high", "High"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        Every 3D scene. Lower = smoother on older phones. Auto{auto ? ` picks ${NAME[auto]} here` : " picks for this phone"}. {when}
      </SetNote>
      <TexturePackRow />
    </>
  );
}

/** "Texture pack": changes the 3D match at once, mid-match too. */
function TexturePackRow() {
  const p = useTexturePack();
  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2" data-texture-pack-row>
        <span className="text-[14px] font-bold text-white">Texture pack</span>
        <SegTabs className="w-[220px] shrink-0" value={p} onChange={setTexturePack} tabs={[["real", "Real+toon"], ["cartoon", "Cartoon"], ["bright", "Bright"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        The 3D match&apos;s pitch, stadium and ball. Realism + cartoon is today&apos;s look. Cartoon is flat, like the players. Bright is lighter, with no big shadows.
      </SetNote>
    </>
  );
}
