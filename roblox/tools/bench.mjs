#!/usr/bin/env node
/** Runs roblox/bench/<name>.bench.ts on the converted (Luau) side and prints its output. */
import path from "node:path";
import { runLuau } from "./run.mjs";
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const name = process.argv[2] ?? "chance";
const r = runLuau(path.join("roblox/bench", `${name}.bench.ts`));
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
