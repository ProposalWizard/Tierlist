// Loads the whole app's code in node the way the phone would at start-up, with
// every native package replaced by a do-nothing stand-in and the browser
// features Hermes lacks removed, to catch a crash that happens on opening.
import { build } from "/root/.npm/_npx/fd45a72a545557e9/node_modules/esbuild/lib/main.js";
import path from "node:path";
const root = path.resolve("..");
const stub = path.resolve("tools/boot-stub.cjs");
const out = "/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/boot-sim.cjs";
await build({
  entryPoints: ["tools/boot-entry.js"], bundle: true, platform: "neutral", mainFields: ["module","main"], format: "cjs", outfile: out, logLevel: "error",
  jsx: "automatic", loader: { ".png": "empty", ".webp": "empty", ".jpg": "empty", ".glb": "empty", ".hdr": "empty", ".bin": "empty", ".wav": "empty", ".mp3": "empty", ".ttf": "empty" },
  alias: { "@": root },
  plugins: [{ name: "natives", setup(b) {
    b.onResolve({ filter: /^(react-native($|\/|-)|expo($|-)|@shopify\/|@react-navigation\/|@expo\/|expo-modules-core)/ }, () => ({ path: stub }));
    b.onResolve({ filter: /^three(\/|$)/ }, (a) => ({ path: require_resolve(a.path) }));
  } }],
  define: { __DEV__: "false" },
});
function require_resolve(p) { return path.join(root, "node_modules", p.endsWith(".js") ? p : p) + (p.includes("/") && !p.endsWith(".js") ? ".js" : p === "three" ? "/build/three.module.js" : ""); }
// Hermes-like world
delete globalThis.TextDecoder; delete globalThis.structuredClone; delete globalThis.document;
delete globalThis.addEventListener; delete globalThis.Buffer; delete globalThis.crypto; delete globalThis.MessageChannel; delete globalThis.BroadcastChannel; delete globalThis.Worker; delete globalThis.Blob; delete globalThis.indexedDB; globalThis.window = globalThis; globalThis.ErrorUtils = { setGlobalHandler() {} };
const { createRequire } = await import("node:module");
const req = createRequire(import.meta.url);
try { req(out); console.log("BOOT OK: app code loaded with no error"); }
catch (e) { console.log("BOOT FAILED:", e && e.stack ? e.stack.split("\n").slice(0, 12).join("\n") : e); }
