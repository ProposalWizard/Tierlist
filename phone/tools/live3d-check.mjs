// "Live 3D scenes" switch + crash breadcrumbs, checked with no phone and no DOM (24 Nov 2026).
//   cd phone && node tools/live3d-check.mjs
// Renders the real Signing3D / OfficeMoment with react-dom/server, every native piece replaced by a stand-in, and the
// Walk3D screen (the only thing that makes a GL view) replaced by a counter. Proves: with the switch OFF (the default) the trial's
// signing is the drawn one and Walk3D is never mounted; ON, the 3D one starts. Also proves the breadcrumb trail survives a "launch".
import { createRequire } from "node:module";
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
  exports.run = { React, renderToStaticMarkup, Signing3D, OfficeMoment, prefs, safety };
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

console.log(bad ? `\n${bad} FAILED` : "\nPASS: live 3D switch and breadcrumbs");
process.exit(bad ? 1 : 0);
