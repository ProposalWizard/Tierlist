import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Opacity modifiers Tailwind will actually generate.
 *
 * Tailwind only emits `bg-black/40` for values on its opacity scale, which runs
 * in steps of five. `bg-gray-950/92` is not an error, not a warning and not a
 * class — it is silently dropped, and the element renders with no background at
 * all.
 *
 * That is what happened to the match simulation panel. It was written as a 92%
 * black backdrop and had none, so the canvas showed straight through it: every
 * match opened on a fully drawn chance that was never played, because the
 * throwaway scenario the ref is initialised with was sitting behind a panel
 * nobody could see was transparent. Eleven more instances were doing the same
 * quiet nothing across the Ballon d'Or screens.
 *
 * The fix in both cases is the arbitrary form — `/[0.92]` — which is always
 * generated. This asserts nobody writes the silent one again.
 */

const UTILITIES = "bg|text|border|from|via|to|ring|fill|stroke|divide|shadow|outline|accent|placeholder|decoration|caret";
const MODIFIER = new RegExp(`\\b(?:${UTILITIES})-[a-z]+-\\d{2,3}/(\\d{1,3})\\b`, "g");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const bad: string[] = [];
for (const file of walk("app").concat(walk("components"))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((raw, i) => {
    // Prose is allowed to name the broken form — this file's own explanation
    // does, and so does the comment beside the fix in CanvasMatch.
    const t = raw.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    const line = raw.replace(/\/\/.*$/, "");
    for (const m of line.matchAll(MODIFIER)) {
      if (Number(m[1]) % 5 !== 0) bad.push(`${file}:${i + 1}  ${m[0]}  → write it as /[0.${m[1].padStart(2, "0")}]`);
    }
  });
}

if (bad.length) {
  console.error("FAIL — these opacity modifiers are not on Tailwind's scale and generate no CSS:");
  for (const b of bad) console.error("  ✗ " + b);
  process.exit(1);
}
console.log("PASS — every opacity modifier is one Tailwind will actually generate");
