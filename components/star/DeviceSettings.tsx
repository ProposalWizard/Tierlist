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
import { useCam2dSwipe, setCam2dSwipeOn } from "@/lib/star/cam2dSwipe";
import Quality3dRow from "./Quality3dRow";

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

/** The first screen's switches: full screen, sound, 3D quality, skip the line-up. */
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
      <SetToggle label="Skip the line-up" on={skipLineup} onClick={flipSkipLineup} last />
    </SetCard>
  );
}

/** The v0.15 gameplay round's switches: Old by default, "All new" = how the round finished. */
const V015_ROWS: LookRowId[] = ["keeperPro", "shotsPro", "knucklePower", "ballPhysics", "matchFlow", "matchRadar"];

/** One New | Old row. A dot marks a row you changed by hand. */
function LookRow({ id, tabs, note, look }: {
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

const NEW_OLD = [["new", "New"], ["old", "Old"]] as const;

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
      {/* Leo, 12 Oct 2026: every new thing from the v0.15 gameplay round in one place,
          Old by default; "All new" = the game exactly as that round finished. */}
      <div className="my-2 border-2 border-amber-400/70 bg-amber-400/10 px-3 py-3" data-new-round="v0.15">
        <p className="text-[13px] font-black uppercase tracking-wider text-amber-300">New in v0.15 · testing</p>
        <p className="mt-1 text-[12px] font-bold text-white">All start on Old (the game as before). All new = the game exactly as the v0.15 round finished.</p>
        <div className="mt-2 flex gap-2">
          <button className="flex-1 border-2 border-amber-300 bg-amber-400 px-2 py-1.5 text-[12px] font-black uppercase text-gray-950" data-new-round-all="new"
            onClick={() => { for (const id of V015_ROWS) setLookRow(id, "new"); }}>All new</button>
          <button className="flex-1 border-2 border-white/40 px-2 py-1.5 text-[12px] font-black uppercase text-white" data-new-round-all="old"
            onClick={() => { for (const id of V015_ROWS) setLookRow(id, "old"); }}>All old</button>
        </div>
        <LookRow id="keeperPro" look={look} tabs={NEW_OLD} note={gp("keeperPro")} />
        <LookRow id="shotsPro" look={look} tabs={NEW_OLD} note={gp("shotsPro")} />
        <LookRow id="knucklePower" look={look} tabs={NEW_OLD} note={gp("knucklePower")} />
        <LookRow id="ballPhysics" look={look} tabs={NEW_OLD} note={gp("ballPhysics")} />
        <LookRow id="matchFlow" look={look} tabs={NEW_OLD} note={gp("matchFlow")} />
        <LookRow id="matchRadar" look={look} tabs={NEW_OLD} note="New: a live mini-pitch above the commentary between your chances. Old: the commentary on its own." />
      </div>
      <LookRow id="keepers" look={look} tabs={NEW_OLD} note={gp("keepers")} />
      <LookRow id="matchFeel" look={look} tabs={NEW_OLD} note="New: every hit is felt: a wind-up, a short freeze at the contact, a flash, a deeper kick sound and a buzz, all bigger the harder you hit it. Thuds on landing, the net bulging, a clang off the post, keeper hops and dives. Old: as before." />
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

/** The 2D match camera (lib/star/cam2dSwipe.ts): the swipe camera, off by default. */
function Match2dCamGroup() {
  const on = useCam2dSwipe();
  return (
    <>
      <SetToggle label="Swipe camera" on={on} onClick={() => setCam2dSwipeOn(!on)} last />
      <p className="px-3 pb-2 text-[11px] text-white/70">On: in the 2D match, swipe up or down on open grass to lean the camera, double tap to put it back, and the video-camera button to lock your angle. A drag from the ball always kicks.</p>
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
    { id: "match", title: "Match", sub: "Keepers, testing (v0.15), 2D or 3D, names", count: 9, content: <MatchGroup />, card: true },
    { id: "world", title: "3D match camera", sub: "Zoom and camera height", count: 2, content: <World3dGroup />, card: true },
    { id: "cam2d", title: "2D match camera", sub: "Swipe camera (off by default)", count: 1, content: <Match2dCamGroup />, card: true },
    { id: "screens", title: "Screens", sub: "Old UI or New UI", count: 1, content: <ScreensGroup />, card: true },
    ...extra,
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
