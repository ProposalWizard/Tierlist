"use client";
import { useState } from "react";
import type { FullscreenSupport } from "./ImmersiveToggle";
import PointerTour from "./PointerTour";
import type { TourStep } from "@/lib/star/tours";
import { RiseIn } from "./ui";
import { Screen, ScreenHeader } from "./ui/Screen";
import { GameSwitches, LookSwitches } from "./DeviceSettings";
import { SetCard, SetSection } from "./settingsKit";
import MoveSavesPanel from "./MoveSavesPanel";

/**
 * THE TITLE SCREEN'S SETTINGS (Harry, 2 Oct 2026, v0.25 points 1 and 2).
 *
 * Its own full-screen page, not tied to any save: no top bar (so no star
 * rating, energy, age, name, team, photo, or a settings icon on the settings
 * page), no per-save options like run-ups. Only what applies to the whole
 * game on this device. Back goes to the title screen, and there is no Home
 * button — the old one dropped you into the career without pressing Play.
 *
 * Settings opened from inside a career is still SettingsScreen.tsx, with its
 * career parts.
 */

const GREEN = "#10b981";

const TOUR: TourStep[] = [
  { target: "screen", text: "These settings are for this phone, every save" },
  { target: "fullscreen", text: "Full screen hides the browser's bars" },
  { target: "back", text: "Back to the main menu" },
];

export default function GlobalSettingsScreen({ onBack, fullscreen, moveSaves }: {
  onBack: () => void;
  fullscreen: { support: FullscreenSupport; on: boolean; onToggle: () => void };
  /** "Move my saves" — Safari and the Home Screen app keep separate saves
   *  on an iPhone (MoveSavesPanel). Absent: not shown. */
  moveSaves?: { scope: string; onImported: (openSlot: number) => void };
}) {
  const [help, setHelp] = useState(false);
  return (
    <Screen glow={GREEN} className="max-w-md px-3 pb-10 pt-4">
      <div data-tour="screen">
        <div className="relative">
          <span data-tour="back" className="pointer-events-none absolute left-0 top-0 h-9 w-28" aria-hidden />
          <ScreenHeader
            title="Settings"
            kicker="This device"
            kickerColor="#6ee7b7"
            onBack={onBack}
            backLabel="← Main menu"
            right={
              <button
                onClick={() => setHelp(true)}
                aria-label="Help"
                className="kib-press grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[16px] font-black text-white ring-1 ring-white/25"
              >
                ?
              </button>
            }
          />
        </div>

        <RiseIn index={0}><SetSection className="mb-1.5 mt-1">Game</SetSection></RiseIn>
        <RiseIn index={1}><GameSwitches glow={GREEN} fullscreen={fullscreen} /></RiseIn>

        <RiseIn index={2}><SetSection>Look</SetSection></RiseIn>
        <RiseIn index={3}><SetCard tone={GREEN}><LookSwitches /></SetCard></RiseIn>

        {moveSaves && (
          <>
            <RiseIn index={4}><SetSection>Saves</SetSection></RiseIn>
            <RiseIn index={5}><MoveSavesPanel scope={moveSaves.scope} onImported={moveSaves.onImported} glow={GREEN} /></RiseIn>
          </>
        )}
      </div>
      {help && <PointerTour key="global-settings" steps={TOUR} onDone={() => setHelp(false)} />}
    </Screen>
  );
}
