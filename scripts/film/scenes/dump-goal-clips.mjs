/**
 * Dump every goal recording a browser profile holds (IndexedDB star-goal-clips) to JSON (chat 1, 25 Oct 2026).
 *   node scripts/film/scenes/dump-goal-clips.mjs <port> <profileDir> <out.json>
 */
import { chromium } from "playwright";
import fs from "node:fs";
const [PORT, PROF, OUT] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(PROF, { executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-dev-shm-usage"] });
const pg = ctx.pages()[0] || (await ctx.newPage());
await pg.goto(`http://localhost:${PORT}/privacy`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
const rows = await pg.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("star-goal-clips", 1);
  r.onerror = () => res([]);
  r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains("clips")) return res([]);
    const q = db.transaction("clips").objectStore("clips").getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); };
}));
fs.writeFileSync(OUT, JSON.stringify(rows));
console.log(rows.length, "recordings");
await ctx.close();
