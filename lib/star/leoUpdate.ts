/**
 * LEO'S 24 OCT UPDATE, BEHIND A SWITCH.
 *
 * Leo, 24 Oct 2026: "merge it all but for now on a leo 24th october update
 * thing hidden away in an updates settings toggle thing (again though
 * everything should be toggleable …) i wanna try the stuff out now without
 * affecting game".
 *
 * So every part of the 22-24 Oct build (celebrations, big moments, the fast
 * feed, Goal of the Month, goal videos that play at once, the season video,
 * the goals list, the awards night, the bug fixes) checks here before it does
 * anything. OFF by default, per device: with the switch
 * off the live game is exactly as it was. Admins turn it on in Settings →
 * Updates → "Leo's 26 Oct update" (components/star/LeoUpdateCard.tsx; was "24 Oct", same switch, 26 Oct adds weather and the overnight fixes), then
 * each part has its own switch underneath (all on once the update is on).
 *
 * Rule for the code that reads it: check at the CALL SITE (the screen or the
 * match hand-off), never inside the pure lib functions, so the tests of those
 * functions are unchanged and "off" means the old path runs untouched.
 */
import { useEffect, useState } from "react";

export const LEO_UPDATE_KEY = "kib-update-leo-2026-10-24";
const EVENT = "kib-leo-update";

export const LEO_FEATURES = [
  { id: "celebrations", label: "Goal celebrations", line: "After your goal: run to the corner and your shop celebration; nobody stands on you; tap to skip; in goal videos." },
  { id: "bigMoments", label: "Big moments", line: "85'+ level or one down: heartbeat, crowd rise, slow motion on a goal, late commentary (no banner)." },
  { id: "feedSpeed", label: "Fast social feed", line: "Smooth scrolling on slow phones; videos made off the main thread and kept." },
  { id: "goalVideoNow", label: "Goal videos play at once", line: "Your goal and the highlights play straight away from the recording." },
  { id: "goalOfMonth", label: "Goal of the Month", line: "A monthly poll in the feed: your 3 best goals v 2 others." },
  { id: "seasonReel", label: "Season video", line: "Every goal of your season before the Ballon d'Or." },
  { id: "goalsGallery", label: "Career goals list", line: "Stats → Goals: every goal of your career; best 10 in the Hall of Fame." },
  { id: "awardsNight", label: "Season awards night", line: "The 3D awards night in place of the awards page." },
  { id: "smoothGoals", label: "Smooth goal videos", line: "Real goals move like the made-up ones: no stop-start, no statues." },
  { id: "weather", label: "Weather and pitch", line: "Wind bends the ball, rain skids it, a poor dry pitch kills it; shown before kick-off and in the match." },
  { id: "keeperCatch", label: "Keeper catches and dives", line: "He dives in time, the ball goes into his gloves and moves with him, he lands and gets up. Pick a look below." },
  { id: "commentaryVoice", label: "New commentary voice", line: "A new, more natural commentator for goal videos and late goals: builds with the goal, calmer co-commentator, TV mic sound." },
  { id: "bugFixes", label: "Bug fixes (21)", line: "Refresh comes back where you were, labels, tour once, no sack after promotion, talks back button, signing manager name…" },
] as const;
export type LeoFeature = (typeof LEO_FEATURES)[number]["id"];

interface Saved { on: boolean; off: LeoFeature[]; /** When it was last changed (ms), so the newest change wins across devices. */ at?: number }
const NONE: Saved = { on: false, off: [] };

function read(): Saved {
  try {
    if (typeof window === "undefined") return NONE;
    const raw = window.localStorage.getItem(LEO_UPDATE_KEY);
    if (!raw) return NONE;
    const s = JSON.parse(raw) as Partial<Saved>;
    return { on: s.on === true, off: Array.isArray(s.off) ? (s.off.filter((x) => LEO_FEATURES.some((f) => f.id === x)) as LeoFeature[]) : [], ...(typeof s.at === "number" ? { at: s.at } : {}) };
  } catch { return NONE; }
}
function write(s: Saved) {
  try { window.localStorage.setItem(LEO_UPDATE_KEY, JSON.stringify(s)); } catch { /* private mode: stays off */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window */ }
}

/** Is the update on (no argument), or this part of it? Off by default, and always off on the server and in tests. */
export function leoUpdateOn(f?: LeoFeature): boolean {
  const s = read();
  if (!s.on) return false;
  return f ? !s.off.includes(f) : true;
}
export function setLeoUpdate(on: boolean) { write({ ...read(), on, at: Date.now() }); }
export function setLeoFeature(f: LeoFeature, on: boolean) {
  const s = read();
  write({ ...s, off: on ? s.off.filter((x) => x !== f) : [...s.off.filter((x) => x !== f), f], at: Date.now() });
}

/**
 * THE SWITCH FOLLOWS YOUR ACCOUNT (Leo, 30 Oct 2026: "perfect loading time
 * for phone, but still takes seconds on pc" — the switch was on on his phone
 * and off on his computer, because it lived on each device). The setting is
 * also kept in the career save (CareerState.leoUpdate), which syncs between
 * devices; app/star-dev/page.tsx copies whichever was changed last.
 */
export type LeoUpdateSetting = Saved;
/** This device's setting, or null if it was never set here. */
export function leoUpdateLocal(): LeoUpdateSetting | null {
  try {
    if (typeof window === "undefined" || window.localStorage.getItem(LEO_UPDATE_KEY) === null) return null;
  } catch { return null; }
  return read();
}
/** Take the setting from the save (another device changed it more recently). */
export function adoptLeoUpdate(s: LeoUpdateSetting) {
  write({ on: s.on === true, off: (Array.isArray(s.off) ? s.off : []).filter((x) => LEO_FEATURES.some((f) => f.id === x)) as LeoFeature[], at: s.at ?? Date.now() });
}
export const LEO_UPDATE_EVENT = EVENT;

/** React: re-renders when the switch changes (this tab or another). */
export function useLeoUpdate(f?: LeoFeature): boolean {
  const [on, setOn] = useState(false); // false on the server and the first render: no hydration mismatch
  useEffect(() => {
    const sync = () => setOn(leoUpdateOn(f));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, [f]);
  return on;
}

/** The keeper look Leo is trying (lib/star/keeperShow.ts KEEPER_LOOKS). Per device. */
export const KEEPER_LOOK_KEY = "kib-keeper-look";
export function keeperLookChoice(): "natural" | "broadcast" | "arcade" {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(KEEPER_LOOK_KEY) : null;
    return v === "broadcast" || v === "arcade" ? v : "natural";
  } catch { return "natural"; }
}
export function setKeeperLookChoice(v: "natural" | "broadcast" | "arcade") {
  try { window.localStorage.setItem(KEEPER_LOOK_KEY, v); } catch { /* private mode */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* no window */ }
}
