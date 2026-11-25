// "Live 3D scenes" switch + crash breadcrumbs, checked with no phone and no DOM (24 Nov 2026).
//   cd phone && node tools/live3d-check.mjs
// Renders the real Signing3D / OfficeMoment with react-dom/server, every native piece replaced by a stand-in, and the
// Walk3D screen (the only thing that makes a GL view) replaced by a counter. Proves: with the switch OFF (the default) the trial's
// signing is the drawn one and Walk3D is never mounted; ON, the 3D one starts. Also proves the breadcrumb trail survives a "launch".
// Second round (24 Nov 2026): the crash net (src/three/crashNet.ts) with the real frame gate (src/three/walkHost.ts): an error thrown in a
// scene frame, in a scene callback and in a timer while a 3D place is mounted never reaches the previous global handler, fails the place
// over, turns the switch off and leaves a note in storage; with no place mounted the previous handler still runs. The trail now lasts the
// whole scene (cleared only 10 s after its LAST step), and the live scenes go off after a launch that finds a trail.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const req = createRequire(import.meta.url);
const root = path.resolve("..");
// esbuild: the project's own if installed, else the npx copy (the same one tools/boot-sim.mjs uses)
const esbuildAt = [() => req("esbuild"), () => req(path.join(root, "node_modules/esbuild")), () => req(process.env.ESBUILD_DIR ?? "/root/.npm/_npx/fd45a72a545557e9/node_modules/esbuild")];
let esbuild; for (const f of esbuildAt) { try { esbuild = f(); break; } catch { /* next */ } }
if (!esbuild) throw new Error("esbuild not found: run `npx esbuild --version` once, or set ESBUILD_DIR");
const { build } = esbuild;
const out = process.env.TMPDIR ? path.join(process.env.TMPDIR, "live3d-check.cjs") : "/tmp/live3d-check.cjs";

const STUBS = {
  "react-native": `
    const React = require("react");
    const h = (t) => (p) => React.createElement(t, null, p.children);
    exports.View = h("view"); exports.Text = h("text"); exports.Pressable = h("pressable"); exports.Image = h("image");
    exports.Platform = { OS: "android" };
    exports.useWindowDimensions = () => ({ width: 400, height: 800 });
    exports.StyleSheet = { absoluteFill: {}, create: (s) => s };
    exports.AppState = { currentState: "active", addEventListener: () => ({ remove() {} }) };
    exports.Dimensions = { get: () => ({ width: 400, height: 800 }) };
    exports.PixelRatio = { get: () => 2 };
    exports.ActivityIndicator = h("spinner");`,
  "react-native-mmkv": `
    const store = (globalThis.__kvStore ||= new Map());
    exports.createMMKV = () => ({ getString: (k) => store.get(k), set: (k, v) => { store.set(k, String(v)); }, remove: (k) => { store.delete(k); }, getAllKeys: () => Array.from(store.keys()) });`,
  "react-native-safe-area-context": `exports.useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });`,
  "react-native-reanimated": `const React = require("react"); const A = { View: (p) => React.createElement("view", null, p.children) };
    module.exports = { __esModule: true, default: A, useSharedValue: (v) => ({ value: v }), useAnimatedStyle: () => ({}), withSpring: (v) => v };`,
  "walk3d": `const React = require("react");
    exports.Walk3D = (p) => { (globalThis.__walkMounts ||= []).push(p.name); return React.createElement("walk3d", null, p.children); };`,
  "signing-moment": `const React = require("react"); exports.SigningMoment = () => React.createElement("drawn-signing");`,
  "signing-data": `exports.signingPlan = () => { globalThis.__planCalls = (globalThis.__planCalls || 0) + 1; return { lines: [{ text: "hello", who: "boss", shot: "talk" }], title: "T", club: "Club", managerName: "Boss", data: {} }; };
    exports.officeData = () => ({});`,
  "signing-scene": `exports.loadSigningStart = () => { throw new Error("the 3D must not be loaded"); };`,
  "look": `const React = require("react"); exports.LookButton = (p) => React.createElement("button", null, p.children);`,
};
const entry = `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { Signing3D } = require("@/phone/src/screens/career/Signing3D");
  const { OfficeMoment } = require("@/phone/src/screens/career/Office3D");
  const prefs = require("@/phone/src/game/prefs");
  const safety = require("@/phone/src/safety");
  const crashNet = require("@/phone/src/three/crashNet");
  const { installFrameGate } = require("@/phone/src/three/walkHost");
  exports.run = { React, renderToStaticMarkup, Signing3D, OfficeMoment, prefs, safety, crashNet, installFrameGate };
`;
await build({
  stdin: { contents: entry, resolveDir: path.resolve("."), loader: "js" },
  bundle: true, platform: "node", format: "cjs", outfile: out, logLevel: "error", jsx: "automatic", define: { __DEV__: "false" },
  alias: { "@/phone": path.resolve("."), "@": root },
  loader: { ".png": "empty", ".webp": "empty", ".jpg": "empty", ".glb": "empty" },
  plugins: [{ name: "stubs", setup(b) {
    const virt = (filter, key) => b.onResolve({ filter }, () => ({ path: key, namespace: "stub" }));
    virt(/^react-native$/, "react-native"); virt(/^react-native-mmkv$/, "react-native-mmkv");
    virt(/^react-native-safe-area-context$/, "react-native-safe-area-context"); virt(/^react-native-reanimated$/, "react-native-reanimated");
    virt(/three\/Walk3D$/, "walk3d"); virt(/career\/Signing$|^\.\/Signing$/, "signing-moment");
    virt(/three\/signingData$/, "signing-data"); virt(/three\/signingScene$/, "signing-scene"); virt(/ui\/look$/, "look");
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path], loader: "js", resolveDir: path.resolve(".") }));
  } }],
});

let bad = 0;
const ok = (c, m) => { console.log((c ? "  ok      " : "  FAILED  ") + m); if (!c) bad++; };
const fresh = () => { for (const k of Object.keys(req.cache)) if (k === out) delete req.cache[k]; return req(out).run; };
let r = fresh();
const { createElement: e } = r.React;
const career = { player: { club: "X" }, manager: { name: "Boss" } };
const signing = () => r.renderToStaticMarkup(e(r.Signing3D, { career, club: "Club", managerName: "Boss", onDone() {} }));

console.log("== the trial's signing (Trial.tsx SignedScreen -> Signing3D)");
ok(r.prefs.getPrefs().live3dScenes === false, "the switch is OFF by default");
globalThis.__walkMounts = []; globalThis.__planCalls = 0;
let html = signing();
ok(html.includes("drawn-signing"), "off: the drawn signing is shown");
ok(!html.includes("walk3d") && globalThis.__walkMounts.length === 0, "off: Walk3D (the only maker of a GL view) is never mounted");
ok(globalThis.__planCalls === 0, "off: the 3D scene's plan is not even built");
r.prefs.setPref("live3dScenes", true);
html = signing();
ok(html.includes("walk3d") && !html.includes("drawn-signing"), "on: the 3D signing mounts Walk3D");
ok(globalThis.__walkMounts.join() === "The signing", "on: exactly one Walk3D, 'The signing'");
r.prefs.setPref("live3dScenes", false);

console.log("== the manager's office (OfficeMoment)");
globalThis.__walkMounts = [];
const office = () => r.renderToStaticMarkup(e(r.OfficeMoment, { career, title: "T", text: "words", onContinue() {} }));
html = office();
ok(html.includes("words") && globalThis.__walkMounts.length === 0, "off: the plain card (words + Continue) and no Walk3D");
r.prefs.setPref("live3dScenes", true);
html = office();
ok(globalThis.__walkMounts.join() === "The manager's office", "on: the office stage mounts Walk3D");
r.prefs.setPref("live3dScenes", false);

console.log("== crash breadcrumbs");
r.safety.markStep("The signing", "mounted (view being made)");
r.safety.markStep("The signing", "gl context created");
r.safety.markStep("The signing", "assets loaded 3 of 9");
// the app "closes" here: a new launch loads everything again, the memory-mapped store (globalThis.__kvStore) is what survives
r = fresh();
const line = r.safety.closedWhileLine();
ok(!!line && line.includes("The signing at assets loaded 3 of 9"), "next launch: the trail is still there and names the place and last step");
ok(line && line.includes("mounted (view being made) > gl context created > assets loaded 3 of 9"), "the steps before it are kept: " + line);
r = fresh();
ok(r.safety.closedWhileLine() !== null, "it stays until Clear (a launch later)");
r.safety.clearClosedWhile();
ok(r.safety.closedWhileLine() === null, "Clear removes it");
r.safety.markStep("The signing", "scene started");
r.safety.clearTrail("The signing");
r = fresh();
ok(r.safety.closedWhileLine() === null, "a place that ran ok / closed cleanly leaves no trail");


// ── second round ──────────────────────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const kv = () => globalThis.__kvStore;
const lastErr = () => { const raw = kv().get("last-error"); return raw ? JSON.parse(raw) : null; };
// the phone's global handler, as Boot.tsx leaves it; React Native reports every uncaught error to it (a timer's throw too)
let reached = [];
let handler = (err, fatal) => { reached.push({ err, fatal }); };
globalThis.ErrorUtils = { getGlobalHandler: () => handler, setGlobalHandler: (h) => { handler = h; } };
let rejection = null;
globalThis.HermesInternal = { enablePromiseRejectionTracker: (o) => { rejection = o; } };
const rnReports = (fn) => { try { fn(); } catch (err) { handler(err, true); } };
const fakeRaf = () => {
  const q = []; const g = globalThis;
  const saved = { raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame };
  g.requestAnimationFrame = (cb) => q.push(cb);
  g.cancelAnimationFrame = () => {};
  return { runAll: () => { const n = q.splice(0); n.forEach((cb) => cb(0)); }, restore: () => { g.requestAnimationFrame = saved.raf; g.cancelAnimationFrame = saved.caf; } };
};

console.log("== the crash net: with no 3D place, the previous handler runs as before");
r = fresh();
r.prefs.setPref("live3dScenes", true);
reached = [];
r.crashNet.ensureInstalled();
ok(handler.__kibNet === true, "the net sits in front of the previous handler");
rnReports(() => { throw new Error("outside any 3D place"); });
ok(reached.length === 1 && /outside any 3D place/.test(reached[0].err.message), "no place mounted: the error reaches the previous handler (Boot's)");
ok(lastErr() === null && r.prefs.getPrefs().live3dScenes === true, "no place mounted: nothing recorded, the switch is untouched");

console.log("== the crash net: a frame of the scene throws (the real frame gate)");
let failedOver = [];
let net = r.crashNet.registerPlace("The signing", (why) => failedOver.push(why));
net.event("event stamp");
let raf = fakeRaf();
let gate = r.installFrameGate((e) => { net.onFrameError(e); }, () => r.safety.notePulse("The signing"));
globalThis.requestAnimationFrame(() => { throw new Error("frame boom"); });
reached = [];
raf.runAll();
gate.restore(); raf.restore();
ok(reached.length === 0, "frame throw: the previous handler was NOT reached");
ok(failedOver.length === 1 && /frame boom/.test(failedOver[0]), "frame throw: the place was failed over to its plain version");
ok(r.prefs.getPrefs().live3dScenes === false, "frame throw: the Live 3D scenes switch is off again");
let le = lastErr();
ok(le && le.message === "frame boom" && le.place === "The signing" && le.lastEvent === "event stamp" && le.stack.length > 0, "frame throw: message, stack, place and the scene's last event are in storage: " + JSON.stringify(le && { m: le.message, p: le.place, e: le.lastEvent, s: le.stack.length }));
ok(r.crashNet.mountedPlaces().length === 0, "frame throw: the failed-over place no longer counts as mounted");

console.log("== the crash net: the scene's onEvent callback throws (and runs after the frame, not inside it)");
r.prefs.setPref("live3dScenes", true); failedOver = [];
net = r.crashNet.registerPlace("The signing", (why) => failedOver.push(why));
let ran = 0;
const cbs = net.wrapCallbacks({ onEvent: (e) => { ran++; throw new Error("event boom " + e); }, other: 7 }, () => false);
ok(cbs.other === 7, "the other callbacks are kept");
reached = [];
cbs.onEvent("shake");
ok(ran === 0, "onEvent did not run inside the call that fired it (it is handed on after the frame)");
await sleep(30);
ok(ran === 1, "onEvent ran after the frame");
ok(reached.length === 0 && failedOver.length === 1, "event throw: previous handler NOT reached, the place failed over");
ok(r.prefs.getPrefs().live3dScenes === false, "event throw: the switch is off");
le = lastErr();
ok(le && /event boom shake/.test(le.message) && le.lastEvent === "event shake", "event throw: the note names the error and the last event (event shake)");
// a dead place's late event is dropped, not run
r.prefs.setPref("live3dScenes", true);
net = r.crashNet.registerPlace("The signing", () => {});
ran = 0;
const late = net.wrapCallbacks({ onEvent: () => { ran++; } }, () => true);
late.onEvent("done"); await sleep(20);
ok(ran === 0, "an event that arrives after the place closed is dropped");
net.unregister();

console.log("== the crash net: a timer of the scene throws");
r.prefs.setPref("live3dScenes", true); failedOver = []; reached = [];
net = r.crashNet.registerPlace("The signing", (why) => failedOver.push(why));
net.event("setShot(shake)");
setTimeout(() => rnReports(() => { throw new Error("timer boom"); }), 1);
await sleep(30);
ok(reached.length === 0 && failedOver.length === 1, "timer throw: previous handler NOT reached, the place failed over");
ok(r.prefs.getPrefs().live3dScenes === false, "timer throw: the switch is off");
le = lastErr();
ok(le && le.message === "timer boom" && le.lastEvent === "setShot(shake)", "timer throw: the note has the message and the last event");

console.log("== the crash net: an unhandled promise rejection (Hermes' tracker)");
r.prefs.setPref("live3dScenes", true); failedOver = []; reached = [];
net = r.crashNet.registerPlace("The signing", (why) => failedOver.push(why));
ok(rejection && typeof rejection.onUnhandled === "function", "the rejection tracker is hooked");
rejection.onUnhandled(1, new Error("promise boom"));
ok(reached.length === 0 && failedOver.length === 1 && lastErr().message === "promise boom", "promise: previous handler NOT reached, the place failed over, the note is written");

console.log("== the crash net: covered a moment after the fail-over, then the previous handler again");
reached = [];
rnReports(() => { throw new Error("a late timer of the scene"); });
ok(reached.length === 0, "inside the grace after a fail-over a late error is still taken");
await sleep(r.crashNet.GRACE_MS + 150);
rnReports(() => { throw new Error("much later"); });
ok(reached.length === 1 && /much later/.test(reached[0].err.message), "after it, with no place mounted, the previous handler runs again");
// a place that closed cleanly leaves nothing behind
net = r.crashNet.registerPlace("The signing", () => {}); net.unregister(); reached = [];
rnReports(() => { throw new Error("after a clean close"); });
ok(reached.length === 1, "a place closed cleanly: the previous handler runs as before");

console.log("== the crash net: GL calls after the view is gone are no-ops");
const fakeGl = { drawingBufferWidth: 100, clear: () => { throw new Error("native call after destroy"); }, isContextLost: () => false, getError: () => 5, endFrameEXP: () => { throw new Error("native"); } };
r.crashNet.neutralizeGl(fakeGl);
let threw = false; try { fakeGl.clear(); fakeGl.endFrameEXP(); } catch { threw = true; }
ok(!threw && fakeGl.isContextLost() === true && fakeGl.getError() === 0 && fakeGl.drawingBufferWidth === 100, "after neutralizeGl: calls do nothing, the context reads as lost, values are kept");

console.log("== the breadcrumbs last the whole scene");
// timers recorded here so no real 10 s is waited
const realST = globalThis.setTimeout, realCT = globalThis.clearTimeout; const armed = [];
r = fresh();
globalThis.setTimeout = (fn, ms) => { const t = { fn, ms, off: false }; armed.push(t); return t; };
globalThis.clearTimeout = (t) => { if (t && typeof t === "object" && "off" in t) t.off = true; else realCT(t); };
r.safety.markStep("The signing", "mounted");
r.safety.markStep("The signing", "event stamp");
r.safety.markStep("The signing", "event shake");
const quiet = armed.filter((t) => t.ms === r.safety.TRAIL_QUIET_MS);
ok(quiet.length === 3 && quiet.slice(0, 2).every((t) => t.off) && !quiet[2].off, "every step starts the 10 s quiet count again (only the last one stays armed)");
ok(kv().has("trail:The signing"), "10 s have not passed since the last step: the trail is still there");
r.safety.notePulse("The signing");
ok(kv().has("pulse:The signing"), "the frame pulse is written");
quiet[2].fn();
ok(!kv().has("trail:The signing") && !kv().has("pulse:The signing"), "10 s after the last step with no crash: the trail is cleared");
globalThis.setTimeout = realST; globalThis.clearTimeout = realCT;
for (let i = 1; i <= 12; i++) r.safety.markStep("The signing", "step " + i);
r.safety.notePulse("The signing");
r = fresh();
const info = r.safety.closedWhileInfo();
ok(info && info.steps.length === 10 && info.steps[9].step === "step 12" && info.pulse && info.pulse.n >= 1, "next launch: the last 10 steps and the frame pulse are kept");
ok(/Frames were still running/.test(r.safety.closedWhileLine()), "the line says frames were still running when the app closed");

console.log("== a launch that finds a trail in a live scene turns the switch off (so the replay cannot loop)");
kv().clear(); r = fresh();
r.prefs.setPref("live3dScenes", true);
r.safety.markStep("The signing", "event shake");
r = fresh();
ok(r.safety.closedWhileFresh() === true && r.prefs.getPrefs().live3dScenes === false, "the app closed in the signing: next launch the Live 3D scenes switch is off");
r.prefs.setPref("live3dScenes", true);
r = fresh();
ok(r.safety.closedWhileFresh() === false && r.prefs.getPrefs().live3dScenes === true, "the launch after that (no new trail) leaves the switch as the player set it");
kv().clear(); r = fresh();
r.prefs.setPref("live3dScenes", true);
r.safety.markStep("The garden", "gl context created");
r = fresh();
ok(r.prefs.getPrefs().live3dScenes === true, "a place walked into on purpose (the garden) does not turn the switch off");

console.log("== the Settings card");
kv().clear(); r = fresh(); r.prefs.setPref("live3dScenes", true);
const net2 = r.crashNet.registerPlace("The signing", () => {});
net2.event("event shake");
r.crashNet.reportPlaceError("a frame threw", new Error("card boom"));
r = fresh();
const li = r.safety.lastErrorInfo();
ok(li && li.message === "card boom" && li.lastEvent === "event shake", "next launch: Settings has the last error (" + (li && li.message) + ")");
ok(/Last error: card boom/.test(r.safety.lastErrorLine(li)), "the copyable line starts: " + r.safety.lastErrorLine(li).slice(0, 60));
r.safety.clearClosedWhile(); r = fresh();
ok(r.safety.lastErrorInfo() === null && r.safety.closedWhileInfo() === null, "Clear removes the error and the trail");
const miscSrc = fs.readFileSync(path.resolve("src/screens/career/Misc.tsx"), "utf8");
ok(/Last error: \$\{err\.message\}/.test(miscSrc) && /info\.steps\.slice\(-5\)/.test(miscSrc), "the card shows the last error and the last 5 steps");

console.log("== Walk3D is wired to the net");
const walkSrc = fs.readFileSync(path.resolve("src/three/Walk3D.tsx"), "utf8");
for (const [re, what] of [[/registerPlace\(place/, "registers the place while mounted"], [/wrapCallbacks\(cb/, "wraps the scene's callbacks (onEvent after the frame)"], [/onFrameError\(e\)/, "frame errors go to the net"], [/onFrame: \(\) => \{ if \(!me\.dead\) notePulse/, "frames pulse"], [/neutralizeGl\(/, "the GL is neutralised when the view goes"], [/unmounted\.current\) \{ neutralizeGl\(gl\)/, "onContextCreate after unmount does nothing"], [/traceCalls\(host\.controller/, "setShot/sign/skip are steps"]]) ok(re.test(walkSrc), "Walk3D " + what);
ok(!/setTimeout\(\(\) => \{ clearInterval\(poll\)/.test(walkSrc), "Walk3D no longer clears the trail after 10 s of running");

console.log("== Skip / Back while a place is loading: the scene is let go first, the screen goes after (src/three/walkLeave.ts)");
{
  const wl = path.join(path.dirname(out), "walkleave-check.cjs");
  await build({ entryPoints: [path.resolve("src/three/walkLeave.ts")], bundle: true, platform: "node", format: "cjs", outfile: wl, logLevel: "error" });
  const W = (globalThis.__wl = null, req(wl));
  // a fake clock and a fake frame queue, so the order of events can be read
  const mk = () => {
    const log = [], frames = [], timers = [];
    let leavingShown = false;
    const gate = new W.LeaveGate({
      dispose: () => log.push("dispose"),
      after: (fn) => frames.push(fn),
      leaving: (on) => { leavingShown = on; log.push(on ? "Leaving… shown" : "Leaving… hidden"); },
      timer: (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return () => { t.live = false; }; },
    });
    const frame = () => { while (frames.length) frames.shift()(); };
    return { gate, log, frame, timers, shown: () => leavingShown };
  };
  // 1. Skip while the scene is still starting: nothing is disposed and nothing leaves until the start finishes
  { const t = mk(); const un = W.registerWalkGate(t.gate); t.gate.starting();
    let left = false; W.whenWalkSafe(() => { left = true; t.log.push("screen left (GLView unmounted)"); });
    t.frame();
    ok(!left && !t.log.includes("dispose"), "Skip during the start: the screen has NOT left and the scene is NOT disposed yet (the start is still using the GL)");
    ok(t.shown(), "Skip during the start: \"Leaving…\" is shown");
    t.log.push("start finished"); t.gate.settled(); t.frame();
    ok(t.log.join(" > ") === "Leaving… shown > start finished > dispose > screen left (GLView unmounted)", "the order is: start finishes, scene disposed, THEN the screen leaves (" + t.log.join(" > ") + ")");
    un(); }
  // 2. Skip once the scene is up: disposed first, the screen a frame later
  { const t = mk(); const un = W.registerWalkGate(t.gate); t.gate.starting(); t.gate.settled();
    W.whenWalkSafe(() => t.log.push("screen left"));
    ok(t.log.join(" > ") === "dispose", "Skip with the scene up: disposed at once, screen not yet gone (" + t.log.join(" > ") + ")");
    t.frame();
    ok(t.log.join(" > ") === "dispose > screen left", "Skip with the scene up: the screen leaves after the disposal (" + t.log.join(" > ") + ")");
    un(); }
  // 3. a start that fails still lets the leave go (the plain card is up, nothing to wait for)
  { const t = mk(); const un = W.registerWalkGate(t.gate); t.gate.starting();
    W.whenWalkSafe(() => t.log.push("screen left")); t.gate.settled(); t.frame();
    ok(t.log.join(" > ") === "Leaving… shown > dispose > screen left", "a start that ends (even in failure) lets the waiting leave go");
    un(); }
  // 4. a start that never settles is not waited for forever
  { const t = mk(); const un = W.registerWalkGate(t.gate); t.gate.starting();
    W.whenWalkSafe(() => t.log.push("screen left"));
    const tm = t.timers[0]; ok(tm && tm.ms === W.LEAVE_WAIT_MAX_MS && W.LEAVE_WAIT_MAX_MS <= 10000, "a hung start is waited for at most " + (tm && tm.ms) + " ms");
    tm.fn(); t.frame();
    ok(t.log.join(" > ") === "Leaving… shown > dispose > screen left", "after that time the scene is let go and the screen leaves anyway");
    un(); }
  // 5. no 3D place mounted: leaves at once; a second tap on Skip does not leave twice
  { let n = 0; W.whenWalkSafe(() => n++); ok(n === 1, "no place mounted: the screen leaves at once");
    const t = mk(); const un = W.registerWalkGate(t.gate); t.gate.starting();
    let m = 0; W.whenWalkSafe(() => m++); W.whenWalkSafe(() => m++); t.gate.settled(); t.frame();
    ok(m === 1, "Skip tapped twice while loading leaves once (left " + m + ")");
    un(); }
  // 6. the view was never made (Skip before the screen before went quiet): nothing to dispose, leaves
  { const t = mk(); const un = W.registerWalkGate(t.gate);
    let left = false; W.whenWalkSafe(() => { left = true; }); t.frame();
    ok(left, "Skip before the GL view exists leaves straight away");
    un(); }
  // the wiring: Walk3D waits in each of its three start stages, and every screen that has a place leaves through the gate
  const w3 = fs.readFileSync(path.resolve("src/three/Walk3D.tsx"), "utf8");
  for (const [re, what] of [[/new LeaveGate\(/, "Walk3D makes a leave gate"], [/registerWalkGate\(gate\.current/, "registers it while mounted"],
    [/gate\.current\?\.starting\(\);\s*markStep\(place, `GLView being made/, "the gate is 'starting' when the GL view is made"],
    [/gate\.current\?\.wantsLeave\) \{ neutralizeGl\(gl\)/, "a leave asked before the GL context came: nothing is started on it"],
    [/gate\.current\?\.wantsLeave\) \{ gate\.current\.settled\(\); return; \}/, "a leave asked while the scene started: it is not handed to the screen, it is disposed and the leave goes on"],
    [/dispose: \(\) => \{ const l = live\.current; if \(l\) letGo\(l\)/, "the gate's disposal is the place's own letGo (host.dispose, then every GL call a no-op)"],
    [/Leaving…/, "\"Leaving…\" is shown while it waits"]]) ok(re.test(w3), "Walk3D: " + what);
  for (const [file, what] of [["src/screens/career/Signing3D.tsx", "the signing's Skip and Continue"], ["src/screens/career/Ceremonies.tsx", "the Golden Ball night and the Season Awards night's Skip"],
    ["src/nav.tsx", "Back and home of the garden, shop, house, training pitch, drills and the hardware Back button"], ["src/screens/world/Drill3D.tsx", "the 3D drill's Exit"],
    ["src/screens/world/Crossbar3D.tsx", "the Crossbar Challenge's Exit"], ["src/screens/world/StarPass.tsx", "the Star Pass reward preview (podium)"], ["src/screens/world/Locker.tsx", "the reward reveal (podium)"]]) {
    ok(/whenWalkSafe\(/.test(fs.readFileSync(path.resolve(file), "utf8")), what + " go through whenWalkSafe");
  }
  ok(/useNav|hardwareBackPress/.test(fs.readFileSync(path.resolve("../phone/App.tsx"), "utf8")) && /back\(\)/.test(fs.readFileSync(path.resolve("../phone/App.tsx"), "utf8")), "the phone's Back button calls nav back(), which waits (src/nav.tsx)");
}

console.log(bad ? `\n${bad} FAILED` : "\nPASS: live 3D switch, breadcrumbs and the crash net");
process.exit(bad ? 1 : 0);

