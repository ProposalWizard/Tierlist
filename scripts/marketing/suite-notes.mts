/**
 * scripts/marketing/suite-notes.mts — Claude's side of the Studio's editing suite (skill suite-inbox).
 *
 * Reads and writes the same storage the page does: Cloudflare R2 when R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY and R2_BUCKET are set in this chat's environment; otherwise (development) the local copies
 * (MARKETING_LOCAL_DIR / MARKETING_DEV_NOTES_DIR). Never prints a key's secret or a signed link.
 *
 *   npx tsx scripts/marketing/suite-notes.mts inbox                         every cut with work waiting
 *   npx tsx scripts/marketing/suite-notes.mts show <key>                    one cut: notes, edits, presses
 *   npx tsx scripts/marketing/suite-notes.mts applied <key> <edit id>...    mark edits done (ends a lock)
 *   npx tsx scripts/marketing/suite-notes.mts undone <key> <edit id>...     mark an undo done
 *   npx tsx scripts/marketing/suite-notes.mts request <key> <id> done|failed [reason]
 *   npx tsx scripts/marketing/suite-notes.mts render <key> <pct> "<step>" [--status queued|rendering|done|failed] [--eta "2 min"] [--url /admin/...] [--ids e-..,e-..]
 *   npx tsx scripts/marketing/suite-notes.mts add-render <key> <new video key> [--cuts N]
 *   npx tsx scripts/marketing/suite-notes.mts put-side <key> <folder>       upload studio-prep.py's files beside the video
 */
import fs from "node:fs";
import path from "node:path";
import { getStorage } from "@/lib/marketing/storage";
import { NOTES_SUFFIX, r2Url } from "@/lib/marketing/r2";
import { readCut, suiteKey, type CutFile } from "@/lib/studio/store";
import { RENDER_STATUSES, tc, type RenderStatus } from "@/lib/studio/schema";

const store = getStorage();
const [cmd, key, ...rest] = process.argv.slice(2);
const die = (m: string) => { console.error(`suite-notes: ${m}`); process.exit(1); };
const flag = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const now = () => new Date().toISOString();
if (store.mode === "off") die(`storage not connected here (missing: ${(store.missing ?? []).join(", ")}). Ask Harry to add the R2 settings to this chat's environment, or paste the page's text.`);

async function write(k: string, cut: CutFile) {
  await store.putText(suiteKey(k), JSON.stringify({ v: 1, ...cut }, null, 1) + "\n");
}
function needKey() {
  if (!key || !store.isMediaKey(key)) die("give a video key (from `inbox`).");
  return key!;
}
function describe(k: string, c: CutFile): string {
  const out = [`${c.review.concept || k}`, `  key: ${k}`];
  out.push(`  EDITS FOR CLAUDE (${c.edits.edits.length})`);
  for (const e of c.edits.edits) {
    const when = e.start === undefined ? "whole video" : `${tc(e.start)}${e.end !== undefined && e.end - e.start >= 0.15 ? ` to ${tc(e.end)}` : ""}`;
    out.push(`   #${e.n} [${e.type}] ${when}: ${e.text || "(cut)"}  id=${e.id ?? "-"} status=${e.status ?? (e.locked_at ? "locked" : "open")}${e.edited_at ? " EDITED" : ""}${e.element ? ` element=${JSON.stringify(e.element)}` : ""}${e.qc ? ` from ${e.qc.kind} ${e.qc.id}` : ""}`);
  }
  out.push(`  REVIEW NOTES (${c.review.comments.length})`);
  for (const n of c.review.comments) out.push(`   #${n.n} [${n.tag}] ${tc(n.start)}${n.end - n.start >= 0.2 ? ` to ${tc(n.end)}` : ""}: ${n.note}${n.author ? ` (${n.author})` : ""}`);
  const pending = c.requests.filter((r) => r.status === "pending");
  out.push(`  PRESSES WAITING (${pending.length})`);
  for (const r of pending) out.push(`   ${r.id} ${r.type === "render_all" ? "DONE: RENDER ALL" : r.type === "render_one" ? "LOCK & RENDER" : "saved edits (collect only)"} · ${r.count} edit(s)${r.ids?.length ? ` ids=${r.ids.join(",")}` : ""} · ${r.created}`);
  if (c.render) out.push(`  RENDER ${c.render.status} ${c.render.pct}% ${c.render.step}`);
  return out.join("\n");
}

if (cmd === "inbox") {
  const objs = await store.list(store.mode === "r2" ? "videos/" : "");
  const keys = store.mode === "r2"
    ? objs.filter((o) => o.key.endsWith(NOTES_SUFFIX)).map((o) => o.key.slice(0, -NOTES_SUFFIX.length))
    : (await Promise.all(objs.map(async (o) => ((await store.head(o.key + NOTES_SUFFIX)) ? o.key : null)))).filter((x): x is string => !!x);
  let any = 0;
  for (const k of keys) {
    const c = await readCut(store, k);
    const open = c.edits.edits.filter((e) => e.status !== "applied" && e.status !== "undone");
    const waiting = c.requests.filter((r) => r.status === "pending");
    if (!open.length && !waiting.length) continue;
    any++;
    console.log(describe(k, c) + "\n");
  }
  if (!any) console.log(`Nothing waiting (${keys.length} cut(s) with notes).`);
} else if (cmd === "show") {
  const k = needKey();
  console.log(describe(k, await readCut(store, k)));
} else if (cmd === "applied" || cmd === "undone") {
  const k = needKey();
  const ids = rest.filter((x) => !x.startsWith("--"));
  const c = await readCut(store, k);
  let n = 0;
  c.edits.edits = c.edits.edits.map((e) => {
    if (!e.id || !ids.includes(e.id)) return e;
    n++;
    const { locked_at: _l, ...r } = e; void _l;
    return cmd === "applied" ? { ...r, status: "applied" as const, applied_at: now() } : { ...r, status: "undone" as const };
  });
  // A press whose edits are all dealt with is done.
  c.requests = c.requests.map((q) => (q.status === "pending" && q.ids?.length && q.ids.every((id) => c.edits.edits.find((e) => e.id === id)?.status === "applied" || c.edits.edits.find((e) => e.id === id)?.status === "undone") ? { ...q, status: "done" as const, done_at: now() } : q));
  await write(k, c);
  console.log(`${n} edit(s) marked ${cmd}.`);
} else if (cmd === "request") {
  const k = needKey();
  const [id, state, ...why] = rest;
  if (state !== "done" && state !== "failed") die("request <key> <id> done|failed [reason]");
  const c = await readCut(store, k);
  c.requests = c.requests.map((q) => (q.id === id ? { ...q, status: state, done_at: now(), ...(why.length ? { reason: why.join(" ") } : {}) } : q));
  await write(k, c);
  console.log(`request ${id} → ${state}`);
} else if (cmd === "render") {
  const k = needKey();
  const [pct, step] = rest;
  const status = (flag("status") ?? "rendering") as RenderStatus;
  if (!(RENDER_STATUSES as readonly string[]).includes(status)) die("--status queued|rendering|done|failed");
  const c = await readCut(store, k);
  c.render = { status, pct: Math.max(0, Math.min(100, Number(pct) || 0)), step: step ?? "", eta: flag("eta") ?? "", version_url: flag("url") ?? "", at: now(), ids: (flag("ids") ?? "").split(",").filter(Boolean) };
  await write(k, c);
  console.log(`render ${status} ${c.render.pct}%`);
} else if (cmd === "add-render") {
  const k = needKey();
  const nk = rest[0];
  if (!nk || !store.isMediaKey(nk)) die("add-render <key> <new video key> (upload the new version first)");
  const c = await readCut(store, k);
  c.edits.renders = [...c.edits.renders, { key: nk, created: now(), cuts: Number(flag("cuts") ?? 0) || 0 }];
  await write(k, c);
  console.log(`render ${c.edits.renders.length} added: it shows as "Render ${c.edits.renders.length}" under the video.`);
} else if (cmd === "put-side") {
  const k = needKey();
  const dir = rest[0];
  if (!dir || !fs.existsSync(dir)) die("put-side <key> <folder from studio-prep.py>");
  const name = k.replace(/[^A-Za-z0-9._-]/g, "_");
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(name + "."));
  if (store.mode !== "r2" || !store.config) die("put-side needs R2 (in development, point MARKETING_DEV_NOTES_DIR at the folder instead).");
  for (const f of files) {
    const suffix = f.slice(name.length);
    if (!/^\.(qc\.json|lanes\.json|peaks\.json|strip\.jpg|voice\.mp4|music\.mp4|sfx\.mp4)$/.test(suffix)) continue;
    const body = fs.readFileSync(path.join(dir, f));
    const url = r2Url(store.config!, "PUT", k + suffix, new Date(), 300, { headers: { "content-length": String(body.length) } });
    const res = await fetch(url, { method: "PUT", body, headers: { "content-length": String(body.length) } });
    console.log(`${res.ok ? "put" : `FAILED (${res.status})`} ${suffix} (${Math.round(body.length / 1024)} KB)`);
  }
} else {
  console.log("commands: inbox · show <key> · applied <key> <ids> · undone <key> <ids> · request <key> <id> done|failed · render <key> <pct> <step> · add-render <key> <new key> · put-side <key> <folder>");
}
