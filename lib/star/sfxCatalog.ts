/**
 * THE SOUND LIST — every sound file in public/sfx, in plain English.
 *
 * One entry per file. The Sound Board admin page (/admin/sound-board) reads
 * this, and the upload route only accepts names that appear here, so a typo
 * can never create a stray override. The file names match
 * public/sfx/manifest.json (made by scripts/sfx/generate.py).
 *
 * `wired` says whether the game plays this sound today. The UI sounds play
 * through lib/star/sfx.ts; the kick, net, keeper and stadium-roar files and
 * the commentator lines play in goal videos (lib/star/goalClip/audio.ts). The
 * live match still uses its own synthesised sounds (lib/star/matchSound.ts),
 * and the whistles, the small-ground cheer and the groan are not played yet.
 *
 * Pure data — no browser or server imports — so both sides can use it.
 */
import { allCommentaryLines } from "./goalClip/commentary";

export interface SfxCatalogEntry {
  /** File name without .mp3 — also the key in the override list. */
  name: string;
  /** What the sound is, as it is named on the Sound Board. */
  label: string;
  /** Section on the page. */
  group: "The match" | "The crowd" | "The referee" | "Goal video commentator" | "Cut-scene music" | "Rewards" | "Menus, phone and news";
  /** Where the player hears it. Plain English. */
  where: string;
  /** True when the game plays it today. */
  wired: boolean;
}

export const SFX_CATALOG: SfxCatalogEntry[] = [
  { name: "kick-soft", label: "A pass or a soft touch", group: "The match", wired: true, where: "In goal videos in the feed (and a saved video). The live match still makes its own sound." },
  { name: "kick-hard", label: "A struck shot", group: "The match", wired: true, where: "In goal videos in the feed (and a saved video). The live match still makes its own sound." },
  { name: "goal-net", label: "Ball hits the back of the net", group: "The match", wired: true, where: "In goal videos in the feed (and a saved video). The live match still makes its own sound." },
  { name: "keeper-save", label: "Keeper catches or parries", group: "The match", wired: true, where: "In goal videos in the feed (and a saved video). The live match still makes its own sound." },
  { name: "crowd-cheer-small", label: "Goal at a small non-league ground", group: "The crowd", wired: false, where: "Not played yet. The match makes its own crowd noise." },
  { name: "crowd-cheer-stadium", label: "Goal in a big stadium", group: "The crowd", wired: true, where: "In goal videos in the feed (and a saved video). The live match still makes its own sound." },
  { name: "crowd-groan", label: "A near miss or a save", group: "The crowd", wired: false, where: "Not played yet. The match makes its own crowd noise." },
  { name: "whistle-start", label: "Kick-off", group: "The referee", wired: false, where: "Not played yet. The match makes its own whistle." },
  { name: "whistle-half", label: "Half time", group: "The referee", wired: false, where: "Not played yet. The match makes its own whistle." },
  { name: "whistle-full", label: "Full time", group: "The referee", wired: false, where: "Not played yet. The match makes its own whistle." },
  // The goal-video commentary (lib/star/goalClip/commentary.ts): the lead's
  // calls and the co-commentator's replay lines, one entry each.
  ...allCommentaryLines().map((l): SfxCatalogEntry => ({
    name: l.id,
    label: `${l.voice === "lead" ? "Commentator" : "Co-commentator"}: "${l.text}"`,
    group: "Goal video commentator",
    wired: true,
    where: l.voice === "lead"
      ? "In TV, highlights and TikTok goal videos, as the goal goes in (or just after, for what it means for the score)."
      : "In TV and highlights goal videos, over the slow-motion replay.",
  })),
  // The cut-scene music beds (lib/star/cutscene/music.ts, made by tools/cutscene-music/make_beds.py).
  { name: "cut-music-signing", label: "Music: signing a contract (warm, hopeful)", group: "Cut-scene music", wired: true, where: "Under the contract-signing cut scene (Settings → Look → Cut-scene camera: New)." },
  { name: "cut-music-trophy", label: "Music: a trophy, a goal, an award (triumphant)", group: "Cut-scene music", wired: true, where: "Under the trophy lift, goal, award and promotion cut scenes (Cut-scene camera: New)." },
  { name: "cut-music-walkout", label: "Music: the walk-out (building tension)", group: "Cut-scene music", wired: true, where: "Under the tunnel walk-out, debut and rivalry cut scenes (Cut-scene camera: New)." },
  { name: "cut-music-press", label: "Music: press room and bad news (low tension)", group: "Cut-scene music", wired: true, where: "Under the press conference, the manager's office with bad news, injuries and the mentor (Cut-scene camera: New)." },
  { name: "cut-music-farewell", label: "Music: the farewell (emotional)", group: "Cut-scene music", wired: true, where: "Under the farewell cut scene at the end of a career (Cut-scene camera: New)." },
  { name: "coin-in", label: "Money paid in", group: "Rewards", wired: true, where: "After a match when your pay comes in. Also when you sell a stake in a club or sell a player." },
  { name: "star-tick", label: "Star bar filling, one tick", group: "Rewards", wired: true, where: "After a match, as the star bar starts to fill." },
  { name: "level-up", label: "Star rating goes up", group: "Rewards", wired: true, where: "After a match when your star rating goes up. Also when a new star banner shows." },
  { name: "achievement-pop", label: "Achievement unlocked", group: "Rewards", wired: true, where: "When an achievement or a record pops up: the pop-up, the post-match list and the unlock screens." },
  { name: "ui-tap", label: "Any button tap", group: "Menus, phone and news", wired: true, where: "Every ordinary button in the New UI." },
  { name: "ui-confirm", label: "Confirm / continue", group: "Menus, phone and news", wired: true, where: "Every green and gold button (Continue, Play Match, Confirm). Also when you switch Sound effects on in Settings." },
  { name: "phone-notification", label: "New post on the phone feed", group: "Menus, phone and news", wired: true, where: "When a new post lands on your phone while you are on the home screens." },
  { name: "breaking-news", label: "Breaking news headline", group: "Menus, phone and news", wired: true, where: "When the Breaking News screen opens." },
  { name: "can-open", label: "Opening an energy drink", group: "Menus, phone and news", wired: true, where: "When you use an energy can." },
];

export const SFX_GROUPS: SfxCatalogEntry["group"][] = ["The match", "The crowd", "The referee", "Goal video commentator", "Cut-scene music", "Rewards", "Menus, phone and news"];

export const SFX_NAMES: string[] = SFX_CATALOG.map((s) => s.name);

/** Where the override list lives in the tierlist-images bucket. */
export const SFX_OVERRIDE_FOLDER = "sfx-overrides";
export const SFX_OVERRIDE_MAP_PATH = `${SFX_OVERRIDE_FOLDER}/map.json`;

/** The override list: sound name → public URL of the replacement file. */
export type SfxOverrideMap = Record<string, { url: string; updated: string; original?: string }>;

/** Keep only entries for known names with a web URL — whatever was stored. */
export function cleanOverrideMap(raw: unknown): SfxOverrideMap {
  const out: SfxOverrideMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!SFX_NAMES.includes(k) || !v || typeof v !== "object") continue;
    const e = v as { url?: unknown; updated?: unknown; original?: unknown };
    if (typeof e.url !== "string" || !/^https?:\/\//.test(e.url)) continue;
    out[k] = {
      url: e.url,
      updated: typeof e.updated === "string" ? e.updated : "",
      ...(typeof e.original === "string" ? { original: e.original } : {}),
    };
  }
  return out;
}
