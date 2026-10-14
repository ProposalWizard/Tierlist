"use client";
/**
 * Settings → Look → "3D quality: Auto | Low | Med | High" (Harry, 5 Oct
 * 2026: "the less lag is BIG"). One row, its own file, so DeviceSettings.tsx
 * only gains a line. The value lives in lib/star/three3d/quality.ts; every
 * 3D scene (garden, shop, signing, office) reads it when it opens.
 *
 * Right under it: "Texture pack" (Harry, 13 Oct 2026), how the 3D match's
 * world is dressed (lib/star/style3d/texturePack.ts). Shown wherever 3D
 * quality is (Settings and the in-match ⚙). A dropdown with a picture of each
 * pack since 14 Oct 2026.
 *
 * Under that: "Chances: Old | New" (Harry, 14 Oct 2026), lib/star/newChances.ts.
 */
import { useEffect, useState } from "react";
import { useQuality3dSetting, setQuality3dSetting, autoQuality3d, type Quality3d } from "@/lib/star/three3d/quality";
import { createPortal } from "react-dom";
import { useTexturePack, setTexturePack, TEXTURE_PACKS, TEXTURE_PACK_NAMES, TEXTURE_PACK_LINES, TEXTURE_PACK_PREVIEW, type TexturePack } from "@/lib/star/style3d/texturePack";
import { useChancesMode, setChancesMode } from "@/lib/star/newChances";
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
      <ChancesRow />
    </>
  );
}

/** A pack's picture, or a plain tile when the pack has none yet. */
function PackThumb({ id, className }: { id: TexturePack; className: string }) {
  const src = TEXTURE_PACK_PREVIEW[id];
  return src
    ? <img src={src} alt="" draggable={false} className={`${className} object-cover`} />
    : <div className={`${className} bg-emerald-900/60`} />;
}

/**
 * "Texture pack": a dropdown with a picture of each pack (Harry, 14 Oct 2026:
 * "texture packs should have its own drop down where you can see a preview
 * image"). Tap opens a sheet (bottom on a phone, centred on a wide screen);
 * choosing changes the 3D match at once, mid-match too. The list is
 * TEXTURE_PACKS, so a new pack shows up by itself.
 */
function TexturePackRow() {
  const p = useTexturePack();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // fetch every pack's picture now (about 33 KB in all), so the list opens with them shown
    for (const id of TEXTURE_PACKS) { const src = TEXTURE_PACK_PREVIEW[id]; if (src) new Image().src = src; }
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2" data-texture-pack-row>
        <span className="text-[14px] font-bold text-white">Texture pack</span>
        <button
          type="button"
          data-texture-pack-open
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="kib-press flex min-w-0 max-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/15 bg-white/5 p-1 pr-2 text-left"
        >
          <PackThumb id={p} className="h-[34px] w-[48px] shrink-0 rounded-md" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{TEXTURE_PACK_NAMES[p]}</span>
          <span aria-hidden className="text-[12px] text-white/80">▾</span>
        </button>
      </div>
      <SetNote dim className="mt-1 text-[10px]">The 3D match&apos;s pitch, stadium and ball.</SetNote>
      {open && mounted && createPortal(
        <div data-texture-pack-sheet className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="listbox"
            aria-label="Texture pack"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-gray-950 px-3 pb-6 pt-3 sm:max-w-[420px] sm:rounded-2xl sm:border sm:pb-3"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[16px] font-black text-white">Texture pack</div>
              <button type="button" onClick={() => setOpen(false)} className="kib-press rounded-lg bg-white/10 px-3 py-1 text-[13px] font-bold text-white">Done</button>
            </div>
            <div className="space-y-2">
              {TEXTURE_PACKS.map((id) => {
                const on = id === p;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    data-texture-pack-option={id}
                    onClick={() => { setTexturePack(id); setOpen(false); }}
                    className={`kib-press flex w-full items-center gap-3 rounded-xl border p-2 text-left ${on ? "border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-white/5"}`}
                  >
                    <PackThumb id={id} className="h-[70px] w-[100px] shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-white">{TEXTURE_PACK_NAMES[id]}</span>
                      <span className="mt-0.5 block text-[12px] font-bold leading-snug text-white/80">{TEXTURE_PACK_LINES[id]}</span>
                    </span>
                    <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[14px] font-black ${on ? "bg-emerald-400 text-gray-950" : "border border-white/25 text-transparent"}`}>✓</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** "Chances: Old | New" (Harry, 14 Oct 2026: "the top toggle under textures for now"). */
function ChancesRow() {
  const m = useChancesMode();
  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2" data-chances-row>
        <span className="text-[14px] font-bold text-white">Chances</span>
        <SegTabs className="w-[140px] shrink-0" value={m} onChange={setChancesMode} tabs={[["old", "Old"], ["new", "New"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        New: chances follow the match (right wing, right kind, build-up on some).
      </SetNote>
    </>
  );
}
