"use client";
import { useState } from "react";
import type { CareerState, GoalReplay } from "@/lib/star/types";
import type { SkipTarget } from "@/lib/star/devSkip";
import type { SaveSlotSummary } from "@/lib/star/storage";
import { getPostMatchReactionsEnabled, setPostMatchReactionsEnabled } from "@/lib/star/postMatchPrefs";
import { loadFaceStyle, saveFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import DevSkipPanel from "./DevSkipPanel";
import DevMoneyPanel from "./DevMoneyPanel";
import PortraitPicker from "./PortraitPicker";
import GoalReplaysPanel from "./GoalReplaysPanel";
import SaveSlotsPanel from "./SaveSlotsPanel";
import RefreshPhotosPanel from "./RefreshPhotosPanel";

interface Props {
  career: CareerState;
  onBack: () => void;
  onSkip: (target: SkipTarget) => void;
  onAddMoney: (amount: number) => void;
  onSetPortrait: (portrait: string | undefined) => void;
  onWatchReplay: (replay: GoalReplay) => void;
  onSaveReplay: (index: number, replay: GoalReplay) => void;
  onDeleteSavedReplay: (id: string) => void;
  onRefreshPhotos: () => Promise<void>;
  onOpenFaceEditor: () => void;
  onOpenFakeFaceEditor: () => void;
  saves: SaveSlotSummary[];
  activeSlot: number;
  onSwitchSave: (slot: number) => void;
  onStartNewInSlot: (slot: number) => void;
  onDeleteSave: (slot: number) => void;
  /** The full-screen toggle used to be a fixed floating button — reported
   *  directly as blocking the real Settings button on most phones. Moved
   *  here as a plain on/off switch instead; the actual mechanism
   *  (useImmersiveMode) still lives one level up in page.tsx so it survives
   *  navigating away from Settings, this screen just reads/flips it. */
  immersiveActive: boolean;
  onToggleImmersive: () => void;
}

export default function SettingsScreen({
  career, onBack, onSkip, onAddMoney, onSetPortrait, onWatchReplay, onSaveReplay, onDeleteSavedReplay,
  onRefreshPhotos, onOpenFaceEditor, onOpenFakeFaceEditor, saves, activeSlot, onSwitchSave, onStartNewInSlot, onDeleteSave,
  immersiveActive, onToggleImmersive,
}: Props) {
  const [postMatchReactions, setPostMatchReactions] = useState(() => getPostMatchReactionsEnabled());

  const togglePostMatchReactions = () => {
    const next = !postMatchReactions;
    setPostMatchReactions(next);
    setPostMatchReactionsEnabled(next);
  };

  // Quick on/off switches, separate from the full editor — read/write the
  // exact same shared FaceStyle object FaceEditorScreen and CanvasMatch do,
  // so a flip here takes effect the same "next match" way every other Player
  // Graphics change already does.
  const [faceStyle, setFaceStyle] = useState<FaceStyle>(loadFaceStyle);
  const toggleFaceStyle = (key: "facesEnabled" | "namesEnabled", value: boolean) => {
    const next = { ...faceStyle, [key]: value };
    setFaceStyle(next);
    saveFaceStyle(next);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-3 py-3">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1 px-3 py-1.5 bg-gray-700 rounded-lg text-xs font-black text-white hover:bg-gray-600"
        >
          ← Home
        </button>
        <h1 className="text-lg font-black">Settings</h1>

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Photo</div>
          <p className="mt-1 text-[11px] text-gray-300">
            Change the photograph on your graphics, or take it back off.
          </p>
          <div className="mt-2">
            <PortraitPicker
              value={career.player.portrait}
              onChange={onSetPortrait}
              club={career.player.club}
              number={career.squadNumber}
            />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white">Post-Match Reactions</div>
              <p className="mt-1 text-[11px] text-white">
                After your rating and match money, skip the phone screen and go straight back to the dashboard.
              </p>
            </div>
            <button
              onClick={togglePostMatchReactions}
              role="switch"
              aria-checked={postMatchReactions}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${postMatchReactions ? "bg-emerald-500" : "bg-gray-600"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${postMatchReactions ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white">Full Screen</div>
              <p className="mt-1 text-[11px] text-white">
                Hide the site's top bar and footer, and go full screen where your browser supports it.
              </p>
            </div>
            <button
              onClick={onToggleImmersive}
              role="switch"
              aria-checked={immersiveActive}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${immersiveActive ? "bg-emerald-500" : "bg-gray-600"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${immersiveActive ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Player Graphics</div>
          <p className="mt-1 text-[11px] font-semibold text-white/90">
            Size, position, backing circle and outline for every face on the pitch — two full editors with a live preview, not just a slider.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={onOpenFaceEditor}
              className="py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-black text-white"
            >
              Real Photos →
            </button>
            <button
              onClick={onOpenFakeFaceEditor}
              className="py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-[11px] font-black text-white"
            >
              Fake Faces →
            </button>
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-white/55">
            Real photos and the seven fake faces are different images with different framing, so each gets its own size/position/crop — pick the one you want to tune.
          </p>

          <label className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-white/90">Player faces</span>
            <input type="checkbox" checked={faceStyle.facesEnabled}
              onChange={e => toggleFaceStyle("facesEnabled", e.target.checked)}
              className="h-4 w-4 accent-emerald-500" />
          </label>
          <p className="text-[10px] font-semibold text-white/55">
            Off shows the plain shirt-coloured circle every figure already falls back to when it has no photo.
          </p>

          <label className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-white/90">Player names</span>
            <input type="checkbox" checked={faceStyle.namesEnabled}
              onChange={e => toggleFaceStyle("namesEnabled", e.target.checked)}
              className="h-4 w-4 accent-emerald-500" />
          </label>
          <p className="text-[10px] font-semibold text-white/55">
            Shows each player&apos;s name in clear text above their head — works alongside faces, not instead of them, unless you turn faces off too.
          </p>
        </div>

        <RefreshPhotosPanel onRefresh={onRefreshPhotos} />

        <DevSkipPanel career={career} onSkip={onSkip} />

        <DevMoneyPanel career={career} onAddMoney={onAddMoney} />

        <GoalReplaysPanel
          career={career}
          onWatchReplay={onWatchReplay}
          onSaveReplay={onSaveReplay}
          onDeleteSavedReplay={onDeleteSavedReplay}
        />

        <SaveSlotsPanel
          saves={saves}
          activeSlot={activeSlot}
          onSwitch={onSwitchSave}
          onStartNew={onStartNewInSlot}
          onDelete={onDeleteSave}
        />
      </div>
    </div>
  );
}
