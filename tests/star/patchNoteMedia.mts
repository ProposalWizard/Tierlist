/**
 * tests/star/patchNoteMedia.mts — patch-note pictures in Cloudflare R2
 * (22 Oct 2026): the file route's choice (signed R2 link, or the bundled
 * copy), the move's skip-by-size and resume, and the 🔔 Inbox's small
 * headlines list. Fakes only: never R2, never the network.
 */
import fs from "node:fs";
import path from "node:path";
import {
  MEDIA_TYPES, decideServe, isMediaRel, isSafeRel, keyOf, planUploads, runBatch, signedGet,
  type LocalFile, type MigrateDeps, type ServeDeps,
} from "@/lib/patchNoteMedia";
import type { ListedObject, R2Config } from "@/lib/marketing/r2";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { patchAuthor } from "@/lib/teamRoom/extras";
// @ts-expect-error a plain .mjs script, no types
import { authorOf, headlinesFrom, render, HEADLINES } from "../../scripts/patch-notes/build-headlines.mjs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const SECRET = "s3cr3t-NEVER-SHOWN-0123456789abcdef";
const cfg: R2Config = { accountId: "0123456789abcdef0123456789abcdef", accessKeyId: "AKIDTEST", secret: SECRET, bucket: "kib-marketing" };

console.log("Which files move");
{
  ok(isMediaRel("pages/0.95h/img/a.jpg") && isMediaRel("mikey/v0.3/clip.MP4") && isMediaRel("x.webp"), "pictures and clips move");
  ok(!isMediaRel("pages/0.95h/index.html") && !isMediaRel("a.css") && !isMediaRel("a.svg"), "pages, styles and drawings stay in the code");
  ok(isSafeRel("pages/0.95h/img/goal 1 (b).jpg"), "a normal path is safe");
  for (const bad of ["../.env.local", "pages/../../x.jpg", "/etc/x.jpg", "pages//x.jpg", "a\\b.jpg", "pages/./x.jpg", "x\0.jpg", ""]) ok(!isSafeRel(bad), `refused: ${JSON.stringify(bad)}`);
  ok(Object.keys(MEDIA_TYPES).length === 6, "six media types");
}

console.log("Serving: R2 when it has the file, the bundled copy when not");
{
  const local = new Map<string, Buffer>([["pages/0.95h/a.jpg", Buffer.from("AAA")], ["pages/0.95h/s.css", Buffer.from("css")]]);
  let asked = 0;
  const deps = (r2: Set<string> | null | "throws"): ServeDeps => ({
    async inR2(rel) { asked++; if (r2 === "throws") throw new Error("down"); return r2 ? r2.has(rel) : null; },
    link: (rel) => `https://signed.example/${rel}`,
    async readLocal(rel) { return local.get(rel) ?? null; },
  });
  let d = await decideServe("pages/0.95h/a.jpg", deps(new Set(["pages/0.95h/a.jpg"])));
  ok(d.kind === "redirect" && d.url === "https://signed.example/pages/0.95h/a.jpg", "in R2 → a signed link");
  d = await decideServe("pages/0.95h/a.jpg", deps(new Set()));
  ok(d.kind === "local" && d.body.toString() === "AAA", "not moved yet → the bundled file (nothing breaks mid-move)");
  d = await decideServe("pages/0.95h/a.jpg", deps(null));
  ok(d.kind === "local", "R2 not connected (local dev) → the bundled file");
  d = await decideServe("pages/0.95h/a.jpg", deps("throws"));
  ok(d.kind === "local", "R2 down → the bundled file, never an error page");
  asked = 0;
  d = await decideServe("pages/0.95h/s.css", deps(new Set(["pages/0.95h/s.css"])));
  ok(d.kind === "local" && asked === 0, "a stylesheet never goes to R2");
  asked = 0;
  d = await decideServe("../secret.jpg", deps(new Set(["../secret.jpg"])));
  ok(d.kind === "missing" && asked === 0, "a path that climbs out never reaches R2");
  d = await decideServe("pages/9.99/gone.jpg", deps(new Set()));
  ok(d.kind === "missing", "in neither place → missing (404)");
  d = await decideServe("pages/9.99/gone.jpg", deps(new Set(["pages/9.99/gone.jpg"])));
  ok(d.kind === "redirect", "after the follow-up (no bundled copy) R2 still serves it");
}

console.log("The signed link");
{
  const a = signedGet(cfg, "pages/0.95h/img/goal.jpg", new Date("2026-10-22T10:05:00Z"));
  const b = signedGet(cfg, "pages/0.95h/img/goal.jpg", new Date("2026-10-22T10:55:00Z"));
  const c = signedGet(cfg, "pages/0.95h/img/goal.jpg", new Date("2026-10-22T11:01:00Z"));
  ok(a.startsWith("https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/kib-marketing/patch-notes/pages/0.95h/img/goal.jpg?"), "points at patch-notes/<path> in the bucket");
  ok(a === b, "the same link all hour (the browser keeps its copy)");
  ok(a !== c, "a new link the next hour");
  ok(/X-Amz-Expires=7200/.test(a) && /X-Amz-Date=20261022T100000Z/.test(a), "signed from the hour, good for two (so at least one hour left)");
  ok(/response-content-type=image%2Fjpeg/.test(a), "answers as a picture");
  ok(!a.includes(SECRET), "the secret is never in the link");
}

console.log("The move: skip by size, batches, resume");
{
  const local: LocalFile[] = [
    { rel: "pages/0.95h/a.jpg", size: 3 }, { rel: "pages/0.95h/b.png", size: 4 }, { rel: "pages/0.96h/c.mp4", size: 5 },
    { rel: "pages/0.96h/d.jpg", size: 6 }, { rel: "pages/0.96h/index.html", size: 9 },
  ];
  const remote: ListedObject[] = [
    { key: keyOf("pages/0.95h/a.jpg"), size: 3, modified: "" },   // same size: skip
    { key: keyOf("pages/0.95h/b.png"), size: 1, modified: "" },   // different size: copy again
    { key: "videos/inbox/x.mp4", size: 5, modified: "" },          // Marketing's own files: ignored
  ];
  const plan = planUploads(local, remote);
  ok(plan.done.map((f) => f.rel).join() === "pages/0.95h/a.jpg", "already there at the same size → skipped");
  ok(plan.todo.map((f) => f.rel).join() === "pages/0.95h/b.png,pages/0.96h/c.mp4,pages/0.96h/d.jpg", "a different size or missing → copied; the page is not");

  // A bucket in memory, and a clock that moves 10 ms per upload.
  const bucket = new Map<string, { size: number; type: string }>(remote.map((o) => [o.key, { size: o.size, type: "" }]));
  let t = 0;
  const files = new Map(local.map((f) => [f.rel, Buffer.alloc(f.size, 1)]));
  const deps: MigrateDeps = {
    async listLocal() { return local; },
    async listRemote() { return Array.from(bucket.entries()).map(([key, o]) => ({ key, size: o.size, modified: "" })); },
    async readLocal(rel) { return files.get(rel) ?? null; },
    async put(key, body, type) { t += 10; bucket.set(key, { size: body.length, type }); },
    clock: () => t,
  };
  const first = await runBatch(deps, { budgetMs: 15, maxFiles: 50, parallel: 1 });
  ok(first.uploaded === 2 && !first.finished, "the time budget stops a batch part way");
  ok(first.totalFiles === 4 && first.doneFiles === 3, `progress counts media only (${first.doneFiles} of ${first.totalFiles})`);
  const second = await runBatch(deps, { budgetMs: 1000, maxFiles: 50, parallel: 3 });
  ok(second.uploaded === 1 && second.finished && second.doneFiles === 4, "pressing again carries on and finishes");
  ok(second.doneBytes === 3 + 4 + 5 + 6, "bytes add up");
  ok(bucket.get(keyOf("pages/0.96h/c.mp4"))?.type === "video/mp4" && bucket.get(keyOf("pages/0.95h/b.png"))?.size === 4, "right type, right size in the bucket");
  const third = await runBatch(deps);
  ok(third.uploaded === 0 && third.finished && third.failed.length === 0, "a third press copies nothing");

  // A file that cannot be read is reported, not retried for ever in one batch.
  files.delete("pages/0.96h/d.jpg");
  bucket.delete(keyOf("pages/0.96h/d.jpg"));
  const broken = await runBatch(deps);
  ok(broken.uploaded === 0 && broken.failed.length === 1 && broken.failed[0].rel === "pages/0.96h/d.jpg" && !broken.finished, "an unreadable file is listed as failed");
  ok(!JSON.stringify(broken).includes(SECRET), "no secret in what the page gets");

  // A put that throws is a failure too, and the rest still go.
  bucket.clear(); files.set("pages/0.96h/d.jpg", Buffer.alloc(6, 1));
  const flaky: MigrateDeps = { ...deps, async put(key, body, type) { if (key.endsWith("b.png")) throw new Error("Storage answered 500 to a PUT."); return deps.put(key, body, type); } };
  const f = await runBatch(flaky, { budgetMs: 1e9, maxFiles: 50, parallel: 2 });
  ok(f.uploaded === 3 && f.failed.length === 1 && f.failed[0].error.includes("500"), "one failed upload does not stop the others");
}

console.log("The 🔔 Inbox's headlines");
{
  const want = render(headlinesFrom(BUILT_IN_PATCH_NOTES));
  const have = fs.readFileSync(path.join(process.cwd(), HEADLINES), "utf8");
  ok(want === have, `${HEADLINES} matches lib/patchNotesData.ts (else: node scripts/patch-notes/build-headlines.mjs)`);
  ok(BUILT_IN_PATCH_NOTES.every((n) => authorOf(n.title) === patchAuthor(n.title)), "the author rule is the Team room's");
  const bytes = Buffer.byteLength(have);
  ok(bytes < 60_000, `small: ${(bytes / 1024).toFixed(1)} KB (the full notes are ${(fs.statSync(path.join(process.cwd(), "lib/patchNotesData.ts")).size / 1024).toFixed(0)} KB)`);
  const bell = fs.readFileSync(path.join(process.cwd(), "components/teamRoom/InboxBell.tsx"), "utf8");
  ok(!/patchNotesData/.test(bell.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "the bell no longer imports the full notes");
}

console.log(failed ? `\n${failed} FAILED` : "\nAll patch-note media checks passed.");
process.exit(failed ? 1 : 0);
