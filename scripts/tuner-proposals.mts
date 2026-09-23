/**
 * scripts/tuner-proposals.mts — what the team's Tune corrections add up to.
 *
 *   npx tsx scripts/tuner-proposals.mts                 # read the shared table
 *   npx tsx scripts/tuner-proposals.mts corrections.json  # or a saved export
 *
 * WHY THIS IS A TERMINAL SCRIPT AND NOT AN ACCEPT BUTTON. Asked for directly:
 * "I'm not sure we want to add an accept button. I think we just want it to
 * propose into the Claude terminal, and then we can go from there." A rule
 * that three drags agree on is still a rule from three drags — it gets read
 * and argued with before anything changes, and the place that happens is a
 * conversation, not a button.
 *
 * Reads `star_scenario_corrections` with the public anon key from .env.local
 * (the table is public-read by RLS, see the migration), runs the SAME
 * `proposalsFrom` the dev tools use, and prints:
 *   - every proposal, with the median value, the spread and the exact line
 *     to change where there is one;
 *   - every near miss — a pattern one or two corrections short — so it is
 *     clear what is building up rather than only what has arrived.
 *
 * It never writes anything.
 */

import { readFileSync, existsSync } from "node:fs";
import {
  proposalsFrom, isCorrection, FAULT_LABEL, PROPOSAL_THRESHOLD,
  type Correction, type FaultKind,
} from "../lib/star/scenarioCorrections";

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  if (!existsSync(".env.local")) return undefined;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

async function fromTable(): Promise<Correction[]> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (.env.local).");
  }
  const res = await fetch(`${url}/rest/v1/star_scenario_corrections?select=correction`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => null) as unknown;
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message ?? `HTTP ${res.status}`;
    if (/does not exist|could not find the table/i.test(msg)) {
      throw new Error("The star_scenario_corrections table does not exist yet — run " +
        "supabase/migrations/star_scenario_corrections.sql in the Supabase SQL Editor.");
    }
    throw new Error(msg);
  }
  return ((body as { correction: unknown }[]) ?? []).map((r) => r.correction).filter(isCorrection);
}

function fromFile(path: string): Correction[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const list = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
  return list.filter(isCorrection);
}

const file = process.argv[2];
let corrections: Correction[];
try {
  corrections = file ? fromFile(file) : await fromTable();
} catch (e) {
  console.error(`Could not read corrections: ${(e as Error).message}`);
  process.exit(1);
}

console.log(`\n${corrections.length} corrections ${file ? `in ${file}` : "in the shared table"}.`);

const proposals = proposalsFrom(corrections);
if (!proposals.length) console.log(`\nNo proposals — nothing reaches ${PROPOSAL_THRESHOLD} agreeing corrections yet.`);
for (const p of proposals) {
  console.log(`\n■ ${p.kind} — ${p.rule}`);
  console.log(`  ${p.count} corrections fixed: ${FAULT_LABEL[p.fault]}`);
  if (p.value !== undefined) {
    console.log(`  median ${p.value.toFixed(3)}${p.range ? `, range ${p.range[0].toFixed(3)}–${p.range[1].toFixed(3)}` : ""}`);
  }
  if (p.apply) console.log(`  to apply: ${p.apply}`);
  console.log(`  from: ${p.from.map((c) => c.id).join(", ")}`);
}

// Near misses: the same bucketing proposalsFrom does, below the bar.
const counts = new Map<string, number>();
for (const c of corrections) for (const f of c.faults) {
  const k = `${c.kind}|${f}`;
  counts.set(k, (counts.get(k) ?? 0) + 1);
}
const near = Array.from(counts.entries()).filter(([, n]) => n < PROPOSAL_THRESHOLD)
  .sort((a, b) => b[1] - a[1]);
if (near.length) {
  console.log("\nBuilding up (not yet a proposal):");
  for (const [k, n] of near) {
    const [kind, fault] = k.split("|") as [string, FaultKind];
    console.log(`  ${kind} — ${FAULT_LABEL[fault] ?? fault}: ${n} of ${PROPOSAL_THRESHOLD}`);
  }
}
const silent = corrections.filter((c) => !c.faults.length).length;
if (silent) console.log(`\n${silent} corrections repaired nothing measurable (recorded, not evidence).`);
console.log("");
