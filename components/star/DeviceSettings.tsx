"use client";
import { useState } from "react";
import { useUiVersion, setUiVersion } from "@/lib/star/uiLook";
import { useSfxOn, setSfxOn, sfx } from "@/lib/star/sfx";
import { getPostMatchReactionsEnabled, setPostMatchReactionsEnabled } from "@/lib/star/postMatchPrefs";
import { getSkipLineup, setSkipLineup } from "@/lib/star/lineupPrefs";
import { loadFaceStyle, saveFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { storedFigureSkin, setStoredFigureSkin, type FigureSkin } from "@/lib/star/figureSkin";
import { useStoredMatchView, setMatchView } from "@/lib/star/matchView";
import { useSigning3d, setSigning3d, useShop3dPlayerLook, setShop3dPlayerLook } from "@/lib/star/signing3d";
import type { FullscreenSupport } from "./ImmersiveToggle";
import { SegTabs } from "./screenKit";
import { SetCard, SetDivider, SetNote, SetToggle } from "./settingsKit";

/**
 * THE SETTINGS THAT BELONG TO THIS DEVICE, NOT TO A SAVE.
 *
 * Shared by the in-career Settings (SettingsScreen.tsx) and the title
 * screen's own Settings page (GlobalSettingsScreen.tsx) — Harry, 2 Oct 2026,
 * v0.25 point 2: the title's Settings shows "only settings that affect the
 * whole game". Every switch here is stored on this phone only.
 */

/** Full screen, shaped by what this device can actually do. */
export function FullScreenRow({ support, on, onToggle, last = false }: {
  support: FullscreenSupport;
  on: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const rule = last ? "" : "border-b border-white/10";

  if (support === "standalone") {
    return (
      <div className={`flex items-center justify-between gap-3 py-2.5 ${rule}`}>
        <span className="text-[14px] font-bold leading-tight text-white">Full screen</span>
        <span className="text-[12px] font-black text-emerald-300">On ✓</span>
      </div>
    );
  }

  if (support === "ios") {
    return (
      <div className={`py-2.5 ${rule}`} data-tour="fullscreen">
        <button
          onClick={() => setTipOpen(o => !o)}
          aria-expanded={tipOpen}
          className="kib-press flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-[14px] font-bold leading-tight text-white">Full screen</span>
          <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-black text-white">{tipOpen ? "Hide" : "How?"}</span>
        </button>
        {tipOpen && <HomeScreenTip />}
      </div>
    );
  }

  return (
    <div data-fs-toggle data-tour="fullscreen">
      <SetToggle label="Full screen" on={on} onClick={onToggle} last={last} />
    </div>
  );
}

/** iPhone: Share → Add to Home Screen → open from the icon. */
function HomeScreenTip() {
  return (
    <div className="mt-2 rounded-lg bg-black/30 p-2.5">
      {/* Safari and the Home Screen app keep separate saves on an iPhone
          (Harry, 3 Oct 2026: the app opened with all three saves "gone"). */}
      <p className="mb-2 rounded-md bg-amber-400/15 px-2 py-1.5 text-[12px] font-bold leading-snug text-amber-100" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.45)" }}>
        Your saves stay in Safari. Before you add the game, sign in (save 1 follows you) or use Move my saves.
      </p>
      <ol className="space-y-1.5 text-[12px] font-bold leading-snug text-white">
        <li className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </span>
          Tap Share in Safari
        </li>
        <li className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/15 text-[15px] font-black" aria-hidden>+</span>
          Add to Home Screen
        </li>
        <li className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500 text-[13px]" aria-hidden>⚽</span>
          Open the game from that icon
        </li>
      </ol>
      <SetNote dim className="mt-2 text-[10px]">iPhone browsers can&apos;t hide their bars. From the Home Screen the game has none.</SetNote>
    </div>
  );
}

/** The on/off rows: full screen, sound, and the match switches. */
export function GameSwitches({ glow, fullscreen }: {
  glow: string;
  fullscreen: { support: FullscreenSupport; on: boolean; onToggle: () => void };
}) {
  const sfxNow = useSfxOn();
  const [postMatchReactions, setPostMatchReactions] = useState(() => getPostMatchReactionsEnabled());
  const flipPostMatch = () => { const next = !postMatchReactions; setPostMatchReactions(next); setPostMatchReactionsEnabled(next); };
  const [skipLineup, setSkipLineupState] = useState(() => getSkipLineup());
  const flipSkipLineup = () => { const next = !skipLineup; setSkipLineupState(next); setSkipLineup(next); };
  // The same shared FaceStyle the face editors and the match read.
  const [faceStyle, setFaceStyle] = useState<FaceStyle>(loadFaceStyle);
  const flipFace = (key: "facesEnabled" | "namesEnabled") => {
    const next = { ...faceStyle, [key]: !faceStyle[key] };
    setFaceStyle(next);
    saveFaceStyle(next);
  };

  return (
    <SetCard tone={glow} className="px-3 py-1">
      <FullScreenRow support={fullscreen.support} on={fullscreen.on} onToggle={fullscreen.onToggle} />
      <SetToggle label="Sound effects" on={sfxNow} onClick={() => { const on = !sfxNow; setSfxOn(on); if (on) sfx("ui-confirm"); }} />
      <SetToggle label="Post-match reactions" on={postMatchReactions} onClick={flipPostMatch} />
      <SetToggle label="Skip the line-up" on={skipLineup} onClick={flipSkipLineup} />
      <SetToggle label="Player faces" on={faceStyle.facesEnabled} onClick={() => flipFace("facesEnabled")} />
      <SetToggle label="Player names" on={faceStyle.namesEnabled} onClick={() => flipFace("namesEnabled")} last />
    </SetCard>
  );
}

/** Player look (Classic/3D), the match view (New/Classic), the signing scene (3D/Drawn), the 3D shop's player (New/Old) and the UI (Old/New). Put inside a SetCard. */
export function LookSwitches() {
  const [look, setLook] = useState<FigureSkin>(() => storedFigureSkin());
  const pickLook = (s: FigureSkin) => { setLook(s); setStoredFigureSkin(s); };
  const uiNow = useUiVersion();
  const viewNow = useStoredMatchView();
  const signing3d = useSigning3d();
  const shopPlayer = useShop3dPlayerLook();
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-white">Match view</span>
        <SegTabs className="w-[150px] shrink-0" value={viewNow} onChange={setMatchView} tabs={[["new", "New"], ["classic", "Classic"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        New: zoomed out, the pitch fills the screen. Classic: the close-up view. Next match on.
      </SetNote>
      <SetDivider />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-white">Signing scene</span>
        <SegTabs className="w-[150px] shrink-0" value={signing3d ? "3d" : "drawn"} onChange={(v) => setSigning3d(v === "3d")} tabs={[["3d", "3D"], ["drawn", "Drawn"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        3D: a live scene with your own player in it. Drawn: the picture signing, as before.
      </SetNote>
      <SetDivider />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-white">3D shop player</span>
        <SegTabs className="w-[150px] shrink-0" value={shopPlayer} onChange={setShop3dPlayerLook} tabs={[["new", "New"], ["old", "Old"]] as const} />
      </div>
      <SetDivider />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-white">Player look</span>
        <SegTabs className="w-[150px] shrink-0" value={look} onChange={pickLook} tabs={[["classic", "Classic"], ["3d", "3D"]] as const} />
      </div>
      <SetDivider />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold text-white">UI</span>
        <SegTabs className="w-[150px] shrink-0" value={uiNow} onChange={setUiVersion} tabs={[["old", "Old"], ["new", "New"]] as const} />
      </div>
      <SetNote dim className="mt-1 text-[10px]">
        Old is the game as it was before v0.23, kept as a backup. Same save either way. This phone only.
      </SetNote>
    </>
  );
}
