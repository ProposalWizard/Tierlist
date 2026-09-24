/**
 * FIVE-A-SIDE: A TEAM-MATE'S CHANCE MUST BE FILED AS A TEAM-MATE'S.
 *
 * Seen live 24 Sep 2026 (3 of 3 phone runs): the match froze — clock stuck,
 * banner stuck on "They keep it." / "Blocked!" — and never handed you the ball
 * back. The cause was one line in `startMateAttack`: it set `mateRef` and then
 * set it back to null straight away. The finished chance was filed as THEIRS,
 * `resolveTheirs` found no attack of theirs and fell back to `obey()`, the
 * match had not moved on, and the same team-mate chance replayed forever.
 *
 * The screen is React, so this reads its source: inside `startMateAttack`,
 * `mateRef.current` is set to the chance and never cleared afterwards.
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../components/star/FiveASide.tsx", import.meta.url), "utf8");
const start = src.indexOf("const startMateAttack = useCallback(");
const end = src.indexOf("}, [", start);
const body = src.slice(start, end).replace(/\/\/.*$/gm, "");   // comments don't count
const problems: string[] = [];
if (start < 0 || end < 0) problems.push("could not find startMateAttack in FiveASide.tsx");
const setAt = body.indexOf("mateRef.current = { sc, from }");
if (setAt < 0) problems.push("startMateAttack no longer records the team-mate's chance in mateRef");
if (/mateRef\.current\s*=\s*null/.test(body.slice(setAt))) problems.push("startMateAttack clears mateRef after setting it — the chance will be filed as theirs and replay forever");
// And the loop must still tell a team-mate's finished chance from theirs by mateRef.
if (!/mateRef\.current \? "mate" : "theirs"/.test(src)) problems.push("the flight loop no longer decides mate vs theirs from mateRef");

if (problems.length) { console.log("FAIL"); for (const p of problems) console.log("  - " + p); process.exit(1); }
console.log("PASS — a team-mate's five-a-side chance is filed as his, so the match moves on");
