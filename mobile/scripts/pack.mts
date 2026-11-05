/**
 * mobile/scripts/pack.mts — PACK THE GAME'S DATA INTO THE APP.
 *
 *   npx tsx mobile/scripts/pack.mts --base http://localhost:3000 [--out mobile/packed]
 *
 * The website reads its players, badges and settings from the database each
 * time. The packed app must not (Mikey, 5 Nov 2026: "the game should be
 * completely, perfectly playable offline"). This script asks a running copy
 * of the website (`--base`, the game's own routes) for everything the game
 * reads, saves it as files, then downloads every picture those files point
 * to (player photos, club badges, flags). lib/app/offline.ts answers the
 * game's requests from these files inside the app.
 *
 * Nothing here writes to the database: reads only.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as CLUBS from "../../lib/star/clubs";
import { STAR_FIFA_YEAR } from "../../lib/star/edition";
import { ALL_NATIONALITIES, getFlagUrl } from "../../lib/nationalities";
import { PACK_ROUTES, type PackedIndex } from "../../lib/app/packedIndex";

const argv = process.argv.slice(2);
const arg = (f: string, d: string) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(arg("--out", "mobile/packed"));
const YEAR = STAR_FIFA_YEAR;
const FREE_AGENTS = "Free Agents";
// sharp (mobile/package.json) shrinks the pictures; without it they are kept as they came.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharp: any = await import("sharp").then((m) => m.default).catch(() => null);

// The two public Supabase values (not secrets: they ship in every page of the
// website). From the environment, else .env.local.
function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  try {
    const m = fs.readFileSync(".env.local", "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim();
  } catch { /* none */ }
  throw new Error(`${name} is not set`);
}
const SUPA = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const log = (s: string) => console.log(s);
const write = (rel: string, data: unknown) => {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data));
  return `/packed/${rel}`;
};
async function getJson(url: string, init?: RequestInit, tries = 3): Promise<unknown> {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return await r.json();
    } catch (e) {
      if (t >= tries) throw new Error(`${url.slice(0, 140)}: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * t));
    }
  }
}
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const index: PackedIndex = { packedAt: new Date().toISOString(), year: YEAR, routes: {}, squads: "", rosters: {}, supabase: {}, images: {} };
const problems: string[] = [];

// ── 1. Every club the game knows, and each one's squad ─────────────────────
const clubs = new Set<string>([FREE_AGENTS]);
for (const v of Object.values(CLUBS)) {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) for (const c of v) clubs.add(c);
}
const clubList = Array.from(clubs).sort();
log(`clubs: ${clubList.length}`);
const squads: Record<string, unknown[]> = {};
for (let i = 0; i < clubList.length; i += 150) {
  const batch = clubList.slice(i, i + 150);
  const res = await getJson(`${BASE}/api/star/league-squads?clubs=${encodeURIComponent(batch.join("|"))}&year=${YEAR}`) as { squads: Record<string, unknown[]> };
  Object.assign(squads, res.squads);
}
const withPlayers = Object.values(squads).filter((s) => s.length).length;
log(`squads: ${withPlayers} of ${clubList.length} clubs have real players, ${Object.values(squads).flat().length} players`);
index.squads = write(`data/squads-${YEAR}.json`, squads);

// The Draft's fuller roster, which your own club reads (lib/star/realSquad.ts).
let r = 0;
await pool(clubList.filter((c) => c !== FREE_AGENTS), 6, async (club) => {
  try {
    const res = await getJson(`${BASE}/api/draft/roster?club=${encodeURIComponent(club)}&year=${YEAR}`);
    const slug = crypto.createHash("sha1").update(club).digest("hex").slice(0, 12);
    index.rosters[club] = write(`data/roster/${slug}.json`, res);
    if (++r % 50 === 0) log(`rosters: ${r}`);
  } catch (e) { problems.push(`roster ${club}: ${(e as Error).message}`); }
});
log(`rosters: ${Object.keys(index.rosters).length}`);

// ── 2. The game's settings (line-ups, XP book, Star Pass, scenes, sounds) ───
for (const route of PACK_ROUTES) {
  try {
    index.routes[route] = write(`data/route-${crypto.createHash("sha1").update(route).digest("hex").slice(0, 12)}.json`, await getJson(`${BASE}${route}`));
  } catch (e) { problems.push(`route ${route}: ${(e as Error).message}`); }
}
log(`routes: ${Object.keys(index.routes).length} of ${PACK_ROUTES.length}`);

// ── 3. Tables the game reads straight from the database ─────────────────────
const supaHeaders = { apikey: ANON, Authorization: `Bearer ${ANON}` };
for (const [table, query] of [["club_logos", "select=club%2Clogo_url&limit=5000"], ["custom_clubs", "select=*&order=name.asc"]] as const) {
  try {
    index.supabase[table] = write(`data/table-${table}.json`, await getJson(`${SUPA}/rest/v1/${table}?${query}`, { headers: supaHeaders }));
  } catch (e) { problems.push(`table ${table}: ${(e as Error).message}`); }
}

// ── 4. Every picture those files point to, plus every flag ─────────────────
const urls = new Set<string>();
const IMG = /^https?:\/\/[^\s"']+\.(png|jpe?g|webp|gif|svg)(\?[^\s"']*)?$/i;
const walk = (x: unknown) => {
  if (typeof x === "string") { if (IMG.test(x)) urls.add(x); return; }
  if (Array.isArray(x)) { for (const y of x) walk(y); return; }
  if (x && typeof x === "object") for (const y of Object.values(x)) walk(y);
};
for (const f of [index.squads, ...Object.values(index.rosters), ...Object.values(index.routes), ...Object.values(index.supabase)]) {
  walk(JSON.parse(fs.readFileSync(path.join(OUT, f.replace(/^\/packed\//, "")), "utf8")));
}
for (const n of ALL_NATIONALITIES) { const u = getFlagUrl(n); if (u) urls.add(u); }
log(`pictures to fetch: ${urls.size}`);
let bytes = 0, got = 0;
await pool(Array.from(urls), 12, async (u) => {
  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error(String(res.status));
    let buf = Buffer.from(await res.arrayBuffer());
    let ext = (u.split("?")[0].match(/\.(\w+)$/)?.[1] ?? "png").toLowerCase();
    // Shrunk to the size the game shows it at (a team sheet face, a badge),
    // as WebP: a 60 KB photo becomes about 8 KB. Flags are already tiny.
    if (sharp && !/flagcdn\.com/.test(u) && ext !== "svg" && ext !== "gif") {
      try {
        buf = await sharp(buf).resize({ width: 200, height: 200, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
        ext = "webp";
      } catch { /* not a picture sharp can read: keep it as it came */ }
    }
    index.images[u] = write(`img/${crypto.createHash("sha1").update(u).digest("hex").slice(0, 16)}.${ext}`, buf);
    bytes += buf.length;
    if (++got % 500 === 0) log(`pictures: ${got}`);
  } catch (e) { problems.push(`picture ${u.slice(0, 120)}: ${(e as Error).message}`); }
});
log(`pictures: ${got} of ${urls.size}, ${(bytes / 1e6).toFixed(1)} MB`);

write("index.json", index);
fs.writeFileSync(path.join(OUT, "problems.txt"), problems.join("\n"));
log(`problems: ${problems.length} (see ${path.join(OUT, "problems.txt")})`);
log(`packed into ${OUT}`);
