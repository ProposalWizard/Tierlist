"use client";
import { useSigning3d, setSigning3d } from "@/lib/star/signing3d";
import { useState } from "react";
import type { CareerState, GoalReplay } from "@/lib/star/types";
import type { SkipTarget } from "@/lib/star/devSkip";
import type { SaveSlotSummary } from "@/lib/star/storage";
import { devInfoOn, setDevInfo } from "@/lib/star/matchDayPrefs";
import { GameSwitches, LookSwitches } from "./DeviceSettings";
import type { FullscreenSupport } from "./ImmersiveToggle";
import DevSkipPanel from "./DevSkipPanel";
import DevMoneyPanel from "./DevMoneyPanel";
import DevCareerPanel from "./DevCareerPanel";
import PortraitPicker from "./PortraitPicker";
import GoalReplaysPanel from "./GoalReplaysPanel";
import SaveSlotsPanel from "./SaveSlotsPanel";
import MoveSavesPanel from "./MoveSavesPanel";
import RefreshPhotosPanel from "./RefreshPhotosPanel";
import {
  ownedPenaltyRunups, ownedFreeKickRunups, careerPenaltyRunup, careerFreeKickRunup,
  type PenaltyRunupId, type FreeKickRunupId, type RunupId, type RunupStyle,
} from "@/lib/star/runupStyles";
import { PressButton, RiseIn, tint, useClubTheme } from "./ui";
import { Screen, ScreenHeader } from "./ui/Screen";
import { SegTabs } from "./screenKit";
import { SetCard, SetHead, SetNote, SetDivider, SetSection, Switch } from "./settingsKit";

/**
 * SETTINGS — reskinned 28 Sep 2026 to the home screen's look (Harry: "all
 * the pages should just be reskinned to fit the new home screen vibe"):
 * the night-stadium backdrop lit in your club's colour, club-lit glass
 * cards grouped under small caps headers, lit switches, buttons that press
 * in, and each block rising in on open. Visual only — every handler, save
 * path, switch and dev tool is exactly the one it was before.
 */

interface Props {
  career: CareerState;
  /** The top HUD (ui/TopHud.tsx): energy never leaves (Harry, P86). */
  hud?: React.ReactNode;
  onBack: () => void;
  /** Back to the title screen (Continue / New Game / Load Game). */
  onExitToTitle?: () => void;
  onSkip: (target: SkipTarget) => void;
  onAddMoney: (amount: number) => void;
  /** Dev: top up the Store's Coins (lib/star/store/career.ts). */
  onAddCoins?: (amount: number) => void;
  onSetCaptain: (captain: boolean) => void;
  onSetReputation: (delta: number) => void;
  onSetFame: (delta: number) => void;
  onMaxSkills: () => void;
  onUnlockTraining?: () => void;
  onSetHappiness: (delta: number) => void;
  onSwitchClub: (club: string) => void;
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
  /** "Move my saves" (MoveSavesPanel): whose saves, and what to do once a
   *  pasted code has been written. Absent: the panel is not shown. */
  moveSaves?: { scope: string; onImported: (openSlot: number) => void };
  /** The full-screen toggle used to be a fixed floating button — reported
   *  directly as blocking the real Settings button on most phones. Moved
   *  here as a plain on/off switch instead; the actual mechanism
   *  (useImmersiveMode) still lives one level up in page.tsx so it survives
   *  navigating away from Settings, this screen just reads/flips it. */
  immersiveActive: boolean;
  onToggleImmersive: () => void;
  /** What full screen can do here (ImmersiveToggle.tsx): an iPhone gets the
   *  "Add to Home Screen" tip instead of a switch that cannot work. */
  fullscreenSupport?: FullscreenSupport;
  /** Equip a penalty run-up / a free-kick run-up you own (lib/star/runupStyles.ts). */
  onSetPenaltyRunup?: (id: PenaltyRunupId) => void;
  onSetFreeKickRunup?: (id: FreeKickRunupId) => void;
  /** Leave the career for the rest of Knowitball — the old red ✕ from the
   *  header (Harry, 28 Sep 2026: "a back out completely should be in
   *  settings"). The same handler, so it asks first and the save stays. */
  onExitCareer?: () => void;
}

/** Dev tools' colours: one per card, so the block reads as its own zone. */
const DEV = "#f59e0b";

export default function SettingsScreen({
  career, onBack, onExitToTitle, onSkip, onAddMoney, onAddCoins,
  onSetCaptain, onSetReputation, onSetFame, onMaxSkills, onUnlockTraining, onSetHappiness, onSwitchClub,
  onSetPortrait, onWatchReplay, onSaveReplay, onDeleteSavedReplay,
  onRefreshPhotos, onOpenFaceEditor, onOpenFakeFaceEditor, saves, activeSlot, onSwitchSave, onStartNewInSlot, onDeleteSave, moveSaves,
  immersiveActive, onToggleImmersive, fullscreenSupport = "native", onSetPenaltyRunup, onSetFreeKickRunup, onExitCareer, hud,
}: Props) {
  const { glow } = useClubTheme(career);
  const signing3d = useSigning3d();

  // Live scores moved to the League page's bell (v0.23.1, P61).
  // Developer info on screen (v0.15 item 24): the sub's planned minute and ladder.
  const [devOpen, setDevOpen] = useState(false);
  const [devInfo, setDevInfoState] = useState<boolean>(() => devInfoOn());
  const flipDevInfo = () => { const next = !devInfo; setDevInfoState(next); setDevInfo(next); };

  let rise = 0;
  const next = () => rise++;

  return (
    <Screen glow={glow} className="max-w-md px-3 pb-10 pt-3">
      {hud && <div className="sticky top-0 z-30 -mx-3 -mt-3 mb-2">{hud}</div>}
      <ScreenHeader
        title="Settings"
        kicker={career.player.club || undefined}
        kickerColor={tint(glow, 0.55)}
        onBack={onBack}
        backLabel="← Home"
        right={onExitToTitle && (
          <PressButton variant="secondary" size="sm" onClick={onExitToTitle} className="normal-case tracking-normal">
            ⌂ Main menu
          </PressButton>
        )}
      />

      {/* ── GAME ── small on/off switches, one line each (v0.23.1, P61: "certain
          things should be small things, like full screen and on and off"). Live
          scores live on the League page now. */}
      <RiseIn index={next()}><SetSection className="mb-1.5 mt-1">Game</SetSection></RiseIn>
      <RiseIn index={next()}>
        <GameSwitches glow={glow} fullscreen={{ support: fullscreenSupport, on: immersiveActive, onToggle: onToggleImmersive }} />
      </RiseIn>

      {/* ── YOU ── */}
      <RiseIn index={next()}><SetSection>You</SetSection></RiseIn>
      <RiseIn index={next()}>
        <SetCard tone={glow}>
          <SetHead>Photo</SetHead>
          <SetNote>Change the photograph on your graphics, or take it back off.</SetNote>
          <div className="mt-2">
            <PortraitPicker
              value={career.player.portrait}
              onChange={onSetPortrait}
              club={career.player.club}
              number={career.squadNumber}
            />
          </div>
        </SetCard>
      </RiseIn>

      {/* Moved here from the middle of Settings (Harry, 1 Oct 2026, P84: "I
          don't think the penalty run-up and three-kick run-up should be in
          your settings. It should probably be in like a play style section"). */}
      {(onSetPenaltyRunup || onSetFreeKickRunup) && <RiseIn index={next()}><SetSection>Play style</SetSection></RiseIn>}
      {(onSetPenaltyRunup || onSetFreeKickRunup) && (
        <RiseIn index={next()} className="mt-2.5">
          <SetCard tone={glow}>
            <SetHead>Penalties and free kicks</SetHead>
            <SetNote>How you run up to the ball. Looks only — the kick is the same.</SetNote>
            {onSetPenaltyRunup && (
              <RunupPicker
                title="Penalty run-up"
                styles={ownedPenaltyRunups(career.ownedAnimations)}
                current={careerPenaltyRunup(career)}
                onPick={onSetPenaltyRunup}
              />
            )}
            {onSetFreeKickRunup && (
              <RunupPicker
                title="Free-kick run-up"
                styles={ownedFreeKickRunups(career.ownedAnimations)}
                current={careerFreeKickRunup(career)}
                onPick={onSetFreeKickRunup}
              />
            )}
          </SetCard>
        </RiseIn>
      )}

      {/* ── PLAYER GRAPHICS ── */}
      <RiseIn index={next()}><SetSection>Player graphics</SetSection></RiseIn>
      <RiseIn index={next()}>
        <SetCard tone={glow}>
          <SetHead>Face editors</SetHead>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="primary" size="none" onClick={onOpenFaceEditor} className="rounded-xl py-2 text-[11px] font-black">
              Real Photos →
            </PressButton>
            <PressButton variant="accent" accent="#d946ef" size="none" onClick={onOpenFakeFaceEditor} className="rounded-xl py-2 text-[11px] font-black text-white">
              Fake Faces →
            </PressButton>
          </div>

          <SetDivider />
          <LookSwitches />

          <SetDivider />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold text-white">3D signing scene (beta)</span>
            <SegTabs
              className="w-[150px] shrink-0"
              value={signing3d ? "on" : "off"}
              onChange={(v) => setSigning3d(v === "on")}
              tabs={[["off", "Off"], ["on", "On"]] as const}
            />
          </div>
          <SetNote dim className="mt-1 text-[10px]">
            Signing a contract plays as a live 3D scene with your own player in it. This phone only.
          </SetNote>
        </SetCard>
      </RiseIn>

      {/* ── SAVES ── */}
      <RiseIn index={next()}><SetSection>Saves</SetSection></RiseIn>
      <RiseIn index={next()}>
        <SaveSlotsPanel
          saves={saves}
          activeSlot={activeSlot}
          onSwitch={onSwitchSave}
          onStartNew={onStartNewInSlot}
          onDelete={onDeleteSave}
          glow={glow}
        />
      </RiseIn>
      {moveSaves && (
        <RiseIn index={next()} className="mt-2">
          <MoveSavesPanel scope={moveSaves.scope} onImported={moveSaves.onImported} glow={glow} />
        </RiseIn>
      )}

      {/* ── DEVELOPER TOOLS ── hidden behind one button (Mikey, 28 Sep 2026:
          "the developer tools should be almost hidden… click on it and it
          shows you all of this stuff, click again to hide it"). */}
      <RiseIn index={next()} className="mt-6">
        <button
          onClick={() => setDevOpen(o => !o)}
          aria-expanded={devOpen}
          className="kib-press flex w-full items-center justify-between rounded-xl border-2 border-dashed px-3 py-2.5 text-left"
          style={{ borderColor: DEV, background: "rgba(0,0,0,.25)" }}
        >
          <span className="text-[13px] font-black text-white">🛠 Developer tools</span>
          <span className="text-[11px] font-black text-white">{devOpen ? "Hide ▴" : "Show ▾"}</span>
        </button>
      </RiseIn>
      {devOpen && (<>
      <p className="mt-2 px-0.5 text-[11px] font-semibold text-white">Testing and tuning options — not needed for normal play.</p>

      <RiseIn index={next()} className="mt-2">
        <SetCard tone={DEV} strength={0.18}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black text-white">Show developer info</div>
              <SetNote className="mt-0.5">On the match-day card: the minute a sub is planned to come on, and his ladder.</SetNote>
            </div>
            <Switch on={devInfo} onClick={flipDevInfo} label="Show developer info" />
          </div>
        </SetCard>
      </RiseIn>

      <RiseIn index={next()}><DevSkipPanel career={career} onSkip={onSkip} /></RiseIn>

      <RiseIn index={next()}><DevMoneyPanel career={career} onAddMoney={onAddMoney} onAddCoins={onAddCoins} /></RiseIn>

      <RiseIn index={next()}>
        <DevCareerPanel
          career={career}
          onSetCaptain={onSetCaptain}
          onSetReputation={onSetReputation}
          onSetFame={onSetFame}
          onMaxSkills={onMaxSkills}
          onUnlockTraining={onUnlockTraining}
          onSetHappiness={onSetHappiness}
          onSwitchClub={onSwitchClub}
        />
      </RiseIn>

      <RiseIn index={next()}><RefreshPhotosPanel onRefresh={onRefreshPhotos} /></RiseIn>

      <GoalReplaysPanel
        career={career}
        onWatchReplay={onWatchReplay}
        onSaveReplay={onSaveReplay}
        onDeleteSavedReplay={onDeleteSavedReplay}
      />

      </>)}

      {onExitCareer && (
        <RiseIn index={next()} className="mb-2 mt-6">
          <PressButton
            data-exit-career
            variant="danger"
            size="none"
            onClick={onExitCareer}
            className="w-full rounded-xl py-3 text-sm font-black"
          >
            Exit career — back to Knowitball
          </PressButton>
          <p className="mt-1.5 text-center text-[10px] font-semibold text-white">
            Your career stays saved. You come back to exactly this.
          </p>
        </RiseIn>
      )}
    </Screen>
  );
}

/** One set of run-ups (penalties, or free kicks): the ones you own, the equipped one lit. */
function RunupPicker<Id extends RunupId>({ title, styles, current, onPick }: {
  title: string;
  styles: RunupStyle<Id>[];
  current: Id;
  onPick: (id: Id) => void;
}) {
  return (
    <div className="mt-2.5">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {styles.map((r) => {
          const on = current === r.id;
          return (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              title={r.blurb}
              className={`kib-press rounded-lg px-2.5 py-1.5 text-[11px] font-black ${on ? "text-white" : "text-white/80"}`}
              style={on
                ? { background: "linear-gradient(180deg, #4ade80, #10b981 55%, #047857)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 4px 12px -5px rgba(16,185,129,.8)" }
                : { background: "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.03))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.08)" }}
            >
              {on && "✓ "}{r.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
