/**
 * SCREENS CHECK: every screen name the app can ask for exists in the screen
 * registry (phone/src/areas/*: the ScreenMap of each area, merged in
 * areas/registry.ts).
 *
 * Headless and quick: it reads the source, it does not run React Native.
 *  1. The registry: the top-level keys of every `…Screens: ScreenMap = { … }`
 *     object in phone/src/areas/.
 *  2. The names asked for: every `screen: "…"` (a flow Step, a phone app),
 *     `nav.go("…")`, `nav.replace("…")` and `go({ screen: "…" })` anywhere in
 *     phone/src, and every name game/flow.ts returns or checks with
 *     screenExists("…").
 * Any name asked for that no area registers fails the check (exit code 1).
 *
 * Run from the repo root:  npx tsx phone/tools/screens-check.ts
 *   (or: npx esbuild phone/tools/screens-check.ts --platform=node --outfile=/tmp/sc.cjs && node /tmp/sc.cjs)
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname.includes("tools") ? path.join(__dirname, "..") : "phone");
const SRC = fs.existsSync(path.join(ROOT, "src")) ? path.join(ROOT, "src") : path.resolve("phone/src");

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

/** The top-level keys of the object literal that starts at `open` (a "{"). */
function topKeys(src: string, open: number): string[] {
  const keys: string[] = [];
  let depth = 0;
  let expectKey = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    // Skip strings, template literals and comments wholesale.
    if (ch === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (ch === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
    if (depth === 1 && expectKey && /[\s]/.test(ch)) continue;
    if (depth === 1 && expectKey) {
      const m = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*))\s*:/.exec(src.slice(i, i + 80));
      if (m) keys.push(m[1] ?? m[2] ?? m[3]);
      expectKey = false;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") { depth++; if (depth === 1) expectKey = true; continue; }
    if (ch === "}" || ch === ")" || ch === "]") { depth--; if (depth === 0) break; continue; }
    if (ch === "," && depth === 1) expectKey = true;
  }
  return keys;
}

// 1. The registry.
const registered = new Map<string, string>();
for (const f of files(path.join(SRC, "areas"))) {
  const src = fs.readFileSync(f, "utf8");
  const re = /export const \w+: ScreenMap = \{/g;
  for (let m: RegExpExecArray | null; (m = re.exec(src)); ) {
    for (const k of topKeys(src, m.index + m[0].length - 1)) registered.set(k, path.relative(SRC, f));
  }
}

// 2. The names asked for.
const asked = new Map<string, Set<string>>();
const ask = (name: string, where: string) => { if (!asked.has(name)) asked.set(name, new Set()); asked.get(name)!.add(where); };
const PATTERNS = [
  /screen:\s*"([\w-]+)"/g,
  /nav\.(?:go|replace)\(\s*"([\w-]+)"/g,
  /screenExists\(\s*"([\w-]+)"\s*\)/g,
  /SCREENS\[\s*"([\w-]+)"\s*\]/g,
];
for (const f of files(SRC)) {
  const src = fs.readFileSync(f, "utf8");
  const where = path.relative(SRC, f);
  for (const re of PATTERNS) for (let m: RegExpExecArray | null; (m = re.exec(src)); ) ask(m[1], where);
}
// "tabs" is Home: always there (core).
const missing = [...asked.keys()].filter((n) => !registered.has(n)).sort();

console.log(`${registered.size} screens registered, ${asked.size} names asked for.`);
for (const [name, where] of [...asked.entries()].sort()) {
  console.log(`  ${registered.has(name) ? "ok     " : "MISSING"} ${name.padEnd(28)} ${registered.get(name) ?? ""}  ← ${[...where].join(", ")}`);
}
if (missing.length) {
  console.error(`\nFAIL: ${missing.length} screen name(s) asked for but not registered: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("\nPASS: every screen name the app asks for is registered.");
