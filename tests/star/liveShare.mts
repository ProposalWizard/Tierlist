/**
 * tests/star/liveShare.mts — "Live share (test)" pure parts (lib/liveShare.ts):
 * the code, the picture names and what to prune, the transcript, "did the
 * picture change", and the state file's shape.
 */
import {
  KEEP_FRAMES, LIVE_CODE, MAX_LIVE_MS, THUMB_CHANNELS, THUMB_H, THUMB_W, addLine, changeKind, changeShare, describeBatch, claudeLineFor, cleanLines, cleanState, clock, frameName,
  frameNumber, framesToPrune, isOver, linesAfter, liveLink, newLiveCode, parseLiveCode, pictureChanged, type LiveLine,
} from "@/lib/liveShare";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// ── The code ──
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const codes = Array.from({ length: 2000 }, () => newLiveCode(rand));
ok(codes.every((c) => LIVE_CODE.test(c)), "2,000 codes: six letters/digits, no I, O, 0 or 1");
ok(new Set(codes).size > 1990, "codes rarely repeat");
ok(newLiveCode(() => 0.999999) === "999999" && newLiveCode(() => 0) === "AAAAAA", "edges of the alphabet");
ok(parseLiveCode("K7Q2XM") === "K7Q2XM" && parseLiveCode("k7q2xm") === "K7Q2XM" && parseLiveCode(" K7Q 2XM ") === "K7Q2XM", "typed code, any case or spacing");
ok(parseLiveCode("https://knowitball.co.uk/admin/videos/live/K7Q2XM") === "K7Q2XM", "code from the whole link");
ok(parseLiveCode("http://localhost:3066/admin/videos/live/k7q2xm?x=1") === "K7Q2XM", "code from a local link");
ok(parseLiveCode("K7Q2XO") === null && parseLiveCode("K7Q2X") === null && parseLiveCode("") === null && parseLiveCode(null) === null, "bad codes refused (O, too short, empty)");
ok(liveLink("K7Q2XM") === "https://knowitball.co.uk/admin/videos/live/K7Q2XM", "the link");
ok(claudeLineFor("K7Q2XM").includes("npx tsx scripts/live-watch.mts K7Q2XM"), "the Claude line carries the command");

// ── Picture names and pruning ──
ok(frameName(7) === "f000007.jpg" && frameName(123456) === "f123456.jpg", "picture names");
ok(frameNumber("f000007.jpg") === 7 && frameNumber("state.json") === null, "picture number back from the name");
ok([frameName(9), frameName(10), frameName(100)].sort().join() === "f000009.jpg,f000010.jpg,f000100.jpg", "names sort in order");
ok(KEEP_FRAMES === 300 && framesToPrune(1).length === 0 && framesToPrune(KEEP_FRAMES).length === 0, "nothing deleted until 300 are kept (5 minutes at one a second)");
ok(framesToPrune(KEEP_FRAMES + 1).join() === frameName(1), "picture 301 deletes picture 1");
ok(framesToPrune(500).join() === frameName(200), "picture 500 deletes picture 200");
ok(framesToPrune(500, 300, 190).length === 10 && framesToPrune(500, 300, 190)[0] === frameName(191), "a page that missed some catches up");
ok(framesToPrune(500, 300, 0).length === 20, "catching up is at most 20 at a time");
// Over a whole share, exactly the newest 200 stay.
const kept = new Set<number>();
for (let n = 1; n <= 650; n++) { kept.add(n); for (const f of framesToPrune(n)) kept.delete(frameNumber(f)!); }
ok(kept.size === KEEP_FRAMES && Math.min(...kept) === 351 && Math.max(...kept) === 650, "650 pictures in a row: 351–650 kept");

// ── Transcript ──
let lines: LiveLine[] = [];
lines = addLine(lines, "  the keeper  is slow ", 1200, "voice");
lines = addLine(lines, "", 1500, "voice");
lines = addLine(lines, "The keeper is slow", 2000, "voice");
lines = addLine(lines, "look at the corner", 5000, "typed");
lines = addLine(lines, "the keeper is slow", 9000, "voice");
ok(lines.length === 3, "blank and a repeat within 4 s ignored; the same words later kept");
ok(lines[0].text === "the keeper is slow" && lines[0].n === 1 && lines[2].n === 3, "tidied text, numbered 1, 2, 3");
ok(lines[1].by === "typed", "typed lines marked");
ok(linesAfter(lines, 1).map((l) => l.n).join() === "2,3" && linesAfter(lines, 3).length === 0, "the watcher sees only new lines");
let many: LiveLine[] = [];
for (let i = 0; i < 350; i++) many = addLine(many, `line ${i}`, i * 5000, "voice", 300);
ok(many.length === 300 && many[0].n === 51 && many[299].n === 350, "keeps the last 300; numbers never reused");
ok(addLine([], "x".repeat(900), 0, "voice")[0].text.length === 500, "a very long line is cut to 500");
ok(clock(7_400) === "0:07" && clock(760_000) === "12:40", "clock");

// ── Did the picture change? (64 × 36 thumbnail, red/green/blue) ──
const PX = THUMB_W * THUMB_H, N = PX * THUMB_CHANNELS;
const fill = (r: number, g: number, b: number) => { const t = new Uint8Array(N); for (let p = 0; p < PX; p++) { t[p * 3] = r; t[p * 3 + 1] = g; t[p * 3 + 2] = b; } return t; };
const a = fill(100, 100, 100);
const onePx = a.slice(); onePx[0] = 120;                       // a number ticking over in one spot
const faded = fill(106, 106, 106);                             // a slight fade
const c = a.slice(); for (let p = 0; p < PX / 6; p++) c[p * 3] = 200;
const half = a.slice(); for (let p = 0; p < PX / 2; p++) half[p * 3 + 2] = 30;
const green = fill(21, 128, 61), blue = fill(29, 78, 216);     // same grey (89 vs 77), different colour
ok(pictureChanged(null, a), "first picture always counts");
ok(!pictureChanged(a, a.slice()), "same picture: not sent again");
ok(pictureChanged(a, onePx), "one small spot changed (a number, a button): sent");
ok(!pictureChanged(a, faded), "a fade of a few levels: not sent");
ok(pictureChanged(a, c), "a sixth of the screen changed: sent");
ok(pictureChanged(a, new Uint8Array(10)), "different size: sent");

// ── What changed (the watcher's SCREEN lines) ──
ok(changeShare(null, a) === 1 && changeShare(a, a.slice()) === 0, "first picture = all changed; same picture = none");
ok(changeShare(a, onePx) === 0, "a spot under 24 levels isn't counted as part of the screen changing");
ok(Math.abs(changeShare(a, c) - Math.floor(PX / 6) / PX) < 1e-9 && changeShare(a, half) === 0.5, "a sixth, half");
ok(changeShare(green, blue) === 1, "green screen → blue screen of the same grey: all changed (colour, not grey)");
ok(changeShare(a, faded) === 0, "a slight fade of the whole screen isn't counted as change");
ok(changeKind(0.03) === "small change" && changeKind(0.2) === "part changed" && changeKind(0.5) === "new screen", "the three words");
ok(describeBatch([], 0) === "", "no pictures → nothing to say");
ok(describeBatch([{ n: 4, at: 41_000, change: 0.05 }], 0) === "1 picture [0:41]: small change (5% changed)", "one picture");
ok(describeBatch([{ n: 4, at: 41_000, change: 0.05 }, { n: 5, at: 42_000, change: 0.82 }, { n: 6, at: 43_500, change: 0.1 }], 0) === "3 pictures [0:41–0:43]: new screen (82% changed)", "a batch: the biggest change decides");

// ── state.json ──
const s = cleanState({ who: "Harry", startedAt: 1000, endsAt: 1000 + MAX_LIVE_MS * 5, lastFrame: 4.7, voice: "shout", lines: 3, hearing: "h".repeat(900) }, "K7Q2XM", 5000);
ok(s.code === "K7Q2XM" && s.who === "Harry" && s.savedAt === 5000, "state keeps code, who, server time");
ok(s.endsAt === 1000 + MAX_LIVE_MS, "can't run past 30 minutes");
ok(s.lastFrame === 4 && s.voice === "none" && s.hearing.length === 300 && s.stoppedAt === null, "numbers floored, unknown voice → none, long text cut");
const junk = cleanState("nonsense", "AAAAAA", 9);
ok(junk.startedAt === 9 && junk.lastFrame === 0 && junk.lines === 0, "junk sent → a safe empty state");
ok(!isOver(s, 2000) && isOver({ ...s, stoppedAt: 3000 }, 3001) && isOver(s, s.endsAt + 61_000), "over: Stop pressed, or 60 s past its end");
const cl = cleanLines([{ n: 2, at: 5, text: "hi", by: "typed" }, { text: "" }, null, { n: "x", at: -4, text: "yo" }]);
ok(cl.length === 2 && cl[0].by === "typed" && cl[1].n === 1 && cl[1].at === 0 && cl[1].by === "voice", "transcript lines cleaned");
ok(cleanLines("nope").length === 0, "not a list → no lines");
const withNotes = cleanState({ recent: [...Array.from({ length: 20 }, (_, i) => ({ n: i + 1, at: i, change: 2 })), null, "x"] }, "AAAAAA", 1);
ok(withNotes.recent.length <= 12 && withNotes.recent.every((x) => x.change === 1) && cleanState({}, "AAAAAA", 1).recent.length === 0, "picture notes: last 12 kept, change capped at 100%");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nliveShare: all passed");
