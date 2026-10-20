/**
 * scripts/live-watch.mts — the Claude side of "Live share (test)" (Admin →
 * Videos; the idea: lib/liveShare.ts). Harry, 20 Oct 2026: "Claude can be
 * given that link, see what you're seeing in real time, and hear what you're
 * saying … it talks back to you in the terminal".
 *
 *   npx tsx scripts/live-watch.mts K7Q2XM
 *   npx tsx scripts/live-watch.mts https://knowitball.co.uk/admin/videos/live/K7Q2XM
 *
 * Every 2 s it reads the share's state from public storage. It prints:
 *   SAID   each new thing the person said, with the picture on screen then;
 *   SCREEN one line per batch of new pictures, "new screen" / "part changed"
 *          / "small change" with how much moved (small ones at most every 30 s),
 * and saves the newest picture to <out>/latest.jpg. A Claude chat runs it in
 * the background, reads the output, looks at the picture files and answers in
 * the chat, also by itself when a SCREEN line shows something worth saying
 * (Harry, 20 Oct 2026: "it can kind of reply to you without you having to say
 * something"). It stops by itself when the share ends.
 *
 * Options:
 *   --out <dir>        where pictures go (default: <tmp>/kib-live/<code>)
 *   --every <seconds>  how often to look (default 2)
 *   --pictures all     a SCREEN line for every batch, small changes too
 *   --base <url>       where the files are read from (default: the site's
 *                      public storage; a local dev copy uses
 *                      http://localhost:3066/api/admin/live-share/files)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { changeKind, clock, describeBatch, frameName, isOver, linesAfter, livePath, parseLiveCode, type LiveLine, type LiveState } from "../lib/liveShare";

const SUPABASE_URL = "https://cagkgfketucousksgtbk.supabase.co";
const KEEP_LOCAL = 60;

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const code = parseLiveCode(args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--")));
if (!code) {
  console.error("Give the live share code, e.g. npx tsx scripts/live-watch.mts K7Q2XM");
  process.exit(1);
}
const base = (opt("base") ?? `${env("NEXT_PUBLIC_SUPABASE_URL") || SUPABASE_URL}/storage/v1/object/public/tierlist-images`).replace(/\/$/, "");
const out = path.resolve(opt("out") ?? path.join(os.tmpdir(), "kib-live", code));
const everyMs = Math.max(1000, Number(opt("every") ?? 2) * 1000);
const allPictures = opt("pictures") === "all";
mkdirSync(out, { recursive: true });
const latest = path.join(out, "latest.jpg");
const transcriptFile = path.join(out, "transcript.txt");

const url = (file: string) => `${base}/${livePath(code, file)}?t=${Date.now()}`;
async function getJson<T>(file: string): Promise<T | null> {
  try {
    const r = await fetch(url(file), { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

let lostSince = 0, printedUpTo = 0, seenFrame = 0, seenLine = 0, lastLineCount = -1, lastPrintedPicture = 0, waitingSaid = false, started = false;
const watchFrom = Date.now();
let latestLocal: string | null = null;

async function savePicture(n: number): Promise<string | null> {
  try {
    const r = await fetch(url(frameName(n)), { cache: "no-store" });
    if (!r.ok) return null;
    const file = path.join(out, `frame-${String(n).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    copyFileSync(file, latest);
    const old = readdirSync(out).filter((f) => /^frame-\d{6}\.jpg$/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - KEEP_LOCAL))) rmSync(path.join(out, f), { force: true });
    return file;
  } catch { return null; }
}

const say = (s: string) => console.log(s);
say(`LIVE SHARE ${code}: watching every ${everyMs / 1000} s. Newest picture: ${latest}`);
say(`(SAID = what was said, with the picture on screen then. SCREEN = what changed on screen. Transcript also in ${transcriptFile})`);

async function poll(): Promise<boolean> {
  const state = await getJson<LiveState>("state.json");
  if (!state) {
    if (started) {
      // A missed read mid-share is a blip; a minute of them means it's gone.
      if (!lostSince) lostSince = Date.now();
      if (Date.now() - lostSince > 60_000) { say("LOST: the share can't be read any more (deleted, or the connection dropped)."); return false; }
      return true;
    }
    if (!waitingSaid) { say("WAITING: nothing shared yet. It starts when Start live share is pressed and a screen is picked."); waitingSaid = true; }
    return Date.now() - watchFrom < 15 * 60 * 1000;
  }
  lostSince = 0;
  if (!started) {
    say(`STARTED: ${state.who || "someone"} is sharing (began ${clock(Date.now() - state.startedAt)} ago). Voice: ${state.voice}.`);
    started = true;
  }

  if (state.lastFrame > seenFrame) {
    const file = await savePicture(state.lastFrame);
    if (file) {
      seenFrame = state.lastFrame;
      latestLocal = file;
      const now = Date.now();
      // One "what changed" line per batch: always when part or all of the
      // screen changed (Claude may want to speak up), small changes at most
      // every 30 s so a moving game doesn't flood the chat.
      const batch = (state.recent ?? []).filter((x) => x.n > printedUpTo);
      const big = batch.length ? Math.max(...batch.map((x) => x.change)) : 1;
      if (allPictures || changeKind(big) !== "small change" || now - lastPrintedPicture >= 30_000) {
        const what = batch.length ? describeBatch(batch, state.startedAt) : `picture ${state.lastFrame}`;
        say(`SCREEN ${what}. Newest is picture ${state.lastFrame}, on screen ${((now - state.lastFrameAt) / 1000).toFixed(1)} s ago → ${file}`);
        lastPrintedPicture = now;
        printedUpTo = state.lastFrame;
      }
    }
  }

  if (state.lines !== lastLineCount) {
    const lines = state.lines === 0 ? [] : await getJson<LiveLine[]>("transcript.json");
    if (lines) {
      lastLineCount = state.lines;
      for (const l of linesAfter(lines, seenLine)) {
        seenLine = l.n;
        const lag = ((Date.now() - (state.startedAt + l.at)) / 1000).toFixed(1);
        say(`SAID [${clock(l.at)}]${l.by === "typed" ? " (typed)" : ""} "${l.text}" (${lag} s ago) → picture ${latestLocal ?? "none yet"}`);
        appendFileSync(transcriptFile, `[${clock(l.at)}] ${l.text}\n`);
      }
    }
  }

  if (isOver(state, Date.now())) {
    say(`ENDED: ${state.stoppedAt ? "Stop was pressed" : "its 30 minutes ran out"}. ${state.lastFrame} pictures, ${seenLine} lines. Pictures kept in ${out}.`);
    return false;
  }
  return true;
}

for (;;) {
  const go = await poll();
  if (!go) break;
  await new Promise((r) => setTimeout(r, everyMs));
}
