/**
 * COLD EDITS: THE WORDS (switch part "coldEdits", templates/coldEdits.ts).
 *
 * With Football Twitter and the cold edits on, plays a season on two seeds:
 *  - the edit pages post their cold-edit lines, each with a playable video of
 *    your goal (Leo's rule: no post talks about a video it does not show);
 *  - no slot is left unfilled ({short}, {oppS}…);
 *  - the account that says "cold." posts a cold style (clipStyle.ts), so the
 *    words fit the video.
 * And with the part off (the flag unset), no cold line is ever posted.
 *
 * Run: npx tsx tests/star/coldEditWords.mts
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { seasonsRun } from "../../scripts/football-twitter/run.mts";
import { mediaOf } from "../../lib/star/media/feed";
import { hasPlayableVideo } from "../../lib/star/media/twitter/videoWords";
import { clipStyleFor, coldPostKey } from "../../lib/star/media/clipStyle";
import { isColdStyle } from "../../lib/star/goalClip/editCold";
import { COLD_TWITTER } from "../../lib/star/media/templates/coldEdits";
import { personaById } from "../../lib/star/media/twitter/personas";
import type { StoredPost } from "../../lib/star/media/types";

const problems: string[] = [];
const fail = (w: string) => { if (problems.length < 30) problems.push(w); };

for (const t of COLD_TWITTER) {
  if (!personaById(t.persona!)) fail(`line for an account that does not exist: ${t.persona}`);
  if (t.graphic !== "goalVideo") fail(`a cold line without its video: ${t.id}`);
}

function run(cold: boolean, seed: number): StoredPost[] {
  setMediaUpdate({ footballTwitter: true, coldEdits: cold });
  const all = new Map<string, StoredPost>();
  seasonsRun(1, seed, step => { for (const p of mediaOf(step).posts) all.set(p.id, p); });
  return Array.from(all.values());
}

// A post carries no template id: know a cold line by its words (the account's
// typing changes case and adds emoji, so both are ignored).
const plain = (s: string) => s.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
const COLD_RE = COLD_TWITTER.map(t => new RegExp(`^${plain(t.body).split(/\{[^}]+\}/).map(esc).join(".+?")}`));
const isColdLine = (p: StoredPost) => COLD_RE.some(r => r.test(plain(p.text)));

let coldLines = 0, coldVideos = 0, offCold = 0;
const kinds = new Map<string, number>();
for (const seed of [4242, 77]) {
  for (const p of run(true, seed)) {
    const isCold = isColdLine(p);
    if (!isCold) continue;
    coldLines++;
    if (!hasPlayableVideo(p)) fail(`cold line with no video: ${p.author.handle}: ${p.text}`);
    if (/\{|\}/.test(p.text)) fail(`unfilled slot: ${p.text}`);
    const g = p.graphic;
    if (g?.type === "goalVideo") {
      // The line names its edit (feed.ts sets graphic.style), so the words fit the video.
      const style = g.style ?? clipStyleFor({ ...p.author, persona: p.persona }, true, true, coldPostKey(g.clips, g.synth));
      if (isColdStyle(style)) coldVideos++;
      const line = COLD_TWITTER.find((t, i) => COLD_RE[i].test(plain(p.text)));
      if (line?.videoStyle && g.style !== line.videoStyle) fail(`"${p.text}" names ${line.videoStyle} but shows ${g.style}`);
      kinds.set(style, (kinds.get(style) ?? 0) + 1);
    }
  }
  for (const p of run(false, seed)) if (isColdLine(p)) offCold++;
}
console.log(`on: ${coldLines} cold-edit lines over 2 seasons, ${coldVideos} of them over a cold edit (${Array.from(kinds).map(([k, n]) => `${k} ${n}`).join(", ")}); off: ${offCold}`);
if (coldLines < 5) fail(`only ${coldLines} cold-edit lines in two seasons`);
if (coldVideos < coldLines) fail(`only ${coldVideos} of ${coldLines} cold lines sit over a cold edit`);
if (offCold) fail(`${offCold} cold lines posted with the part off`);
setMediaUpdate({ footballTwitter: false, coldEdits: false });

if (problems.length) { console.log(`✗ ${problems.length}:\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log("✓ cold-edit words fit their videos");
