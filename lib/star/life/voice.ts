/**
 * THE STORY'S VOICES — Den (Peter) and the gaffer (Paul) speaking their lines
 * in the kit man arc. The clips are public/star/life/voice/hundred-balls/
 * (manifest.json: {id, speaker, voice, text, file, seconds}), made by the
 * voices builder; this file only plays them.
 *
 *  - A clip plays when its words are on screen: each clip's id names its beat
 *    and node ("b1-the-offer.n1.say0.q0", "b2-the-gaffer.end.objective.0.q0",
 *    "b1-the-offer.play.caller2"), and it plays only if its own text is in what
 *    is shown, so an {if} line that was not shown stays silent, and a clip that
 *    holds only the sentence after a score plays when that sentence is there.
 *  - The game's sound setting (sfx.ts) is respected; a new line stops the last
 *    clip; nothing waits on audio; a missing file is silent text.
 *  - The manifest is fetched the first time a story screen speaks (no preload).
 *  - The people pool (pool.ts): a clip whose speaker is a pool person ("den") plays only when
 *    that person is in the story (voiceCast); his clips can live in his own folder
 *    (POOL[role][i].voice → public/star/life/voice/<folder>/manifest.json). A pool person with no
 *    clips is silent text. A line naming him ("Den says he can't think who") plays only when
 *    the words on screen say that name, i.e. only when the kit man is Den.
 */
import { sfxOn } from "../sfx";
import { POOL } from "./pool";

interface Clip { id: string; speaker: string; text: string; file: string; seconds: number; dir?: string }

/** The story's own folder (the gaffer and the other non-pool voices, and Den's clips). */
const ROOT = "/star/life/voice/";
const BASE_DIR = "hundred-balls";
const manifests = new Map<string, Promise<Clip[]>>();
let current: HTMLAudioElement | null = null;
let seq = 0;
/** Pool people (pool.ts) in the story now: a pool person's clips play only when he is the one in it. */
let cast = new Set<string>(["den"]);
const POOL_IDS = new Set(Object.values(POOL).flat().map((p) => p.id));

/** Who the story has (pool ids, e.g. this career's kit man). Call when a story screen opens. */
export function voiceCast(ids: string[]): void {
  cast = new Set(ids);
}

function load(dir: string): Promise<Clip[]> {
  let m = manifests.get(dir);
  if (!m) {
    m = fetch(`${ROOT}${dir}/manifest.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => (Array.isArray(j) ? (j as Clip[]).filter((c) => c && typeof c.id === "string" && typeof c.file === "string").map((c) => ({ ...c, dir })) : []))
      .catch(() => []);
    manifests.set(dir, m);
  }
  return m;
}

/** Every folder that can speak now: the story's own, and each pool person's in the story. */
function loadAll(): Promise<Clip[]> {
  const dirs = new Set([BASE_DIR]);
  for (const p of Object.values(POOL).flat()) if (cast.has(p.id) && p.voice) dirs.add(p.voice);
  return Promise.all(Array.from(dirs).map(load)).then((xs) => {
    const seen = new Set<string>();
    // A clip spoken by a pool person who is not in this story never plays (Den's voice is Den's).
    return xs.flat().filter((c) => (!POOL_IDS.has(c.speaker) || cast.has(c.speaker)) && !seen.has(c.id) && seen.add(c.id));
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** Stop whatever is playing (the line changed, the screen closed). */
export function stopVoice(): void {
  seq++;
  if (current) { try { current.pause(); } catch { /* fine */ } current = null; }
}

/**
 * Speak the clips of `prefix` (a beat and a node, "b1-the-offer.n1."; or several) whose
 * words are in `shown`, in the order they appear there. Returns at once.
 */
export function speak(prefix: string | string[], shown: string): void {
  stopVoice();
  if (typeof window === "undefined" || typeof Audio === "undefined" || !sfxOn()) return;
  const mine = ++seq;
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  // Whole words only: "Hm." must not play inside "them".
  const text = ` ${norm(shown)} `;
  const at = (c: Clip) => text.indexOf(` ${norm(c.text)} `);
  loadAll().then((all) => {
    if (mine !== seq) return;
    const list = all
      .filter((c) => prefixes.some((p) => c.id.startsWith(p)) && c.text && at(c) >= 0)
      .sort((a, b) => at(a) - at(b));
    const next = (i: number) => {
      if (mine !== seq || i >= list.length || !sfxOn()) return;
      const a = new Audio(`${ROOT}${list[i].dir ?? BASE_DIR}/${list[i].file.replace(/^.*\//, "")}`);
      current = a;
      a.onended = () => next(i + 1);
      a.onerror = () => next(i + 1);
      a.play().catch(() => next(i + 1));
    };
    next(0);
  }).catch(() => { /* silent text */ });
}

/** The beat's prefix in the clip ids: its id in the arc book. */
export const voicePrefix = (beat: string, node: string) => `${beat}.${node}.`;
