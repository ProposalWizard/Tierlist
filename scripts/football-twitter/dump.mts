/**
 * Text dump of a seeded career's feed, for reading by eye.
 *   npx tsx scripts/football-twitter/dump.mts [on|off] [matches] [seed]
 * Prints the settled feed in its shown order (ranked when on), with replies
 * and quotes, then every other post made.
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { richRun } from "./run.mts";
import { feedFor, mediaOf } from "../../lib/star/media/feed";
import type { StoredPost } from "../../lib/star/media/types";

const [mode = "on", n = "14", seed = "4242"] = process.argv.slice(2);
setMediaUpdate({ footballTwitter: mode === "on" });
const c = richRun(Number(n), Number(seed));
const k = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `${(x / 1e3).toFixed(1)}K` : String(x));

function show(p: StoredPost, i: number): string {
  const m = p.metrics;
  const tick = p.author.verified ? (p.author.tick === "gold" ? " [gold]" : " [blue]") : "";
  const lines = [
    `#${i} ${p.author.name}${tick} ${p.author.handle} · ${p.eventId}${p.persona ? ` · ${p.persona}` : ""}`,
    p.text.split("\n").map(l => `   ${l}`).join("\n"),
  ];
  if (p.graphic) {
    const g = p.graphic as { type: string; question?: string; options?: string[]; votes?: number[] };
    const sum = Math.max(1, (g.votes ?? []).reduce((x, y) => x + y, 0));
    const vid = g as { clips?: string[]; synth?: unknown[]; standIn?: unknown[] };
    const goals = g.type === "goalVideo" ? ` ${vid.clips?.length ?? 0} recorded + ${vid.synth?.length ?? 0} made${vid.standIn?.length ? `, ${vid.standIn.length} stand-in` : ""}` : "";
    lines.push(`   [${g.type}${goals}${g.question ? `: ${g.question} — ${g.options?.map((o, j) => `${o} ${Math.round(((g.votes?.[j] ?? 0) / sum) * 100)}%`).join(" / ")}` : ""}]`);
  }
  if (p.sound) lines.push(`   ♫ ${p.sound}  (TikTok)`);
  if (p.quote) lines.push(`   ┌ quoting ${p.quote.name} ${p.quote.handle}${p.quote.graphic ? " [its video plays here]" : ""}: ${p.quote.text.replace(/\n/g, " / ")}`);
  lines.push(`   💬${k(m.replies)} 🔁${k(m.reposts)} ❤️${k(m.likes)}${m.views !== undefined ? ` 👁${k(m.views)} ❝${k(m.quotes ?? 0)}` : ""}`);
  for (const r of p.thread ?? []) lines.push(`     ↳ ${r.name} ${r.handle}: ${r.text}  ❤️${k(r.likes)}`);
  return lines.join("\n");
}

const settled = feedFor(c, "settled").posts;
console.log(`=== SETTLED FEED (${settled.length} shown, ${mode}) ===\n`);
settled.forEach((p, i) => console.log(show(p, i + 1) + "\n"));
const shownIds = new Set(settled.map(p => p.id));
const rest = mediaOf(c).posts.filter(p => !shownIds.has(p.id)).reverse();
console.log(`=== OLDER POSTS IN THE SAVE (${rest.length}) ===\n`);
rest.forEach((p, i) => console.log(show(p, i + 1) + "\n"));
