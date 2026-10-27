// Twin test: the Roblox screens (roblox/game/screens.ts). A robot presses
// buttons through a career and every screen is printed in full; the website
// and Roblox must print the same screens. The two mini-games get the same
// seeded dice on both sides.
import * as S from "../game/screens";
import { mulberry32 } from "../../lib/star/season";
import { show } from "./_out";
declare const process: { env: Record<string, string | undefined> };

const STEPS = Number(process.env.TWIN_SCREEN_STEPS ?? 160);
const rng = mulberry32(2026);
console.log(show(S.setupScreen()));
console.log(show(S.clubScreen("League Two")));
let g = S.startGame({ firstName: "Robo", lastName: "Striker", nationality: "Wales", division: "League Two", club: "Bristol Rovers" });
let talked = 0;
for (let i = 0; i < STEPS; i++) {
  const s = S.screen(g);
  console.log(`#${i} ${show(s)}`);
  // look at every tab now and then
  if (s.id === "dashboard" && i % 25 === 0) {
    for (const t of ["league", "fixtures", "stats"]) { g = S.act(g, "tab", t, rng); console.log(`#${i}${t} ${show(S.screen(g))}`); }
    g = S.act(g, "tab", "home", rng);
  }
  let b = s.buttons.find((x) => x.style === "primary") ?? s.buttons[0];
  if (s.id === "contract-renewal" && s.buttons.some((x) => x.action === "renewal-start")) b = s.buttons.find((x) => x.action === "renewal-start")!;
  if (s.id === "contract-renewal" && s.buttons.some((x) => x.action === "renewal-guess")) b = { label: "", action: "renewal-guess", arg: i % 2 ? "higher" : "lower" };
  if (s.id === "season-transfer" && talked < 1) {
    const item = s.blocks.flatMap((x) => (x.kind === "list" ? x.items : [])).find((x) => x.action === "window-talk");
    if (item) { talked++; b = { label: "", action: "window-talk", arg: item.arg }; }
  }
  if (s.id === "transfer-request-talk" && s.buttons.some((x) => x.action === "talk-offer")) b = { label: "", action: i % 3 ? "talk-offer" : "talk-nudge", arg: "-1" };
  if (s.id === "relegation-move") {
    const item = s.blocks.flatMap((x) => (x.kind === "list" ? x.items : [])).find((x) => x.action);
    if (item) b = { label: "", action: item.action!, arg: item.arg };
  }
  if (!b) { console.log("no button"); break; }
  console.log(`press ${b.action} ${b.arg ?? ""}`);
  g = S.act(g, b.action, b.arg, rng);
}
