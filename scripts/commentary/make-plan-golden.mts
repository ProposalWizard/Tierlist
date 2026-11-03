// Writes tests/star/fixtures/goalClips/plan-golden.json: a fingerprint of
// planAudio's output for every case in plan-cases.mts, with the first voice
// ("v1", what plays when every switch is off). Made BEFORE the "Different
// commentators" part (31 Oct 2026); tests/star/commentators.mts checks the
// off-switch still gives exactly these plans, byte for byte.
// Only rerun on purpose, when the old sound is MEANT to change.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { planAudio } from "../../lib/star/goalClip/audio";
import { planCases } from "./plan-cases.mts";

const fp = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
const out: Record<string, string> = {};
for (const c of planCases()) {
  out[`${c.name} v1`] = fp(planAudio(c.edit, "v1"));
  out[`${c.name} default`] = fp(planAudio(c.edit));
}
writeFileSync(new URL("../../tests/star/fixtures/goalClips/plan-golden.json", import.meta.url), JSON.stringify(out, null, 0));
console.log(Object.keys(out).length, "plans");
