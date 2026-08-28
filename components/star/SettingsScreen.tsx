"use client";
import type { CareerState } from "@/lib/star/types";
import type { SkipTarget } from "@/lib/star/devSkip";
import DevSkipPanel from "./DevSkipPanel";
import PortraitPicker from "./PortraitPicker";

interface Props {
  career: CareerState;
  onBack: () => void;
  onSkip: (target: SkipTarget) => void;
  onNewCareer: () => void;
  onSetPortrait: (portrait: string | undefined) => void;
}

export default function SettingsScreen({ career, onBack, onSkip, onNewCareer, onSetPortrait }: Props) {
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

        <DevSkipPanel career={career} onSkip={onSkip} />

        <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800/60 p-3 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/85">Start over</div>
          <p className="mt-1 text-[11px] text-gray-200">
            Exit leaves the career saved. This deletes it and begins a new one.
          </p>
          <button
            onClick={onNewCareer}
            className="mt-2 w-full rounded-lg border border-red-500/60 bg-red-500/15 py-2 text-xs font-black text-red-200 transition hover:bg-red-500/25"
          >
            New career
          </button>
        </div>
      </div>
    </div>
  );
}
