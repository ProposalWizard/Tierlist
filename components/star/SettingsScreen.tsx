"use client";
import type { CareerState, GoalReplay } from "@/lib/star/types";
import type { SkipTarget } from "@/lib/star/devSkip";
import type { SaveSlotSummary } from "@/lib/star/storage";
import DevSkipPanel from "./DevSkipPanel";
import DevMoneyPanel from "./DevMoneyPanel";
import PortraitPicker from "./PortraitPicker";
import GoalReplaysPanel from "./GoalReplaysPanel";
import SaveSlotsPanel from "./SaveSlotsPanel";
import FaceScalePanel from "./FaceScalePanel";
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
  saves: SaveSlotSummary[];
  activeSlot: number;
  onSwitchSave: (slot: number) => void;
  onStartNewInSlot: (slot: number) => void;
  onDeleteSave: (slot: number) => void;
}

export default function SettingsScreen({
  career, onBack, onSkip, onAddMoney, onSetPortrait, onWatchReplay, onSaveReplay, onDeleteSavedReplay,
  onRefreshPhotos, saves, activeSlot, onSwitchSave, onStartNewInSlot, onDeleteSave,
}: Props) {
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

        <FaceScalePanel />

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
