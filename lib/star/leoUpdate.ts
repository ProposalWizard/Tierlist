/**
 * LEO'S 24 OCT UPDATE, BEHIND A SWITCH.
 *
 * Leo, 24 Oct 2026: "merge it all but for now on a leo 24th october update
 * thing hidden away in an updates settings toggle thing (again though
 * everything should be toggleable …) i wanna try the stuff out now without
 * affecting game".
 *
 * So every part of the 22-24 Oct build (celebrations, big moments, bicycle
 * kicks, the fast feed, Goal of the Month, goal videos that play at once,
 * the season video, the goals list, the awards night, the bug fixes) checks
 * here before it does anything. OFF by default, per device: with the switch
 * off the live game is exactly as it was. Admins turn it on in Settings →
 * Updates → "Leo's 24 Oct update" (components/star/LeoUpdateCard.tsx), then
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
  { id: "celebrations", label: "Goal celebrations", line: "After your goal: run to the corner and your shop celebration; tap to skip; in goal videos." },
  { id: "bigMoments", label: "Big moments", line: "85'+ level or one down: banner, heartbeat, slow motion on a goal, late commentary." },
  { id: "bicycle", label: "Bicycle kicks", line: "The Bicycle! button on high crosses across you, and the overhead Real Moments." },
  { id: "feedSpeed", label: "Fast social feed", line: "Only posts near the screen drawn; videos made off the main thread and kept." },
  { id: "goalVideoNow", label: "Goal videos play at once", line: "Your goal and the highlights play straight away from the recording." },
  { id: "goalOfMonth", label: "Goal of the Month", line: "A monthly poll in the feed: your 3 best goals v 2 others." },
  { id: "seasonReel", label: "Season video", line: "Every goal of your season before the Ballon d'Or." },
  { id: "goalsGallery", label: "Career goals list", line: "Stats → Goals: every goal of your career; best 10 in the Hall of Fame." },
  { id: "awardsNight", label: "Season awards night", line: "The 3D awards night in place of the awards page." },
  { id: "bugFixes", label: "Bug fixes (17)", line: "Refresh comes back where you were, labels, tour once, no sack after promotion…" },
] as const;
export type LeoFeature = (typeof LEO_FEATURES)[number]["id"];

interface Saved { on: boolean; off: LeoFeature[] }
const NONE: Saved = { on: false, off: [] };

function read(): Saved {
  try {
    if (typeof window === "undefined") return NONE;
    const raw = window.localStorage.getItem(LEO_UPDATE_KEY);
    if (!raw) return NONE;
    const s = JSON.parse(raw) as Partial<Saved>;
    return { on: s.on === true, off: Array.isArray(s.off) ? (s.off.filter((x) => LEO_FEATURES.some((f) => f.id === x)) as LeoFeature[]) : [] };
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
export function setLeoUpdate(on: boolean) { write({ ...read(), on }); }
export function setLeoFeature(f: LeoFeature, on: boolean) {
  const s = read();
  write({ ...s, off: on ? s.off.filter((x) => x !== f) : [...s.off.filter((x) => x !== f), f] });
}

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
