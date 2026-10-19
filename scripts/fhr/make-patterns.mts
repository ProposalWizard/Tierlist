// The Full Highlights Rebuild's build-up patterns (phase 2), cut down from the
// open-data pattern files (data/opendata/, read its README and LICENCES.md).
//
//   npx tsx scripts/fhr/make-patterns.mts
//
// Writes lib/star/fhr/patterns.json: only what lib/star/fhr/buildUp.ts reads,
// so the game does not carry the whole 290 KB of pattern files.
//   · moves:   per tier, how often the ball goes from coarse zone i to zone j by
//              a pass and by a carry (Wyscout, 1,941 matches; counts, rounded),
//              and each zone's pass length (p25 / p50 / p75, m);
//   · chains:  the most common last actions before an open-play shot or cross
//              (Wyscout's 500 most common chains into a shot);
//   · attacks: how long and how fast attacks that end in a shot are, per tier;
//   · roles:   where each role stands for each ball zone, in and out of
//              possession (IDSSE + SkillCorner tracking, frames-weighted);
//   · speeds:  each role's top speed (IDSSE, 25 Hz);
//   · press:   the nearest defender to the ball per ball zone (IDSSE + SkillCorner).
// Averages and counts only: no match, team, player or frame.
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (f: string) => JSON.parse(readFileSync(new URL(`data/opendata/${f}`, root), "utf8"));
const trans = read("wyscout_transitions.json");
const attacks = read("wyscout_attacks.json");
const chances = read("wyscout_chances.json");
const idsse = read("idsse_tracking.json");
const sc = read("skillcorner_tracking.json");

const TIERS = ["all", "top", "mid", "bottom"] as const;
const r1 = (v: number) => Math.round(v * 10) / 10;

// ── Moves ──
const moves: Record<string, { pass: number[][]; carry: number[][]; passLen: number[][] }> = {};
for (const tier of TIERS) {
  const t = trans.by_tier[tier];
  const pass: number[][] = [], carry: number[][] = [], passLen: number[][] = [];
  for (let i = 0; i < 30; i++) {
    const z = t.zones[i];
    const n = z.n ?? 0;
    const a = z.action ?? {};
    const np = n * ((a.pass_ok ?? 0) + (a.pass_lost ?? 0) * 0.0); // only passes that found a man
    const nc = n * (a.carry ?? 0);
    pass.push((t.pass_to[i] ?? []).map((p: number) => Math.round(p * np)));
    carry.push((t.carry_to[i] ?? []).map((p: number) => Math.round(p * nc)));
    const L = z.pass_len_m ?? { p25: 8, p50: 13, p75: 20 };
    passLen.push([r1(L.p25), r1(L.p50), r1(L.p75)]);
  }
  moves[tier] = { pass, carry, passLen };
}

// ── Chains: the last actions before an open-play shot (and before a cross) ──
// "open_play>simple@23>cross@29>shot@27": a pass played from zone 23, a cross
// from 29, the shot from 27. Kept: the actions as [type, zone], the end, and
// how many shots took that path.
const chains: { acts: [string, number][]; end: number; endType: string; n: number }[] = [];
for (const [key, v] of Object.entries(chances.chains_top.chains as Record<string, [number, number]>)) {
  const parts = key.split(">");
  if (parts[0] !== "open_play") continue;
  const acts = parts.slice(1).map((p) => { const [ty, z] = p.split("@"); return [ty, Number(z)] as [string, number]; });
  const shot = acts.pop()!;
  if (!acts.length) continue;
  chains.push({ acts, end: shot[1], endType: "shot", n: v[0] });
  // The part before a cross: the moves that put a man on the ball out wide.
  const ci = acts.findIndex((a) => a[0] === "cross");
  if (ci > 0) chains.push({ acts: acts.slice(0, ci), end: acts[ci][1], endType: "cross", n: v[0] });
}

// ── Attacks that end in a shot ──
const q = (o: { p10: number; p25: number; p50: number; p75: number; p90: number }) => [o.p10, o.p25, o.p50, o.p75, o.p90].map(r1);
const attack: Record<string, { seconds: number[]; speed: number[]; counterShare: number }> = {};
for (const tier of TIERS) {
  const s = attacks.attacks[tier].shot;
  const ca = attacks.counter_attacks[tier];
  const shots = s.seconds.n;
  attack[tier] = { seconds: q(s.seconds), speed: q(s.speed_mps), counterShare: ca ? Math.round((ca.shots / Math.max(1, shots)) * 1000) / 1000 : 0.1 };
}

// ── Role spots (frames-weighted IDSSE + SkillCorner) ──
const roles: Record<"in" | "out", Record<string, number[][]>> = { in: {}, out: {} };
for (const ph of ["in", "out"] as const) {
  for (const role of Object.keys(idsse.role_positions[ph])) {
    const a = idsse.role_positions[ph][role] as number[][];
    const b = (sc.role_positions[ph][role] ?? null) as number[][] | null;
    roles[ph][role] = a.map((za, i) => {
      const zb = b?.[i];
      if (!zb || !zb[4]) return [r1(za[0]), r1(za[1]), r1(za[2]), r1(za[3])];
      const wa = za[4], wb = zb[4], w = wa + wb;
      return [r1((za[0] * wa + zb[0] * wb) / w), r1((za[1] * wa + zb[1] * wb) / w), r1((za[2] * wa + zb[2] * wb) / w), r1((za[3] * wa + zb[3] * wb) / w)];
    });
  }
}

// ── Top speeds ──
const speeds: Record<string, [number, number]> = {};
for (const [role, v] of Object.entries(idsse.speed_by_role as Record<string, { top_speed_mps?: { p50: number; p90: number } }>)) {
  if (v && typeof v === "object" && v.top_speed_mps) speeds[role] = [v.top_speed_mps.p50, v.top_speed_mps.p90];
}

// ── Pressure: nearest defender per ball zone (the defending team's frame) ──
const quant = (hist: number[], ps: number[]) => {
  const tot = hist.reduce((a, b) => a + b, 0);
  return ps.map((p) => {
    let acc = 0;
    for (let i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= p * tot) return i + 0.5; }
    return hist.length;
  });
};
const press = (idsse.pressure_on_ball as { nearest_hist_1m: number[] }[]).map((z, i) => {
  const zb = (sc.pressure_on_ball as { nearest_hist_1m: number[] }[])[i];
  const h = z.nearest_hist_1m.map((v, k) => v + (zb?.nearest_hist_1m[k] ?? 0));
  return quant(h, [0.25, 0.5, 0.75]);
});

const out = {
  what: "Build-up patterns for lib/star/fhr/buildUp.ts, made by scripts/fhr/make-patterns.mts from data/opendata (averages and counts only). Frame: x 0..100 own goal -> attacked goal, y 0..100 left -> right touchline; coarse zone id = ix*5+iy.",
  credit: [
    "Match event patterns derived from the Wyscout public dataset (Pappalardo et al., Scientific Data 2019), CC BY 4.0. Changes made.",
    "Tracking patterns derived from data of the Deutsche Fußball Liga (DFL), published by Bassek et al., Scientific Data 2025, CC BY 4.0. Changes made.",
    "Tracking patterns derived from SkillCorner Open Data (MIT licence, Copyright (c) 2020 SkillCorner).",
  ],
  xEdges: [0, 16.7, 33.3, 50, 66.7, 83.3, 100],
  yEdges: [0, 19, 37, 63, 81, 100],
  moves, chains, attack, roles, speeds, press,
};
const file = new URL("lib/star/fhr/patterns.json", root);
writeFileSync(file, JSON.stringify(out));
console.log(`wrote lib/star/fhr/patterns.json: ${(JSON.stringify(out).length / 1024).toFixed(0)} KB, ${chains.length} chains, roles ${Object.keys(roles.in).join(" ")}`);
