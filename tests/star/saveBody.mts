import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { gzipText, SAVE_BODY_HEADER } from "../../lib/star/saveBody";
import { readSaveBody, SAVE_BODY_MAX } from "../../lib/star/saveBodyServer";
import { gzipSync } from "node:zlib";
import type { StarPlayer } from "../../lib/star/types";

/**
 * A SAVE SENT SQUEEZED reads back exactly as sent, a plain one still reads,
 * and rubbish or an over-size body is refused (lib/star/saveBody.ts).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: "England", startYear: 2026 } as StarPlayer;
const career = makeInitialCareer(p, PREMIER_LEAGUE_CLUBS, "premier");
const text = JSON.stringify({ ...career, note: "naïve café ★ 北" });

const packed = await gzipText(text);
check(!!packed, "this runtime can squeeze");
if (packed) {
  const req = new Request("http://x/api/star/career?slot=1", { method: "POST", headers: { [SAVE_BODY_HEADER]: "gzip" }, body: packed });
  const back = await readSaveBody(req);
  check(JSON.stringify(back) === text, "a squeezed save reads back exactly as sent");
  check(packed.byteLength < text.length / 4, `squeezed is under a quarter of plain (${packed.byteLength} v ${text.length})`);
  console.log(`a new career's save: ${(text.length / 1024).toFixed(0)} KB plain, ${(packed.byteLength / 1024).toFixed(0)} KB squeezed`);
}
const plain = await readSaveBody(new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: text }));
check(JSON.stringify(plain) === text, "a plain save still reads (an old tab)");

const refuses = async (req: Request) => { try { await readSaveBody(req); return false; } catch { return true; } };
check(await refuses(new Request("http://x", { method: "POST", headers: { [SAVE_BODY_HEADER]: "gzip" }, body: "not gzip at all" })), "rubbish marked as gzip is refused");
check(await refuses(new Request("http://x", { method: "POST", headers: { [SAVE_BODY_HEADER]: "gzip" }, body: gzipSync("not json") })), "gzip that is not JSON is refused");
const bomb = gzipSync(Buffer.alloc(SAVE_BODY_MAX + 1024, 0x20));
check(await refuses(new Request("http://x", { method: "POST", headers: { [SAVE_BODY_HEADER]: "gzip" }, body: bomb })), `a body that unsqueezes past ${SAVE_BODY_MAX / 1048576} MB is refused (${bomb.byteLength} bytes sent)`);

if (problems.length) { console.log("FAIL"); for (const x of problems) console.log("  ✗ " + x); process.exit(1); }
console.log("PASS — a squeezed save reads back exactly; plain still reads; rubbish and over-size are refused");
