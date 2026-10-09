"use client";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useSfxOn, setSfxOn, sfx } from "@/lib/star/sfx";
import { getPostMatchReactionsEnabled, setPostMatchReactionsEnabled } from "@/lib/star/postMatchPrefs";
import { getSkipLineup, setSkipLineup } from "@/lib/star/lineupPrefs";
import { loadFaceStyle, saveFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { useCameraTilt, setCameraTilt, type CameraTilt } from "@/lib/star/cameraTilt";
import { useYouInOpenPlay, setYouInOpenPlay } from "@/lib/star/newLook";
import { GAMEPLAY_SWITCHES, type GameplaySwitch } from "@/lib/star/gameplayVersion";
import {
  GAME_VERSIONS, GAME_VERSION_LABEL, LOOK_ROW_IDS, VERSION_PRESETS,
  applyGameVersion, gameVersionOf, setLookRow, useLook, type LookRowId,
} from "@/lib/star/gameVersions";
import { useIsTester } from "@/lib/useIsAdmin";
import type { FullscreenSupport } from "./ImmersiveToggle";
import { SegTabs } from "./screenKit";
import { SetCard, SetNote, SetSection, SetToggle } from "./settingsKit";
import Quality3dRow from "./Quality3dRow";
import { useControlChoice, setControlChoice, detectScheme, type ControlChoice } from "@/lib/star/play3d/controlScheme";

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


// ── THE HYBRID SETTINGS (Harry, 8 Oct 2026) ─────────────────────────────
//
//   Version   Classic | Standard | Preview — one tap sets every New | Old
//             switch (lib/star/gameVersions.ts). "Custom" once one is
//             changed by hand.
//   Quick     full screen, sound, 3D quality, skip the line-up.
//   Groups    folded: Match, 3D world, Screens, then the screen's own
//             (Career & saves, or Saves on the title). One open at a time.
// Every row is still stored on this phone only; saves are never touched.

/** The Version card: three versions, and how far this phone is from them. */
export function VersionCard({ glow }: { glow: string }) {
  const look = useLook();
  const state = gameVersionOf(look);
  const nearest = GAME_VERSION_LABEL[state.nearest];
  return (
    <SetCard tone={glow} className="px-3 py-2.5" data-version-card>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[15px] font-black leading-tight text-white">Version</div>
        <div className="text-[11px] font-semibold leading-tight text-white/85">Sets all {LOOK_ROW_IDS.length} look and gameplay switches</div>
      </div>
      <div className="mt-2">
        <div className="grid grid-cols-3 gap-0.5 rounded-xl bg-black/30 p-1" style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }} role="radiogroup" aria-label="Version">
          {GAME_VERSIONS.map((v) => {
            const on = state.version === v;
            return (
              <button
                key={v}
                role="radio"
                aria-checked={on}
                data-version={v}
                onClick={() => applyGameVersion(v)}
                className={`kib-press relative rounded-lg px-1.5 py-1.5 text-[10px] font-black uppercase tracking-wide min-[380px]:text-[11px] ${on ? "bg-white/15 text-white" : "text-white/55"}`}
                style={on ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), 0 2px 6px rgba(0,0,0,.35)" } : undefined}
              >
                {GAME_VERSION_LABEL[v]}
                {on && <span className="absolute inset-x-2 -bottom-[3px] h-[3px] rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,.8)" }} />}
              </button>
            );
          })}
        </div>
      </div>
      {state.version === "custom" ? (
        <p className="mt-2 text-[12px] font-black text-amber-300" data-version-state="custom">
          ● Custom · {nearest} + {state.changes} change{state.changes === 1 ? "" : "s"} ·{" "}
          <button onClick={() => applyGameVersion(state.nearest)} className="kib-press underline">Undo</button>
        </p>
      ) : (
        <p className="mt-2 text-[12px] font-black text-emerald-300" data-version-state={state.version}>
          ✓ {nearest}, no changes of your own
        </p>
      )}
    </SetCard>
  );
}

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

/** One New | Old row. A dot marks a row you changed by hand. */
function LookRow({ id, tabs, note, look }: {
  id: LookRowId;
  tabs: readonly (readonly [string, string])[];
  note?: React.ReactNode;
  look: Record<LookRowId, string>;
}) {
  const state = gameVersionOf(look);
  const changed = state.version === "custom" && look[id] !== VERSION_PRESETS[state.nearest][id];
  const label = id in GAMEPLAY_SWITCHES ? GAMEPLAY_SWITCHES[id as GameplaySwitch].label : ROW_LABEL[id];
  return (
    <div className="border-b border-white/10 py-2 last:border-b-0" data-look-row={id}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold leading-tight text-white">
          {changed && <span aria-label="changed by you" className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />}
          {label}
        </span>
        <SegTabs className="w-[150px] shrink-0" value={look[id]} onChange={(v) => setLookRow(id, v)} tabs={tabs} />
      </div>
      {note && <SetNote dim className="mt-1 text-[10px]">{note}</SetNote>}
    </div>
  );
}

const ROW_LABEL: Record<LookRowId, string> = {
  matchView: "Match view", chanceFraming: "Chance framing", matchView3d: "Match view 3D", matchPlayers: "Players in the match", ball: "Ball", chances: "Chances",
  animations: "Animations", keepers: "Keepers", dribble: "Dribble runs", dribble3d: "Dribble runs 3D", clearances: "Clearances", chanceMix: "Chance mix (testing)", kaneDrawings: "Kane drawings (testing)",
  garden: "3D garden", look3d: "3D look", shopPlayer: "3D shop player", people3d: "3D people", humanBody: "3D body", cutscenePeople: "Cut-scene people", motion: "Motion", camera3d: "3D camera", playerLight3d: "3D player light", bossRoom: "Talk to your manager",
  casino: "Casino", casinoLook: "Casino look", signing: "Signing scene", ui: "UI", badges: "Club badges", allSeasons: "All seasons page",
  ovation: "Standing ovation", ovationMoves: "Ovation greetings", drawnStyle: "Drawn-player style",
};

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

/** Match: the view, its look, the chances, animations, gameplay, faces, names, reactions. */
function MatchGroup() {
  const look = useLook();
  const tilt = useCameraTilt();
  const you = useYouInOpenPlay();
  const tester = useIsTester();
  const [postMatch, setPostMatch] = useState(() => getPostMatchReactionsEnabled());
  const flipPostMatch = () => { const next = !postMatch; setPostMatch(next); setPostMatchReactionsEnabled(next); };
  const [faceStyle, setFaceStyle] = useState<FaceStyle>(loadFaceStyle);
  const flipFace = (key: "facesEnabled" | "namesEnabled") => {
    const next = { ...faceStyle, [key]: !faceStyle[key] };
    setFaceStyle(next);
    saveFaceStyle(next);
  };
  const gp = (k: GameplaySwitch) => (look[k] === "new" ? GAMEPLAY_SWITCHES[k].newText : GAMEPLAY_SWITCHES[k].oldText);
  return (
    <>
      <LookRow id="matchView" look={look} tabs={[["new", "New"], ["classic", "Classic"]]} note="New: zoomed out, the pitch fills the screen. Classic: the close-up view." />
      <LookRow id="chanceFraming" look={look} tabs={[["zoom", "Zoom"], ["old", "Old"]]} note="New view only. Zoom: the camera moves in on the play, less empty grass. Nobody is cut off; the players and the drag are the same. Corners stay as they are." />
      <PrefRow label="Camera angle" note="New view only. Tipped back (corners and crosses stay flat); Flat is straight down.">
        <SegTabs className="w-[150px] shrink-0" value={String(tilt) as "20" | "30" | "0"} onChange={(v) => setCameraTilt(Number(v) as CameraTilt)} tabs={[["20", "20°"], ["30", "30°"], ["0", "Flat"]] as const} />
      </PrefRow>
      <LookRow id="matchView3d" look={look} tabs={[["on", "On"], ["off", "Off"]]} note="Being tested. On: your match drawn in 3D, in a full stadium. The football is the same; only the picture changes." />
      <LookRow id="matchPlayers" look={look} tabs={[["3d", "3D"], ["drawn", "Drawn"]]} note="New view only." />
      <LookRow id="ball" look={look} tabs={[["new", "New"], ["classic", "Classic"]]} note="New view only." />
      <PrefRow label="Your player in open play" note="New view only. Hidden: the ball is you; you still take penalties, free kicks and corners.">
        <SegTabs className="w-[150px] shrink-0" value={you} onChange={setYouInOpenPlay} tabs={[["hidden", "Hidden"], ["shown", "Shown"]] as const} />
      </PrefRow>
      <LookRow id="chances" look={look} tabs={[["new", "New"], ["classic", "Classic"]]} note="Classic: your drawn chances. New (being tested): about 100 pictures of each chance with both full teams." />
      <LookRow id="animations" look={look} tabs={NEW_OLD} note={<>New (being tested): whoever touches the ball is seen doing it — shots, passes, headers, blocks, the keeper&apos;s catch and fumble.{tester && <> <a href="/star-animations-dev" className="font-bold text-amber-300 underline">Animation test area →</a></>}</>} />
      <LookRow id="keepers" look={look} tabs={NEW_OLD} note={gp("keepers")} />
      <LookRow id="dribble" look={look} tabs={NEW_OLD} note={gp("dribble")} />
      <LookRow id="dribble3d" look={look} tabs={[["3d", "3D"], ["old", "Old"]]} note="Being tested. 3D: a dribble run is played top-down, in the Free Roam look, with the stick, sprint and stamina. Old: the first-person duel." />
      <LookRow id="clearances" look={look} tabs={NEW_OLD} note={gp("clearances")} />
      <LookRow id="chanceMix" look={look} tabs={NEW_OLD} note={gp("chanceMix")} />
      <LookRow id="kaneDrawings" look={look} tabs={NEW_OLD} note={gp("kaneDrawings")} />
      <SetToggle label="Player faces" on={faceStyle.facesEnabled} onClick={() => flipFace("facesEnabled")} />
      <SetToggle label="Player names" on={faceStyle.namesEnabled} onClick={() => flipFace("namesEnabled")} />
      <SetToggle label="Post-match reactions" on={postMatch} onClick={flipPostMatch} last />
    </>
  );
}

/** 3D world: garden, shop player, people, the manager's office, casino, signing. */
function World3dGroup() {
  const look = useLook();
  const controls = useControlChoice();
  return (
    <>
      <PrefRow label="3D drill controls" note={`Auto: this device's own (${detectScheme() === "touch" ? "touch" : "keys and mouse"}). Touch: a stick under your left thumb, swipe to kick. Keys: WASD, Shift sprints, the mouse kicks.`}>
        <SegTabs className="w-[150px] shrink-0" value={controls} onChange={(v) => setControlChoice(v as ControlChoice)} tabs={[["auto", "Auto"], ["touch", "Touch"], ["pc", "Keys"]] as const} />
      </PrefRow>
      <LookRow id="garden" look={look} tabs={NEW_OLD} note="New: golden-hour light, a real shop front. Old: the garden as it was." />
      <LookRow id="look3d" look={look} tabs={[["h", "H"], ["old", "Old"]] as const} note="H: console realism. The 3D drills in a full stadium with a crowd, real sky light, a broadcast picture; the garden and shop lit by a real sky. Old: as before." />
      <LookRow id="shopPlayer" look={look} tabs={NEW_OLD} />
      <LookRow id="people3d" look={look} tabs={NEW_OLD} note="New: one body in the signing, shop and garden, with real fingers." />
      <LookRow id="humanBody" look={look} tabs={[["human", "Human"], ["before", "Before"]]} note="Being tested. Human: a real human body, real clothes and hair, any height and build. Before: the one body. Needs 3D people: New." />
      <LookRow id="cutscenePeople" look={look} tabs={NEW_OLD} note="Being tested. New: painted faces with real eyes that blink, and expressions. Old: the faces as they were." />
      <LookRow id="camera3d" look={look} tabs={NEW_OLD} note="Being tested. The real game in 3D. New: a follow camera tight on the action (ball, you, your team-mates in the move, the nearest defenders, the keeper and goal), a little lower, kept inside what the phone shows; men and ball smaller (1.6× life size, was up to 2.6×). Old: everyone in the chance on screen, men drawn big." />
      <LookRow id="playerLight3d" look={look} tabs={NEW_OLD} note="Being tested. The real game in 3D. New: the players lit from the side and behind, darker underneath, a shadow under each man. Old: the light as it was." />
      <LookRow id="motion" look={look} tabs={[["mocap", "Mocap"], ["old", "Old"]]} note="Mocap: real people's movement, recorded in a motion-capture studio, on every 3D player. Old: the hand-made moves." />
      <LookRow id="bossRoom" look={look} tabs={[["3d", "3D office"], ["old", "Old"]]} />
      <LookRow id="casino" look={look} tabs={[["3d", "3D"], ["classic", "Classic"]]} note="3D: walk the casino room. Classic: the casino menu." />
      <LookRow id="casinoLook" look={look} tabs={[["new", "New"], ["old", "Old"]]} note="New: the 3D casino in warm light with shadows, crystal chandeliers, woven walls and a camera that keeps out of the lamps. Old: as before." />
      <LookRow id="signing" look={look} tabs={[["3d", "3D"], ["drawn", "Drawn"]]} note="3D: a live scene with your player. Drawn: the picture signing." />
    </>
  );
}

/** Screens: the UI, badges, all seasons, ovations, the drawn-player style. */
function ScreensGroup() {
  const look = useLook();
  return (
    <>
      <LookRow id="ui" look={look} tabs={[["new", "New"], ["old", "Old"]]} note="Old: the game as it was before v0.23, kept as a backup. Same save." />
      <LookRow id="badges" look={look} tabs={NEW_OLD} note="New: drawn badges in each club's colours. Old: the letters." />
      <LookRow id="allSeasons" look={look} tabs={NEW_OLD} note="New: goals by season, the cabinet and every season. Old: the three tables." />
      <LookRow id="ovation" look={look} tabs={NEW_OLD} note="New: your farewell's 85th minute in 3D. Old: the banner." />
      <LookRow id="ovationMoves" look={look} tabs={NEW_OLD} note="New: hugs and claps made in Blender. Old: arms placed live." />
      <LookRow id="drawnStyle" look={look} tabs={[["3d", "Shaded"], ["classic", "Flat"]]} note="Drawn players only (Classic view, five-a-side, the dribble)." />
    </>
  );
}

export interface ExtraGroup {
  id: string;
  title: string;
  sub: string;
  count?: number;
  /** Rendered under the open header, outside a card (it brings its own). */
  content: React.ReactNode;
}

/** The folded groups. One open at a time; opening one scrolls it to the top. */
export function SettingsGroups({ glow, extra = [] }: { glow: string; extra?: ExtraGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (open) refs.current[open]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [open]);
  const groups: (ExtraGroup & { card?: boolean })[] = [
    { id: "match", title: "Match", sub: "View, camera, ball, chances, keepers, dribble…", count: 14, content: <MatchGroup />, card: true },
    { id: "world", title: "3D world", sub: "Garden, look, shop, people, body, motion, office, casino, signing", count: 11, content: <World3dGroup />, card: true },
    { id: "screens", title: "Screens", sub: "UI, badges, all seasons, ovations, drawn style", count: 6, content: <ScreensGroup />, card: true },
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

/** Version on top, then the quick switches: the first screen of both Settings pages. */
export function SettingsTop({ glow, fullscreen }: {
  glow: string;
  fullscreen: { support: FullscreenSupport; on: boolean; onToggle: () => void };
}) {
  return (
    <>
      <SetSection className="mb-1.5 mt-1">Game version</SetSection>
      <VersionCard glow={glow} />
      <SetSection className="mb-1.5 mt-3">Quick</SetSection>
      <QuickSwitches glow={glow} fullscreen={fullscreen} />
    </>
  );
}

