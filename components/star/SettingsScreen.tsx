"use client";
import { useState } from "react";
import { useIsTester } from "@/lib/useIsAdmin";
import type { CareerState, GoalReplay } from "@/lib/star/types";
import type { SkipTarget } from "@/lib/star/devSkip";
import type { SaveSlotSummary } from "@/lib/star/storage";
import { devInfoOn, setDevInfo } from "@/lib/star/matchDayPrefs";
import { SettingsTop, SettingsGroups } from "./DeviceSettings";
import type { FullscreenSupport } from "./ImmersiveToggle";
import DevSkipPanel from "./DevSkipPanel";
import DevMoneyPanel from "./DevMoneyPanel";
import DevCareerPanel from "./DevCareerPanel";
import DevSquadPanel from "./DevSquadPanel";
import type { CareerDivision } from "@/lib/star/calendar";
import type { PlayerSearchHit } from "@/lib/star/devTeam";
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
import { SetCard, SetHead, SetNote, Switch } from "./settingsKit";

/**
 * SETTINGS — reskinned 28 Sep 2026 to the home screen's look (Harry: "all
 * the pages should just be reskinned to fit the new home screen vibe"):
 * the night-stadium backdrop lit in your club's colour, club-lit glass
 * cards grouped under small caps headers, lit switches, buttons that press
 * in, and each block rising in on open. Visual only — every handler, save
 * path, switch and dev tool is exactly the one it was before.
 *
 * 8 Oct 2026 (Harry picked the "hybrid"): Version on top (Classic |
 * Standard | Preview), the four quick switches, then folded groups — Match,
 * 3D world, Screens, Career & saves. Developer tools are their own tab,
 * testers and admins only. The rows live in DeviceSettings.tsx.
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
  /** Dev — move to any English club / add, remove and pin squad players (lib/star/devTeam.ts). */
  devTeam?: {
    onMoveToClub: (division: CareerDivision, club: string) => void;
    onAddPlayer: (hit: PlayerSearchHit, start: boolean) => void;
    onRemovePlayer: (id: string) => void;
    onSetPlayerStart: (id: string, start: boolean) => void;
  };
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
  onSetCaptain, onSetReputation, onSetFame, onMaxSkills, onUnlockTraining, onSetHappiness, onSwitchClub, devTeam,
  onSetPortrait, onWatchReplay, onSaveReplay, onDeleteSavedReplay,
  onRefreshPhotos, onOpenFaceEditor, onOpenFakeFaceEditor, saves, activeSlot, onSwitchSave, onStartNewInSlot, onDeleteSave, moveSaves,
  immersiveActive, onToggleImmersive, fullscreenSupport = "native", onSetPenaltyRunup, onSetFreeKickRunup, onExitCareer, hud,
}: Props) {
  const { glow } = useClubTheme(career);

  // Developer tools sit in their own tab, shown only to testers and admins
  // (Harry, 8 Oct 2026, the hybrid Settings). Goal Replays inside stays
  // admin-only: it checks for itself.
  const isTester = useIsTester();
  const [tab, setTab] = useState<"settings" | "dev">("settings");
  const showDev = isTester && tab === "dev";
  // Developer info on screen (v0.15 item 24): the sub's planned minute and ladder.
  const [devInfo, setDevInfoState] = useState<boolean>(() => devInfoOn());
  const flipDevInfo = () => { const next = !devInfo; setDevInfoState(next); setDevInfo(next); };

  let rise = 0;
  const next = () => rise++;

  // ── Career & saves: only here, inside a career ──
  const careerAndSaves = (
    <>
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

      {(onSetPenaltyRunup || onSetFreeKickRunup) && (
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
      )}

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
      </SetCard>

      <SaveSlotsPanel
        saves={saves}
        activeSlot={activeSlot}
        onSwitch={onSwitchSave}
        onStartNew={onStartNewInSlot}
        onDelete={onDeleteSave}
        glow={glow}
      />
      {moveSaves && <MoveSavesPanel scope={moveSaves.scope} onImported={moveSaves.onImported} glow={glow} />}

      {onExitCareer && (
        <div className="pt-2">
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
        </div>
      )}
    </>
  );

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

      {isTester && (
        <RiseIn index={next()}>
          <SegTabs className="mb-1" value={tab} onChange={setTab} tabs={[["settings", "Settings"], ["dev", "🛠 Developer"]] as const} />
        </RiseIn>
      )}

      {!showDev && (<>
        <RiseIn index={next()}>
          <SettingsTop glow={glow} fullscreen={{ support: fullscreenSupport, on: immersiveActive, onToggle: onToggleImmersive }} />
        </RiseIn>
        <RiseIn index={next()}>
          <SettingsGroups
            glow={glow}
            extra={[{ id: "career", title: "Career & saves", sub: "Photo, run-ups, face editors, saves, exit", content: careerAndSaves }]}
          />
        </RiseIn>
        {/* A save a cheat has touched (lib/star/godMode.ts). Shown to everyone. */}
        {career.usedGodMode && (
          <RiseIn index={next()} className="mt-6">
            <p data-tester-save className="rounded-lg border px-3 py-2 text-[11px] font-bold text-white" style={{ borderColor: DEV, background: "rgba(245,158,11,.12)" }}>
              🧪 Tester save — developer tools have been used on this career.
            </p>
          </RiseIn>
        )}
      </>)}

      {/* ── DEVELOPER ── testers and admins only (Harry, 5 Oct 2026: "lock
          the doors", then tester access; 8 Oct 2026: its own tab). */}
      {showDev && (<>
      <p className="mt-2 px-0.5 text-[11px] font-semibold text-white">Testing and tuning options — not needed for normal play. A save that uses them is marked as a tester save.</p>

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
          onMoveToClub={devTeam?.onMoveToClub}
        />
      </RiseIn>

      {devTeam && (
        <RiseIn index={next()}>
          <DevSquadPanel
            career={career}
            onAddPlayer={devTeam.onAddPlayer}
            onRemovePlayer={devTeam.onRemovePlayer}
            onSetPlayerStart={devTeam.onSetPlayerStart}
          />
        </RiseIn>
      )}

      <RiseIn index={next()}><RefreshPhotosPanel onRefresh={onRefreshPhotos} /></RiseIn>

      <GoalReplaysPanel
        career={career}
        onWatchReplay={onWatchReplay}
        onSaveReplay={onSaveReplay}
        onDeleteSavedReplay={onDeleteSavedReplay}
      />
      </>)}
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
