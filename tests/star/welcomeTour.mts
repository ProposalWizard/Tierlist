import { welcomeTour } from "../../lib/star/tours";

/**
 * The welcome tour's last tip says when the game is, the way Home's
 * next-match card does. It said "You've got a game today" while the card
 * said "2 days" (22 Oct 2026 playtest).
 */
const problems: string[] = [];
const last = (days: number) => welcomeTour(true, days).at(-1)!.text;

if (!/today/.test(last(0))) problems.push(`day 0 should say today: "${last(0)}"`);
if (!/tomorrow/.test(last(1)) || /today/.test(last(1))) problems.push(`day 1 should say tomorrow: "${last(1)}"`);
if (!/in 2 days/.test(last(2)) || /today/.test(last(2))) problems.push(`day 2 should say in 2 days: "${last(2)}"`);
if (!/Tap Play$/.test(last(5))) problems.push(`still asks you to tap Play: "${last(5)}"`);
if (!/today/.test(welcomeTour(true).at(-1)!.text)) problems.push("no days given keeps the old line");
if (welcomeTour(false, 3).at(-1)!.target !== "nav-training") problems.push("the training-first order is unchanged");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the welcome tip says today only on match day, otherwise when the next game is");
