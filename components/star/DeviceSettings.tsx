"use client";
import { useCamZoom, setCamZoom, useCamHeightTest, setCamHeightTest, ZOOM_MIN, ZOOM_MAX, HEIGHT_TEST_MIN, HEIGHT_TEST_MAX } from "@/lib/star/style3d/camZoom";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useSfxOn, setSfxOn, sfx } from "@/lib/star/sfx";
import { getSkipLineup, setSkipLineup } from "@/lib/star/lineupPrefs";
import { loadFaceStyle, saveFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { useMatchView3d, setMatchView3d } from "@/lib/star/matchView3d";
import { GAMEPLAY_SWITCHES, type GameplaySwitch } from "@/lib/star/gameplayVersion";
import { LOOK_ROWS, changedFromDefault, setLookRow, useLook, type LookRowId } from "@/lib/star/lookRows";
import type { FullscreenSupport } from "./ImmersiveToggle";
import { SegTabs } from "./screenKit";
import { SetCard, SetNote, SetSection, SetToggle } from "./settingsKit";
import Quality3dRow from "./Quality3dRow";
import FhrSwitchRow from "./FhrSwitchRow";
import DataCredits, { DATA_CREDIT_SOURCES } from "./DataCredits";

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


// ── SETTINGS (Harry, 8 Oct 2026; trimmed 12 Oct 2026) ──────────────────
//
//   Quick     full screen, sound, 3D quality, skip the line-up.
//   Groups    folded: Match, 3D match camera, Screens, then the screen's own
//             (Career & saves, or Saves on the title). One open at a time.
// 12 Oct 2026: every settled look lost its row ("decide things and be done
// with it"), and the Version picker (Classic | Standard) went with the cut-
// scene rows ("the new cut scenes will be staying"). See CLAUDE.md →
// "Decided, no toggle".

/** The first screen's switches: full screen, sound, 3D quality, skip the line-up, Full highlights rebuild. */
export function QuickSwitches({ glow, fullscreen }: {
  glow: string;
  fullscreen: { support: FullscreenSupport; on: boolean; onToggle: () => void };
}) {
  const sfxNow = useSfxOn();
  const [skipLineup, setSkipLineupState] = useState(() => getSkipLineup());
  const flipSkipLineup = () => { const next = !skipLineup; setSkipLineupState(next); setSkipLineup(next); };
  return (
    <SetCard tone={glow} className="px-3 py-1">
      <FullScreenRow support={fullscreen.support} on={fullscreen.on} onToggle={fullscreen.onToggle} />
      <SetToggle label="Sound effects" on={sfxNow} onClick={() => { const on = !sfxNow; setSfxOn(on); if (on) sfx("ui-confirm"); }} />
      <div className="border-b border-white/10 py-2.5"><Quality3dRow /></div>
      <SetToggle label="Skip the line-up" on={skipLineup} onClick={flipSkipLineup} />
      {/* Harry, 20 Oct 2026: a toggle with a "?", on the first screen (also in the match's ⚙ and before kick-off). */}
      <div className="py-2.5"><FhrSwitchRow /></div>
    </SetCard>
  );
}

/** One New | Old row. A dot marks a row you changed by hand. */
export function LookRow({ id, tabs, note, look }: {
  id: LookRowId;
  tabs: readonly (readonly [string, string])[];
  note?: React.ReactNode;
  look: Record<LookRowId, string>;
}) {
  const changed = changedFromDefault(id, look);
  return (
    <div className="border-b border-white/10 py-2 last:border-b-0" data-look-row={id}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold leading-tight text-white">
          {changed && <span aria-label="changed by you" className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />}
          {LOOK_ROWS[id].label}
        </span>
        <SegTabs className="w-[150px] shrink-0" value={look[id]} onChange={(v) => setLookRow(id, v)} tabs={tabs} />
      </div>
      {note && <SetNote dim className="mt-1 text-[10px]">{note}</SetNote>}
    </div>
  );
}

export const NEW_OLD = [["new", "New"], ["old", "Old"]] as const;

/** A preference row with its own tabs (not part of any version). */
function PrefRow({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="border-b border-white/10 py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold leading-tight text-white">{label}</span>
        {children}
      </div>
      {note && <SetNote dim className="mt-1 text-[10px]">{note}</SetNote>}
    </div>
  );
}

/** Match: the v0.15 test box, 2D or 3D, names above heads. */
function MatchGroup() {
  const look = useLook();
  const view3d = useMatchView3d();
  const [faceStyle, setFaceStyle] = useState<FaceStyle>(loadFaceStyle);
  const flipNames = () => {
    const next = { ...faceStyle, namesEnabled: !faceStyle.namesEnabled };
    setFaceStyle(next);
    saveFaceStyle(next);
  };
  const gp = (k: GameplaySwitch) => (look[k as LookRowId] === "new" ? GAMEPLAY_SWITCHES[k].newText : GAMEPLAY_SWITCHES[k].oldText);
  return (
    <>
      {/* Every New | Old update switch lives in Settings → Updates (Leo, 14 Oct 2026). */}
      <LookRow id="keepers" look={look} tabs={NEW_OLD} note={gp("keepers")} />
      {/* Leo, 14 Oct 2026 (round 16): default New. Also in Settings → Updates. */}
      <LookRow id="keeperFinish" look={look} tabs={NEW_OLD} note={gp("keeperFinish")} />
      {/* Mikey, 20 Oct 2026: asked for as a toggle by name. Also in Settings → Updates. */}
      <LookRow id="mikeyPopups" look={look} tabs={NEW_OLD} note="New: a scoreboard for every goal (score rolls over, scorer and assist) and TV captions for everything else. Old: as before." />
      <PrefRow label="Match view 3D" note="On: your match drawn in 3D, in a full stadium. The football is the same; only the picture changes.">
        <SegTabs className="w-[150px] shrink-0" value={view3d} onChange={(v) => setMatchView3d(v)} tabs={[["on", "On"], ["off", "Off"]] as const} />
      </PrefRow>
      <SetToggle label="Player names" on={faceStyle.namesEnabled} onClick={flipNames} last />
    </>
  );
}

/** The 3D match camera: zoom, and the height test. (Cut scenes: decided New, no row.) */
function World3dGroup() {
  const zoom = useCamZoom();
  const camH = useCamHeightTest();
  return (
    <>
      <PrefRow label="3D match zoom" note="Closer or further out. On a phone, pinch with two fingers in the match. Players stay the same size: only the camera moves. All the way out shows the whole chance.">
        <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.05} value={zoom} onChange={(e) => setCamZoom(Number(e.target.value))} className="w-[150px] shrink-0 accent-amber-400" aria-label="3D match zoom" data-cam-zoom />
      </PrefRow>
      <PrefRow label="3D camera height (test)" note={`Testing only. Raises or lowers the 3D match camera (${camH > 0 ? "+" : ""}${camH}°). Leave at 0.`}>
        <input type="range" min={HEIGHT_TEST_MIN} max={HEIGHT_TEST_MAX} step={1} value={camH} onChange={(e) => setCamHeightTest(Number(e.target.value))} className="w-[150px] shrink-0 accent-amber-400" aria-label="3D camera height (test)" data-cam-height-test />
      </PrefRow>
    </>
  );
}

/** Screens: Old UI or New UI. */
function ScreensGroup() {
  const look = useLook();
  return <LookRow id="ui" look={look} tabs={NEW_OLD} note="Old: the game as it was before v0.23, kept as a backup. Same save." />;
}

export interface ExtraGroup {
  id: string;
  title: string;
  sub: string;
  count?: number;
  /** Rendered under the open header, outside a card (it brings its own). */
  content: React.ReactNode;
}

/**
 * The folded groups. One open at a time; opening one scrolls it to the top.
 * `inMatch`: the ⚙ sheet over a match shows only what matters mid-game (the
 * Match group, open), never the cut scenes, the UI or the career's own things.
 */
export function SettingsGroups({ glow, extra = [], inMatch = false }: { glow: string; extra?: ExtraGroup[]; inMatch?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (open) refs.current[open]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [open]);
  if (inMatch) {
    return (
      <SetCard tone={glow} className="px-3 pb-1" data-group="match">
        <MatchGroup />
      </SetCard>
    );
  }
  const groups: (ExtraGroup & { card?: boolean })[] = [
    { id: "match", title: "Match", sub: "Keepers, 2D or 3D, names", count: 3, content: <MatchGroup />, card: true },
    { id: "world", title: "3D match camera", sub: "Zoom and camera height", count: 2, content: <World3dGroup />, card: true },
    { id: "screens", title: "Screens", sub: "Old UI or New UI", count: 1, content: <ScreensGroup />, card: true },
    ...extra,
    // Harry, 20 Oct 2026: the free data's credit lines live in Settings (components/star/DataCredits.tsx).
    { id: "credits", title: "Data credits", sub: "Where the real football data comes from", count: DATA_CREDIT_SOURCES, content: <DataCredits />, card: true },
  ];
  return (
    <>
      <SetSection>More</SetSection>
      <div className="space-y-2">
        {groups.map((g) => {
          const isOpen = open === g.id;
          return (
            <div key={g.id} ref={(el) => { refs.current[g.id] = el; }} style={{ scrollMarginTop: 112 }} data-group={g.id}>
              <SetCard tone={glow} className="p-0">
                <button
                  onClick={() => setOpen(isOpen ? null : g.id)}
                  aria-expanded={isOpen}
                  className="kib-press flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-black leading-tight text-white">{g.title}</span>
                    <span className="block truncate text-[11px] font-semibold text-white/85">{g.sub}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-black text-emerald-300">
                    {g.count ? `${g.count} ` : ""}{isOpen ? "▾" : "▸"}
                  </span>
                </button>
                {isOpen && g.card && <div className="border-t border-white/10 px-3 pb-1">{g.content}</div>}
              </SetCard>
              {isOpen && !g.card && <div className="mt-2 space-y-2">{g.content}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The quick switches: the first screen of both Settings pages. */
export function SettingsTop({ glow, fullscreen }: {
  glow: string;
  fullscreen: { support: FullscreenSupport; on: boolean; onToggle: () => void };
}) {
  return (
    <>
      <SetSection className="mb-1.5 mt-1">Quick</SetSection>
      <QuickSwitches glow={glow} fullscreen={fullscreen} />
    </>
  );
}
