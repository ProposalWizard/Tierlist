/**
 * tests/star/recording.mts — the Videos tab recorder's pure parts
 * (lib/recording.ts): the file name, the length label, the format pick.
 */
import fs from "node:fs";
import { driveKeyFrom, lengthLabel, pickFormat, recordingName, starterFor } from "@/lib/recording";
// @ts-expect-error plain JS hook, no types
import { contextFor } from "../../scripts/hooks/recordings-hook.mjs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

ok(lengthLabel(45) === "45s" && lengthLabel(252) === "4m12s" && lengthLabel(3725) === "1h02m05s" && lengthLabel(-3) === "0s", "lengths");
const at = new Date(2026, 9, 18, 14, 5);
ok(recordingName({ at, who: "Harry", about: "keeper dive feels slow", seconds: 252, ext: "webm" }) === "2026-10-18 · Harry · keeper dive feels slow (4m12s).webm", "the skill's naming, date first");
ok(recordingName({ at, who: "Leo", about: "  ", seconds: 9, ext: "mp4" }) === "2026-10-18 · Leo · screen recording (9s).mp4", "nothing typed → \"screen recording\"");
ok(!/[\\/:*?"<>|]/.test(recordingName({ at, who: "Mikey", about: 'a/b:c*"d"<e>|f?', seconds: 1, ext: "webm" }).replace(/\.webm$/, "")), "no characters Drive or a computer refuse");
ok(recordingName({ at, who: "Mikey", about: "x".repeat(200), seconds: 1, ext: "webm" }).length < 100, "long titles cut short");
ok(pickFormat((m) => m === "video/webm;codecs=vp8,opus")?.ext === "webm", "Chrome without VP9 → VP8 WebM");
ok(pickFormat((m) => m.startsWith("video/mp4"))?.ext === "mp4", "Safari → MP4");
ok(pickFormat(() => false) === null, "no recorder → null");
ok(starterFor("https://drive.google.com/file/d/x/view") === "Watch this recording: https://drive.google.com/file/d/x/view", "the line for Claude");

ok(contextFor("Harry", []) === "", "auto-read: nothing waiting → says nothing");
const ctx = contextFor("Mikey", [{ title: "2026-10-19 · Mikey · corner camera (1m02s)", link: "https://drive.google.com/file/d/abc/view" }]);
ok(ctx.includes("from Mikey") && ctx.includes("https://drive.google.com/file/d/abc/view") && ctx.includes("screen-video"), "auto-read: names the person, the link and the skill");

// Drive stays connected for as long as Google's one-hour key lasts (Harry, 12 Nov 2026).
const now = Date.parse("2026-11-12T12:00:00Z");
ok(driveKeyFrom(JSON.stringify({ token: "k", until: now + 30 * 60_000 }), now)?.token === "k", "a kept Drive key with time left is used: no asking");
ok(driveKeyFrom(JSON.stringify({ token: "k", until: now + 30_000 }), now) === null, "a key with under a minute left is not used");
ok(driveKeyFrom("not json", now) === null && driveKeyFrom(null, now) === null && driveKeyFrom(JSON.stringify({ until: now + 9e6 }), now) === null, "a broken or empty store means connect again");
// The recording lives above every page, so moving page never stops it.
ok(/<RecorderProvider>/.test(fs.readFileSync("app/layout.tsx", "utf8")), "the recorder is mounted once, above every page");
const tab = fs.readFileSync("app/admin/videos/VideosTab.tsx", "utf8");
ok(/useRecorder\(\)/.test(tab) && !/startRecording\(/.test(tab), "the Videos page only drives the shared recorder (it never owns a recording)");

// Team storage (R2) first, Drive second (Harry, 12 Nov 2026).
const prov = fs.readFileSync("components/admin/recorder/RecorderProvider.tsx", "utf8");
const afterStop = prov.slice(prov.indexOf("const out = await r.done;"), prov.indexOf("}, [mic, reset, send, sendCloud]"));
ok(afterStop.indexOf("await sendCloud(t)") > 0 && afterStop.indexOf("await sendCloud(t)") < afterStop.indexOf("send(t, key.token)"), "on Stop: team storage first, then the Drive copy");
ok(/if \(key\) \{ setDrive\(key\); void send\(t, key\.token\); \}/.test(afterStop) && !/connectDrive\(\{ quiet: false \}\)/.test(afterStop), "on Stop: Drive only when it is already connected, never an Allow box");
ok(/if \(!inCloud\.current\) fetch\("\/api\/dev-recordings"/.test(prov), "a recording in team storage is not noted twice for Claude");
ok(/Also save to Drive/.test(tab) && /RecordingsList/.test(tab), "the Videos page has the small Drive button and the list");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nrecording: all passed");
