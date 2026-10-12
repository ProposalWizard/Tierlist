import { shoot, SHOOTING_KINDS, inFrame } from "../../tests/star/shotLab";
const N = Number(process.env.N ?? 600);
const skills = { power: Number(process.env.P ?? 65), technique: Number(process.env.T ?? 65) };
const model = process.env.MODEL === "new" ? { pro: true, knuckle: process.env.KN !== "0" } : null;
const perfect = process.env.PERFECT === "1";
const kinds = process.env.KINDS ? process.env.KINDS.split(",") as typeof SHOOTING_KINDS : SHOOTING_KINDS;
const pct = (a: number, b: number) => (100 * a / Math.max(1, b)).toFixed(1) + "%";
for (const kind of kinds) {
  let g = 0, ot = 0, bl = 0, n = 0, inF = 0, errSum = 0, errN = 0, errC = 0, errCN = 0;
  const outs: Record<string, number> = {};
  const byIntent: Record<string, [number, number]> = {};
  for (let s = 1; s <= N; s++) {
    if (process.env.V && s % 100 === 0) console.error(kind, s);
    const r = shoot(kind, s * 7919 + 13, { skills, perfect, model, keeper: Number(process.env.K ?? 62) });
    n++; if (r.goal) g++; if (r.onTarget) ot++; if (r.blocked) bl++;
    outs[String(r.out)] = (outs[String(r.out)] ?? 0) + 1;
    const bi = (byIntent[r.thumb.intent] ??= [0, 0]); bi[1]++; if (r.goal) bi[0]++;
    if (inFrame(r.ballX, r.ballZ)) inF++;
    if (r.ballX !== null) {
      const e = Math.abs(r.ballX - r.arrowX); errSum += e; errN++;
      if (r.thumb.intent === "drive" || r.thumb.intent === "placed") { errC += e * e; errCN++; }
    }
  }
  const intents = Object.entries(byIntent).map(([k, [a, b]]) => `${k} ${pct(a, b)}`).join(", ");
  console.log(`${kind.padEnd(12)} goal ${pct(g, n)}  onTarget ${pct(ot, n)}  blocked ${pct(bl, n)}  cleanInFrame ${pct(inF, n)}  arrowErr ${(errSum / Math.max(1, errN)).toFixed(2)}m (straight sd ${Math.sqrt(errC / Math.max(1, errCN)).toFixed(2)}m)  [${intents}]  ${JSON.stringify(outs)}`);
}
