/**
 * Measure every weather and pitch condition over many strikes (Leo, 22 Oct 2026).
 *   npx tsx scripts/weather/measure.mts [old|new] [--md]
 * Carry, sideways drift, apex, bounce height after landing, roll after landing,
 * total distance: averages over 200 strikes of each kind, each against clear.
 */
import { buildConditions, CLEAR_DIALS, measure, STRIKES, type WeatherDials } from "../../lib/star/weatherLab";

const mode = (process.argv[2] === "new" ? "new" : "old") as "old" | "new";
const md = process.argv.includes("--md");
const CASES: [string, Partial<WeatherDials>][] = [
  ["Clear, perfect pitch", {}],
  ["Wind 10 m/s, left to right", { weather: "wind", windSpeed: 10, windTo: 90 }],
  ["Wind 10 m/s, in your face", { weather: "wind", windSpeed: 10, windTo: 180 }],
  ["Wind 10 m/s, behind you", { weather: "wind", windSpeed: 10, windTo: 0 }],
  ["Gale 17 m/s, left to right", { weather: "wind", windSpeed: 17, windTo: 90 }],
  ["Rain", { weather: "rain" }],
  ["Heavy rain", { weather: "heavy" }],
  ["Fair pitch (0.6), normal", { pitch: 0.6 }],
  ["Poor pitch (0.45), dry", { pitch: 0.45, ground: "dry" }],
  ["Worst pitch (0.25), dry", { pitch: 0.25, ground: "dry" }],
];
const f = (n: number) => n.toFixed(1);
const sg = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1);
console.log(`Ball: ${mode === "old" ? "Old (the game's default)" : "New"}. 200 strikes each.\n`);
for (const st of STRIKES) {
  const base = measure(st, buildConditions(CLEAR_DIALS), mode);
  if (md) { console.log(`\n**${st.name}** (${st.speed} m/s, ${st.angle}°)\n\n| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |\n|---|---|---|---|---|---|`); }
  else console.log(`\n${st.name} (${st.speed} m/s at ${st.angle}°)\n${"condition".padEnd(30)} carry   drift  bounce   roll   total`);
  for (const [name, d] of CASES) {
    const c = buildConditions({ ...CLEAR_DIALS, ...d });
    const m = measure(st, c, mode);
    const row = [f(m.carry) + (name.startsWith("Clear") ? "" : ` (${sg(m.carry - base.carry)})`), sg(m.drift - base.drift), f(m.bounce), f(m.roll), f(m.total)];
    if (md) console.log(`| ${name} | ${row.join(" | ")} |`);
    else console.log(name.padEnd(30), row.map((r) => r.padStart(6)).join("  "));
  }
}
