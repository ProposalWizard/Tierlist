/**
 * tests/star/recording.mts — the Videos tab recorder's pure parts
 * (lib/recording.ts): the file name, the length label, the format pick.
 */
import { lengthLabel, pickFormat, recordingName, starterFor } from "@/lib/recording";
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

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nrecording: all passed");
