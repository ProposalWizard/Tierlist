"use client";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import { PressButton, Pop } from "@/components/star/legacy/ui";
import { SetCard, SetHead, SetNote } from "@/components/star/legacy/settingsKit";

/**
 * DEV CAREER — a testing tool, not a gameplay mechanic.
 *
 * Requested directly: "add everything that could affect testing but requires
 * playing the game and takes time to dev tools so the admin user can cheat
 * to test quicker (becoming captain, getting money (already done), getting
 * reputation, fame, stats from training, lifestyle, the club you're at,
 * etc)." Same unguarded "developers and admins" spirit as `DevSkipPanel`/
 * `DevMoneyPanel` right above this on the same screen — no login role or
 * feature flag gates any of them.
 *
 * Club changes go through the real `attachClub` (careerFlow.ts) rather than
 * hand-writing `career.player.club` — that function also handles the
 * contract, the first-signing achievement and the garden-weeks bookkeeping,
 * so a dev-cheated club change leaves the save in exactly the shape a real
 * transfer would.
 *
 * Reskinned 28 Sep 2026 (the home screen's look): a violet-lit card, each
 * stat in its own glass tile with its number popping when it changes, kit
 * buttons. Every handler and every number is unchanged.
 */

const SKILL_KEYS = ["pace", "power", "technique", "vision", "freeKick"] as const;
const TONE = "#a78bfa";

function Tile({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="kit-row rounded-xl p-2">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-bold text-white">{label}</span>
        <span className="text-[13px] font-black tabular-nums text-white">{value}</span>
      </div>
      {children}
    </div>
  );
}

export default function DevCareerPanel({
  career, onSetCaptain, onSetReputation, onSetFame, onMaxSkills, onUnlockTraining, onSetHappiness, onSwitchClub,
}: {
  career: CareerState;
  onSetCaptain: (captain: boolean) => void;
  onSetReputation: (delta: number) => void;
  onSetFame: (delta: number) => void;
  onMaxSkills: () => void;
  /** Every training level open (one star each), so any level can be tested. */
  onUnlockTraining?: () => void;
  onSetHappiness: (delta: number) => void;
  onSwitchClub: (club: string) => void;
}) {
  const clubOptions = career.league.map(t => t.name).filter(n => n !== career.player.club);
  const skills = SKILL_KEYS.map(k => career.skills[k]).join("/");

  return (
    <SetCard tone={TONE} strength={0.22} className="mt-2.5 p-3">
      <SetHead tone={TONE}>Dev — Career</SetHead>
      <SetNote>Skip the grind for testing captaincy, boardroom powers, training gains or a club move.</SetNote>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-white/85">
          Captain: <span className={career.captain ? "text-emerald-400" : "text-white"}>
            {career.captain ? "Yes" : "No"}
          </span>
        </span>
        <PressButton
          variant="gold"
          size="none"
          onClick={() => onSetCaptain(!career.captain)}
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black"
        >
          {career.captain ? "Remove captaincy" : "Make captain"}
        </PressButton>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Tile label="Reputation" value={<Pop value={career.reputation}>{career.reputation}</Pop>}>
          <div className="mt-1 flex gap-1">
            <PressButton variant="accent" accent="#38bdf8" size="none" onClick={() => onSetReputation(25)} className="flex-1 rounded-md py-1 text-[10px] font-black text-white">+25</PressButton>
            <PressButton variant="accent" accent="#38bdf8" size="none" onClick={() => onSetReputation(100)} className="flex-1 rounded-md py-1 text-[10px] font-black text-white">Max</PressButton>
          </div>
        </Tile>
        <Tile label="Fame" value={<Pop value={career.fame}>{career.fame}</Pop>}>
          <div className="mt-1 flex gap-1">
            <PressButton variant="accent" accent="#d946ef" size="none" onClick={() => onSetFame(10)} className="flex-1 rounded-md py-1 text-[10px] font-black text-white">+10</PressButton>
            <PressButton variant="accent" accent="#d946ef" size="none" onClick={() => onSetFame(100)} className="flex-1 rounded-md py-1 text-[10px] font-black text-white">Max</PressButton>
          </div>
        </Tile>
        <Tile label="Happiness" value={<Pop value={career.happiness}>{career.happiness}</Pop>}>
          <div className="mt-1 flex gap-1">
            <PressButton variant="accent" accent="#f43f5e" size="none" onClick={() => onSetHappiness(25)} className="flex-1 rounded-md py-1 text-[10px] font-black text-white">+25</PressButton>
            <PressButton variant="accent" accent="#f43f5e" size="none" onClick={() => onSetHappiness(100)} className="flex-1 rounded-md py-1 text-[10px] font-black text-white">Max</PressButton>
          </div>
        </Tile>
        <div className="kit-row rounded-xl p-2">
          <div className="text-[10px] font-bold text-white">
            Skills (<Pop value={skills} className="inline-block font-black tabular-nums text-white">{skills}</Pop>)
          </div>
          <PressButton
            variant="primary"
            size="none"
            onClick={onMaxSkills}
            className="mt-1 w-full rounded-md py-1 text-[10px] font-black"
          >
            Max all to 99
          </PressButton>
          {onUnlockTraining && (
            <PressButton
              variant="accent"
              accent="#d97706"
              size="none"
              onClick={onUnlockTraining}
              className="mt-1 w-full rounded-md py-1 text-[10px] font-black text-white"
            >
              Unlock all 30 training levels (1★ each)
            </PressButton>
          )}
        </div>
      </div>

      {clubOptions.length > 0 && (
        <div className="kit-row mt-2 rounded-xl p-2">
          <div className="text-[10px] font-bold text-white">
            Club: <span className="font-black text-white">{career.player.club}</span> — instantly attach elsewhere in this division
          </div>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) { onSwitchClub(e.target.value); e.target.value = ""; } }}
            className="kit-input mt-1 w-full rounded-lg px-2 py-1.5 text-[11px] text-white"
          >
            <option value="" disabled>Move to…</option>
            {clubOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </SetCard>
  );
}
