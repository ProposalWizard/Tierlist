/**
 * scripts/perf-report.mts — the speed recorder's samples, in the terminal (27 Nov 2026).
 *
 *   npx tsx scripts/perf-report.mts                       # the last 24 h
 *   npx tsx scripts/perf-report.mts --since 3h            # the last 3 hours (m, h, d)
 *   npx tsx scripts/perf-report.mts --device S20          # one phone (device, GPU or browser contains it)
 *   npx tsx scripts/perf-report.mts --place garden        # one 3D place
 *   npx tsx scripts/perf-report.mts --screen match        # one screen
 *   npx tsx scripts/perf-report.mts --slow                # also the 10 slowest samples, with what was tapped
 *   npx tsx scripts/perf-report.mts --file rows.json      # a saved export instead of the table
 *
 * Prints, per screen and 3D place × device: samples, median fps, the worst 5% frame (the 95th
 * percentile of each sample's slowest frame), median draws, median pixel ratio, and the quality rungs
 * seen. The table (supabase/migrations/star_perf_samples.sql) is admin-read, so this needs
 * SUPABASE_SERVICE_ROLE_KEY in .env.local (or the environment). It never writes anything.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface Row {
  created_at?: string; sampled_at: string; session_id: string; reason: string;
  page: string; screen: string; nav: string | null; place: string | null; loading: string | null;
  actions: { t: number; k: string; v: string }[] | null;
  source: string; fps: number | null; worst_ms: number | null; draws: number | null; tris: number | null;
  pixel_ratio: number | null; px_cap: number | null; res_scale: number | null; quality_rung: number | null; quality_tier: string | null;
  gpu: string | null; gpu_class: string | null; device: string | null; browser: string | null; os: string | null;
  dpr: number | null; app_version: string | null;
}

/** Short names for phones people say out loud. A Galaxy S20 reports "SM-G98…". */
const DEVICE_ALIASES: Record<string, string[]> = {
  s20: ["sm-g980", "sm-g981", "sm-g985", "sm-g986", "sm-g988", "mali-g77", "adreno (tm) 650"],
  s21: ["sm-g991", "sm-g996", "sm-g998"], s22: ["sm-s901", "sm-s906", "sm-s908"], s23: ["sm-s911", "sm-s916", "sm-s918"],
  iphone: ["iphone", "apple gpu"],
};

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

export function parseSince(s: string): number {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*([mhd])$/i);
  if (!m) throw new Error(`--since wants a number and m, h or d (e.g. 24h), not "${s}"`);
  return Number(m[1]) * ({ m: 60_000, h: 3_600_000, d: 86_400_000 } as const)[m[2].toLowerCase() as "m" | "h" | "d"];
}

export function deviceMatches(r: Row, want: string): boolean {
  const hay = [r.device, r.gpu, r.browser, r.os].filter(Boolean).join(" ").toLowerCase();
  const w = want.toLowerCase();
  return hay.includes(w) || (DEVICE_ALIASES[w] ?? []).some((a) => hay.includes(a));
}

/** The device a row is grouped under: model, or GPU when the model is a generic word. */
export function deviceName(r: Row): string {
  const generic = !r.device || /^(Android phone|phone|computer|iPhone|iPad)$/.test(r.device);
  const gpu = (r.gpu ?? "").replace(/^ANGLE \(([^,]+), ([^,]+).*$/, "$2").replace(/\s*\(TM\)\s*/gi, " ").trim();
  return (generic && gpu ? `${r.device ?? "?"} · ${gpu}` : r.device ?? "?").slice(0, 34);
}

const pct = (a: number[], p: number) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p + 0.5))]; };

export interface Group { screen: string; place: string; device: string; n: number; fps: number | null; worst95: number | null; draws: number | null; px: number | null; rungs: string; sessions: number }

export function summarise(rows: Row[]): Group[] {
  const by = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.screen}\u0000${r.place ?? "-"}\u0000${deviceName(r)}`;
    (by.get(k) ?? by.set(k, []).get(k)!).push(r);
  }
  const out: Group[] = [];
  for (const [k, rs] of by) {
    const [screen, place, device] = k.split("\u0000");
    const nums = (f: (r: Row) => number | null) => rs.map(f).filter((x): x is number => typeof x === "number");
    const rungs = Array.from(new Set(nums((r) => r.quality_rung))).sort().join(",");
    out.push({
      screen, place, device, n: rs.length,
      fps: pct(nums((r) => r.fps), 0.5), worst95: pct(nums((r) => r.worst_ms), 0.95),
      draws: pct(nums((r) => r.draws), 0.5), px: pct(nums((r) => r.pixel_ratio ?? r.dpr), 0.5),
      rungs: rungs || "-", sessions: new Set(rs.map((r) => r.session_id)).size,
    });
  }
  return out.sort((a, b) => (a.fps ?? 999) - (b.fps ?? 999) || b.n - a.n);
}

async function fromTable(sinceMs: number): Promise<Row[]> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (.env.local).");
  if (!key) throw new Error("the samples are admin-read: put SUPABASE_SERVICE_ROLE_KEY in .env.local (or run with it set) to read them here. The anon key cannot read this table.");
  const from = new Date(Date.now() - sinceMs).toISOString();
  const rows: Row[] = [];
  for (let off = 0; off < 50_000; off += 1000) {
    const res = await fetch(`${url}/rest/v1/star_perf_samples?select=*&created_at=gte.${encodeURIComponent(from)}&order=created_at.asc&limit=1000&offset=${off}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.status === 404) throw new Error("the table star_perf_samples does not exist yet: run supabase/migrations/star_perf_samples.sql in the Supabase SQL Editor.");
    if (!res.ok) throw new Error(`Supabase said ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const page = (await res.json()) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const f0 = (x: number | null) => (x === null ? "-" : x.toFixed(0));
const f2 = (x: number | null) => (x === null ? "-" : x.toFixed(2));
const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const lpad = (s: string, n: number) => (s.length >= n ? s : " ".repeat(n - s.length) + s);

export function report(rows: Row[], o: { slow?: boolean; label: string }): string {
  const lines: string[] = [];
  const sessions = new Set(rows.map((r) => r.session_id)).size;
  const versions = Array.from(new Set(rows.map((r) => r.app_version).filter(Boolean))).slice(0, 4).join(", ") || "?";
  lines.push(`Speed samples ${o.label}: ${rows.length} samples, ${sessions} sessions, builds ${versions}`);
  if (!rows.length) { lines.push("Nothing recorded in that window."); return lines.join("\n"); }
  lines.push("");
  lines.push(`${pad("screen", 22)} ${pad("place", 9)} ${pad("device", 34)} ${lpad("n", 5)} ${lpad("fps", 5)} ${lpad("worst5%", 8)} ${lpad("draws", 6)} ${lpad("px", 5)}  rungs`);
  for (const g of summarise(rows)) {
    lines.push(`${pad(g.screen, 22)} ${pad(g.place, 9)} ${pad(g.device, 34)} ${lpad(String(g.n), 5)} ${lpad(f0(g.fps), 5)} ${lpad(g.worst95 === null ? "-" : `${f0(g.worst95)}ms`, 8)} ${lpad(f0(g.draws), 6)} ${lpad(f2(g.px), 5)}  ${g.rungs}`);
  }
  lines.push("");
  lines.push("fps = median of the samples · worst5% = 95th percentile of each sample's slowest frame · px = median pixel ratio drawn · rungs = quality rungs seen (0 top).");
  if (o.slow) {
    lines.push("", "The 10 slowest samples (lowest fps), with what was done just before:");
    for (const r of rows.filter((r) => typeof r.fps === "number").sort((a, b) => (a.fps ?? 0) - (b.fps ?? 0)).slice(0, 10)) {
      const acts = (r.actions ?? []).map((a) => `${a.k}:${a.v}`).join(" > ") || "-";
      lines.push(`  ${r.sampled_at.slice(5, 19).replace("T", " ")}  ${f0(r.fps)} fps worst ${f0(r.worst_ms)}ms  ${r.screen}/${r.place ?? "-"}${r.loading ? ` loading ${r.loading}` : ""}  ${deviceName(r)}  ${acts}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const since = opt("--since") ?? "24h";
  const sinceMs = parseSince(since);
  const file = opt("--file");
  let rows = file ? (JSON.parse(readFileSync(file, "utf8")) as Row[]) : await fromTable(sinceMs);
  if (file) { const from = Date.now() - sinceMs; rows = rows.filter((r) => Date.parse(r.created_at ?? r.sampled_at) >= from || opt("--since") === undefined); }
  const device = opt("--device"), place = opt("--place"), screen = opt("--screen");
  if (device) rows = rows.filter((r) => deviceMatches(r, device));
  if (place) rows = rows.filter((r) => (r.place ?? "") === place);
  if (screen) rows = rows.filter((r) => r.screen.includes(screen));
  const label = [`since ${since}`, device && `device ${device}`, place && `place ${place}`, screen && `screen ${screen}`].filter(Boolean).join(", ");
  console.log(report(rows, { slow: args.includes("--slow"), label: `(${label})` }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => { console.error(`perf-report: ${e instanceof Error ? e.message : e}`); process.exit(1); });
}
