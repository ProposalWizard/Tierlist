/**
 * STYLE A 2D PLAYERS (Harry, 9 Oct 2026: "remake the 2D frames but have it as an
 * option in settings with the current 2D as the priority"). index-a.json + the
 * "a" atlases are the Style A option; index.json and the current atlases stay
 * as they are. Proves: the same clips, frame counts, fps, loop, facings, strike
 * frames and mirrors; every cell inside its atlas; a standing man the same
 * height on the pitch (±5%); Current is the default in every preset.
 */
import fs from "node:fs";
import { spriteIndexFile, SPRITES2D_DEFAULT } from "../../lib/star/sprites2dLook";
import { VERSION_PRESETS } from "../../lib/star/gameVersions";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const D = "public/star/sprites/";
const cur = JSON.parse(fs.readFileSync(D + "index.json", "utf8"));
const sa = JSON.parse(fs.readFileSync(D + "index-a.json", "utf8"));

check(spriteIndexFile("current") === "index.json" && spriteIndexFile("stylea") === "index-a.json", "index file per look");
check(SPRITES2D_DEFAULT === "stylea", "Style A is the default (Harry, 9 Oct 2026)");
check(VERSION_PRESETS.classic.sprites2d === "current", `classic: 2D players ${VERSION_PRESETS.classic.sprites2d}`);
for (const v of ["standard", "preview"] as const) check(VERSION_PRESETS[v].sprites2d === "stylea", `${v}: 2D players ${VERSION_PRESETS[v].sprites2d}`);

const KEYS = ["fps", "loop", "dirs", "frames", "strikeFrame", "atlas", "mirrorOf"] as const;
let clips = 0, cells = 0;
for (const [ch, cv] of Object.entries(cur.chars) as [string, { clips: Record<string, Record<string, unknown> & { cells?: number[][] }> }][]) {
  for (const [n, c] of Object.entries(cv.clips)) {
    const a = sa.chars[ch]?.clips[n];
    if (!a) { problems.push(`${ch}.${n} missing in Style A`); continue; }
    for (const k of KEYS) check(JSON.stringify(c[k]) === JSON.stringify(a[k]), `${ch}.${n}.${k}: ${JSON.stringify(c[k])} vs ${JSON.stringify(a[k])}`);
    check((c.cells?.length ?? 0) === (a.cells?.length ?? 0), `${ch}.${n}: ${c.cells?.length} vs ${a.cells?.length} cells`);
    clips++;
    const info = (a.atlas ?? 0) === 0 ? sa.atlas : sa.atlases[String(a.atlas)];
    for (const [x, y, w, h] of a.cells ?? []) { cells++; check(x >= 0 && y >= 0 && x + w <= info.w && y + h <= info.h && w > 2 && h > 2, `${ch}.${n}: cell ${x},${y} ${w}x${h} outside ${info.w}x${info.h}`); }
  }
}
check(Object.keys(sa.chars.player.clips).length === Object.keys(cur.chars.player.clips).length && Object.keys(sa.chars.keeper.clips).length === Object.keys(cur.chars.keeper.clips).length, "same clip list");
const dh = sa.standH / cur.standH - 1;
check(Math.abs(dh) <= 0.05, `standing height ${sa.standH.toFixed(1)} px vs ${cur.standH.toFixed(1)} px (${(dh * 100).toFixed(1)}%)`);
for (const f of [sa.atlas.color, sa.atlas.mask, sa.atlases["1"].color, sa.atlases["1"].mask]) check(fs.existsSync(D + f) && /a\.(webp|png)$/.test(f), `${f}: a Style A file`);
check(cur.atlas.color === "atlas-0.webp" && cur.atlases["1"].color === "atlas-1.webp", "the current index still points at the current atlases");

if (problems.length) { console.log("FAIL\n  " + problems.join("\n  ")); process.exit(1); }
console.log(`spritesStyleA: ${clips} clips, ${cells} cells, every fps/frame/facing/loop/strike the same; standing height ${sa.standH.toFixed(1)} vs ${cur.standH.toFixed(1)} px (${(dh * 100).toFixed(1)}%); Style A default, Classic keeps Current`);
