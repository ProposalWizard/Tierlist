/**
 * tests/star/marketingStorage.mts — Marketing slice 2 (22 Oct 2026): the
 * upload link route's caps and sign-in, the signing against AWS's own
 * published example, the bucket listing, and the editing suite's notes.
 * Fakes only: never R2, never the network.
 */
import {
  CAPS, checkUpload, isVideoKey, itemsFromList, ledgerKey, ledgerPrefix, notesKeyFor, parseList, presign, r2ConfigFrom,
  safeName, ukDay, uploadUrl, usedToday, videoKey, type ListedObject, type R2Config,
} from "@/lib/marketing/r2";
import { askUpload, listMedia, uploadDone, type Caller, type Storage } from "@/lib/marketing/mediaApi";
import { addRequest, readCut, readCutView, saveComments, saveEditList, saveQcAnswer, suiteKey } from "@/lib/studio/store";
import { parseEditList, keepSegments, tc } from "@/lib/studio/schema";
import { parseQc } from "@/lib/studio/qc";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

const SECRET = "s3cr3t-NEVER-SHOWN-0123456789abcdef";
const cfg: R2Config = { accountId: "0123456789abcdef0123456789abcdef", accessKeyId: "AKIDTEST", secret: SECRET, bucket: "kib-marketing" };
const NOW = new Date("2026-10-22T09:30:00Z");

/** A bucket in memory. */
function fakeStore(mode: Storage["mode"] = "r2"): Storage & { objects: Map<string, { body: string; size: number }> } {
  const objects = new Map<string, { body: string; size: number }>();
  return {
    mode, config: mode === "r2" ? cfg : undefined, objects, isMediaKey: isVideoKey,
    async list(prefix) { return Array.from(objects.entries()).filter(([k]) => k.startsWith(prefix)).map(([key, o]) => ({ key, size: o.size, modified: NOW.toISOString() })); },
    async head(key) { const o = objects.get(key); return o ? { size: o.size } : null; },
    async getText(key) { return objects.get(key)?.body ?? null; },
    async putText(key, body) { objects.set(key, { body, size: body.length }); },
    async remove(key) { objects.delete(key); },
  };
}
const admin: Caller = { id: "11111111-aaaa-bbbb-cccc-222222222222", name: "Harry", admin: true };
const player: Caller = { id: "33333333-aaaa-bbbb-cccc-444444444444", name: "Sam", admin: false };
const MB = 1024 * 1024;

console.log("Signing (AWS Signature Version 4)");
{
  // AWS's own published example: "Example: a presigned URL" (S3 docs, query-string auth).
  const url = presign({ method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", now: new Date("2013-05-24T00:00:00Z"), expires: 86400 });
  ok(url.endsWith("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"), "matches AWS's published example signature");
  const put = uploadUrl(cfg, "videos/inbox/20261022-093000-ab12-clip.mp4", 1234, NOW);
  ok(put.startsWith(`https://${cfg.accountId}.r2.cloudflarestorage.com/kib-marketing/videos/inbox/`), "an upload link goes to our R2 bucket");
  ok(/X-Amz-SignedHeaders=content-length%3Bhost/.test(put), "an upload link signs the exact file size (a bigger file is refused by R2)");
  ok(/X-Amz-Expires=900&/.test(put), "an upload link lasts 15 minutes");
  ok(!put.includes(SECRET), "the secret is never in a link");
}

console.log("Settings");
{
  ok(r2ConfigFrom({}).config === null && r2ConfigFrom({}).missing.length === 4, "no settings = not connected, four names missing");
  const full = r2ConfigFrom({ R2_ACCOUNT_ID: cfg.accountId, R2_ACCESS_KEY_ID: "a", R2_SECRET_ACCESS_KEY: "b", R2_BUCKET: "kib-marketing" });
  ok(full.config?.bucket === "kib-marketing", "all four settings = connected");
  ok(r2ConfigFrom({ R2_ACCOUNT_ID: "nope", R2_ACCESS_KEY_ID: "a", R2_SECRET_ACCESS_KEY: "b", R2_BUCKET: "kib-marketing" }).config === null, "a malformed account id is refused");
}

console.log("Keys");
{
  const k = videoKey("v01-patch-0.1-0.3", "My Clip (final).MOV", NOW, "AB12");
  ok(k === "videos/v01-patch-0.1-0.3/20261022-093000-ab12-my-clip-final.mov", "a key: card folder, time stamp, safe name");
  ok(isVideoKey(k) && !isVideoKey("videos/../etc/passwd.mp4") && !isVideoKey(notesKeyFor(k)) && !isVideoKey("ledger/x/y.mp4"), "only real upload keys pass");
  ok(videoKey("../../x", "a.mp4", NOW, "zz99").startsWith("videos/inbox/"), "a bad card id goes to the inbox");
  ok(safeName("....mp4") === "upload", "a name with no letters becomes 'upload'");
  ok(ukDay(new Date("2026-10-21T23:30:00Z")) === "2026-10-22", "the day is UK time (11:30 pm UTC in summer time = next day)");
}

console.log("Caps");
{
  const none = { files: 0, bytes: 0 };
  ok(checkUpload({ name: "a.mp4", size: 10 * MB }, none).ok, "a 10 MB mp4 is fine");
  const big = checkUpload({ name: "a.mp4", size: CAPS.maxFileBytes + 1 }, none);
  ok(!big.ok && big.status === 413, "over 500 MB: refused (413)");
  ok(checkUpload({ name: "a.mp4", size: CAPS.maxFileBytes }, none).ok, "exactly 500 MB: fine");
  const exe = checkUpload({ name: "virus.exe", size: 10 }, none);
  ok(!exe.ok && exe.status === 415, "not a video or picture: refused (415)");
  ok(!checkUpload({ name: "a.html", size: 10 }, none).ok && !checkUpload({ name: "a.svg", size: 10 }, none).ok, "web pages and SVGs are refused (they could run code)");
  const many = checkUpload({ name: "a.mp4", size: 10 }, { files: 30, bytes: 0 });
  ok(!many.ok && many.status === 429, "31st file in a day: refused (429)");
  const heavy = checkUpload({ name: "a.mp4", size: 200 * MB }, { files: 3, bytes: CAPS.dailyBytes - 100 * MB });
  ok(!heavy.ok && heavy.status === 429, "passing 5 GB in a day: refused (429)");
  ok(!checkUpload({ name: "a.mp4", size: 0 }, none).ok && !checkUpload({ name: "a.mp4", size: "9" }, none).ok, "an empty or made-up size is refused");
  ok(usedToday(["ledger/2026-10-22/u/20261022-090000-1000", "ledger/2026-10-22/u/20261022-091000-2000", "junk"]).bytes === 3000, "today's use is read from the ledger keys");
}

console.log("The upload link route");
{
  const s = fakeStore();
  ok((await askUpload(null, { name: "a.mp4", size: 10 }, s, NOW, "ab12")).status === 401, "signed out: 401");
  ok((await askUpload(player, { name: "a.mp4", size: 10 }, s, NOW, "ab12")).status === 403, "signed in but not an admin: 403");
  const off = await askUpload(admin, { name: "a.mp4", size: 10 }, fakeStore("off"), NOW, "ab12");
  ok(off.status === 503 && /not connected/.test(String(off.body.error)), "no storage settings: 503 \"Storage not connected here\"");
  const r = await askUpload(admin, { name: "clip.mp4", size: 20 * MB, folder: "v01-patch-0.1-0.3" }, s, NOW, "ab12");
  ok(r.status === 200 && typeof r.body.url === "string" && String(r.body.key).startsWith("videos/v01-patch-0.1-0.3/"), "an admin gets a link and a key in the card's folder");
  ok(!JSON.stringify(r.body).includes(SECRET), "the reply never carries the secret");
  const ledger = Array.from(s.objects.keys()).filter((k) => k.startsWith(ledgerPrefix(ukDay(NOW), admin!.id)));
  ok(ledger.length === 1 && ledger[0].endsWith(`-${20 * MB}`), "the link is counted in today's ledger (with its size)");
  ok((await askUpload(admin, { name: "a.mp4", size: CAPS.maxFileBytes + 1 }, s, NOW, "ab12")).status === 413, "over 500 MB: 413, nothing counted");
  ok((await askUpload(admin, { name: "a.exe", size: 10 }, s, NOW, "ab12")).status === 415, "wrong type: 415");
  for (let i = 0; i < 29; i++) s.objects.set(ledgerKey(ukDay(NOW), admin!.id, new Date(NOW.getTime() + (i + 1) * 1000), 1), { body: "", size: 0 });
  const cap = await askUpload(admin, { name: "a.mp4", size: 10 }, s, NOW, "ab12");
  ok(cap.status === 429, "the 31st link of the day: 429");
  const other = await askUpload({ ...admin!, id: "99999999-aaaa-bbbb-cccc-000000000000" }, { name: "a.mp4", size: 10 }, s, NOW, "ab12");
  ok(other.status === 200, "the cap is per admin: someone else can still upload");
}

console.log("Upload done");
{
  const s = fakeStore();
  const key = "videos/inbox/20261022-093000-ab12-clip.mp4";
  ok((await uploadDone(admin, { key }, s)).status === 404, "a file that never arrived: 404");
  s.objects.set(key, { body: "", size: CAPS.maxFileBytes + 5 });
  const r = await uploadDone(admin, { key }, s);
  ok(r.status === 413 && !s.objects.has(key), "a file over 500 MB that slipped through is deleted");
  ok((await uploadDone(admin, { key: "ledger/x" }, s)).status === 400, "only upload keys can be checked");
  ok((await uploadDone(player, { key }, s)).status === 403, "not an admin: 403");
}

console.log("The list");
{
  const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>abc&amp;1</NextContinuationToken>
    <Contents><Key>videos/inbox/20261022-093000-ab12-clip.mp4</Key><LastModified>2026-10-22T09:30:01.000Z</LastModified><Size>2048</Size></Contents>
    <Contents><Key>videos/inbox/20261022-093000-ab12-clip.mp4.suite.json</Key><LastModified>2026-10-22T09:40:00.000Z</LastModified><Size>90</Size></Contents>
    <Contents><Key>videos/v02/20261022-100000-cd34-cover.png</Key><LastModified>2026-10-22T10:00:00.000Z</LastModified><Size>10</Size></Contents></ListBucketResult>`;
  const got = parseList(xml);
  ok(got.objects.length === 3 && got.next === "abc&1", "a bucket listing is read, with the next page token");
  const items = itemsFromList(got.objects as ListedObject[]);
  ok(items.length === 2 && items[0].name === "cover.png" && items[1].hasNotes && items[1].name === "clip.mp4", "notes files mark their video; newest first; names without the stamp");
  const s = fakeStore();
  s.objects.set("videos/inbox/20261022-093000-ab12-clip.mp4", { body: "", size: 5 });
  const r = await listMedia(admin, s, NOW);
  ok(r.status === 200 && (r.body.items as unknown[]).length === 1 && r.body.connected === true, "the list route reads the bucket");
  ok((await listMedia(null, s, NOW)).status === 401, "signed out: 401");
  const off = await listMedia(admin, fakeStore("off"), NOW);
  ok(off.body.connected === false && /not connected/.test(String(off.body.message)), "no settings: says Storage not connected here");
}


console.log("The Studio's editing suite (one file beside the video)");
{
  const key = "videos/inbox/20261022-093000-ab12-clip.mp4";
  const s = fakeStore();
  const empty = await readCut(s, key, "v02 · Goalie Mode");
  ok(empty.review.concept === "v02 · Goalie Mode" && empty.review.comments.length === 0 && empty.edits.edits.length === 0, "a cut with no file yet opens empty, with its title");
  const c = await saveComments(s, key, [{ n: 1, start: 3.2, end: 4, tag: "fix", note: "Caption covers the ball" }], "Harry");
  ok(c.ok && c.value[0].author === "Harry" && s.objects.has(suiteKey(key)), "a review note saves beside the video (<key>.suite.json), with who wrote it");
  ok(!(await saveComments(s, key, [{ start: 1, end: 2, tag: "maybe", note: "x" }], "Harry")).ok, "an unknown tag is refused");
  const e = await saveEditList(s, key, [
    { n: 1, type: "cut", start: 7, end: 9.5, text: "" },
    { n: 2, type: "general", text: "Music quieter all the way through" },
  ]);
  ok(e.ok && e.value.every((x) => /^e-[a-z0-9]+-[a-z0-9]+$/.test(x.id ?? "")), "every edit gets an id when saved");
  ok(!(await saveEditList(s, key, [{ n: 1, type: "cut", start: 7, end: 7.01 }])).ok, "an empty cut is refused");
  const back = await readCut(s, key);
  ok(back.review.comments.length === 1 && back.edits.edits.length === 2, "notes and edits read back from the one file");
  const ids = back.edits.edits.map((x) => x.id!);
  const one = await addRequest(s, key, { type: "render_one", ids: [ids[0]] }, NOW.toISOString());
  ok(one.ok && one.value.type === "render_one" && one.value.start === 7 && one.value.end === 9.5, "Lock & render: one open edit, its range copied from the file");
  ok(!(await addRequest(s, key, { type: "render_one", ids: [ids[1]] }, NOW.toISOString())).ok, "a whole-video edit cannot be locked (no range)");
  const all = await addRequest(s, key, { type: "render_all" }, NOW.toISOString());
  ok(all.ok && all.value.count === 2, "Done: render all covers every open edit");
  const again = await addRequest(s, key, { type: "render_all" }, NOW.toISOString());
  ok(again.ok && again.value.id === (all.ok ? all.value.id : ""), "pressing Done twice does not ask twice");
  ok(!(await addRequest(s, key, { type: "send_somewhere" }, NOW.toISOString())).ok, "an unknown press is refused");
  ok((await saveQcAnswer(s, key, { id: "short-12", state: "dismissed" }, NOW.toISOString())).ok, "an answer to a QC flag saves");
  ok(!(await saveQcAnswer(s, key, { id: "../../x", state: "dismissed" }, NOW.toISOString())).ok, "a made-up flag id is refused");
  s.objects.set(`${key}.qc.json`, { body: JSON.stringify({ v: 1, kind: "flat", checks: [], taste: [], flags: [{ id: "loudness-0", check: "loudness", start: 0, end: 30, title: "Quiet", reason: "r", proposal: "p", confidence: "likely", edit: { type: "general", text: "Raise it" } }] }), size: 1 });
  const view = await readCutView(s, key);
  ok(view.qc?.flags.length === 1 && view.review.qc_answers?.["short-12"]?.state === "dismissed", "the page gets the QC lane and the answers");
  ok(parseQc({ flags: [{ id: "offer_word-1", check: "offer_word", start: 0, end: 1, edit: { type: "general", text: "x" } }] }) === null, "the other app's offer checks do not exist here");
  ok(parseEditList({ edits: [], renders: [{ key: "../../etc/passwd" }] }).ok && (parseEditList({ edits: [], renders: [{ key: "../../etc/passwd" }] }) as { ok: true; value: { renders: unknown[] } }).value.renders.length === 0, "a render must point at a video in storage");
  ok(JSON.stringify(keepSegments([{ start: 2, end: 4 }, { start: 3, end: 5 }], 10)) === JSON.stringify([{ start: 0, end: 2 }, { start: 5, end: 10 }]), "Play with cuts removed keeps the right parts");
  ok(tc(67.45).startsWith("1:07."), "times read m:ss.s");
}

console.log(failed ? `\n${failed} FAILED` : "\nAll marketing storage checks passed.");
process.exit(failed ? 1 : 0);
