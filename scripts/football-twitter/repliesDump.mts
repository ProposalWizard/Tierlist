/**
 * Every thread in N seeded feeds, for reading the replies by eye (Leo, round 4).
 *   npx tsx scripts/football-twitter/repliesDump.mts [feeds=40] > out.txt
 * Each feed: a career of 6 to 30 matches (seeded), plus a contract, a
 * sacking and a move. Prints the shown feed's posts that have replies, with
 * each post's tone and each reply's side and tone.
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { richRun } from "./run.mts";
import { feedFor } from "../../lib/star/media/feed";
import { postTone } from "../../lib/star/media/twitter/tone";
import { mulberry32 } from "../../lib/star/season";

setMediaUpdate({ footballTwitter: true });
const feeds = Number(process.argv[2] ?? 40);
const pick = mulberry32(31337);
let shown = 0;
for (let i = 0; i < feeds; i++) {
  const seed = 100 + Math.floor(pick() * 90_000);
  const n = 6 + Math.floor(pick() * 25);
  const c = richRun(n, seed);
  const posts = feedFor(c, "settled").posts.filter(p => p.thread?.length);
  console.log(`\n================ FEED ${i + 1}: seed ${seed}, ${n} matches, ${posts.length} threads shown ================`);
  for (const p of posts) {
    shown++;
    console.log(`\n${p.author.name} ${p.author.handle}${p.author.platform === "tiktok" ? " (TikTok)" : ""} · ${p.eventId} · tone ${postTone(p)}`);
    console.log(`   ${p.text.replace(/\n+/g, " / ")}`);
    if (p.quote) console.log(`   ┌ quoting ${p.quote.handle}: ${p.quote.text.replace(/\n+/g, " / ")}`);
    if (p.graphic?.type === "poll") console.log(`   [poll: ${p.graphic.options.join(" / ")}]`);
    if (p.graphic && (p.graphic.type === "goalVideo" || p.graphic.type === "thumbnail")) console.log(`   [video]`);
    for (const r of p.thread!) {
      console.log(`     ${r.to ? `   ↳ (to ${r.to}) ` : "↳ "}${r.name} ${r.handle} [${r.side ?? "?"}/${r.tone ?? "?"}]: ${r.text}  ♥${r.likes}${r.creatorLiked ? " · liked by creator" : ""}`);
    }
  }
}
console.log(`\n${shown} threads in ${feeds} feeds`);
