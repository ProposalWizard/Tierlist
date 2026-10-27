#!/usr/bin/env node
// Type-check roblox/game/*.ts and roblox/twin/*.ts against the website code.
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const ts = createRequire(import.meta.url)("typescript");
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const cfg = ts.readConfigFile(path.join(REPO, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, REPO);
const files = ["roblox/game", "roblox/twin"].flatMap((d) => fs.existsSync(path.join(REPO, d)) ? fs.readdirSync(path.join(REPO, d)).filter((f) => f.endsWith(".ts")).map((f) => path.join(REPO, d, f)) : []);
const program = ts.createProgram(files, { ...parsed.options, noEmit: true, incremental: false });
const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.file && d.file.fileName.includes("/roblox/"));
for (const d of diags) {
  const { line } = d.file.getLineAndCharacterOfPosition(d.start);
  console.log(`${path.relative(REPO, d.file.fileName)}:${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
}
console.log(diags.length ? `${diags.length} type errors` : "types ok");
process.exit(diags.length ? 1 : 0);
