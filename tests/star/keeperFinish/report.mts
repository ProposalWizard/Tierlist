/**
 * Prints the save % table for every keeper-realism case.
 *   npx tsx tests/star/keeperFinish/report.mts            (N=300 per case)
 * Env: N, CFG=live|oct13|both, FINISH=new|old|both, KS (keeper rating), ONLY=<case id substring>
 */
import { setConfig, cases, runCase, savePct } from "./harness.mts";

const N = Number(process.env.N ?? 300);
const cfgs = (process.env.CFG ?? "both") === "both" ? ["live", "oct13"] as const : [process.env.CFG as "live" | "oct13"];
const fins = (process.env.FINISH ?? "both") === "both" ? ["old", "new"] as const : [process.env.FINISH as "old" | "new"];
const ks = process.env.KS ? Number(process.env.KS) : undefined;
const only = process.env.ONLY;

for (const cfg of cfgs) {
  console.log(`\n=== ${cfg === "live" ? "Live defaults" : "Oct 13 update on (Keeper pro + feel, Shots, Contact field, Shot power, Ball physics)"}${ks ? `, keeper ${ks}` : ", keeper 80"} ===`);
  console.log("case".padEnd(58) + fins.map((f) => `saved (${f})`.padStart(16)).join("") + "   n   off  km/h");
  for (const c of cases()) {
    if (only && !c.id.includes(only)) continue;
    const cells: string[] = [];
    let last = null as ReturnType<typeof runCase> | null;
    for (const f of fins) {
      setConfig(cfg, { keeperFinish: f });
      const s = runCase(c, N, 1, ks);
      cells.push(`${savePct(s).toFixed(1)}%`.padStart(16));
      last = s;
    }
    console.log(c.label.padEnd(58) + cells.join("") + `${String(last!.n).padStart(5)} ${String(last!.off).padStart(4)}  ${last!.kmh.toFixed(0)}`);
  }
}
