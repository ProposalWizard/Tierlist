// Twin test: Life between matches through the Roblox screens (roblox/game/screens.ts
// + lifeFlow.ts): rest, the shop (cans, boots, lifestyle), the day off, the office
// talk, training's tab, and sponsors once offers come. Every screen is printed;
// the website and Roblox must print the same.
import * as S from "../game/screens";
import { mulberry32 } from "../../lib/star/season";
import { show } from "./_out";

const rng = mulberry32(77);
let g = S.startWithoutTrial({ firstName: "Life", lastName: "Robot", nationality: "England", division: "League One", club: "Wigan Athletic" });
// an older save (no story): everything open, as the website keeps it
g = { ...g, career: { ...g.career, money: 250000, energy: 60, unlocks: undefined } };
const press = (action: string, arg?: string, label = "") => {
  g = S.act(g, action, arg, rng);
  const s = S.screen(g);
  console.log(`${label || action}${arg ? ` ${arg}` : ""}: ${show(s)}`);
  return s;
};
const listItems = (s: S.Screen) => s.blocks.flatMap((b) => (b.kind === "list" ? b.items : []));

press("tab", "life");
press("rest");
let s = press("life", "cans");
press("buy-can", "basic");
press("buy-can", "premium");
press("life");
press("use-can", "basic");
press("use-can", "premium");
s = press("life", "boots");
const boot = listItems(s).find((i) => i.action === "buy-boot");
if (boot) { press("buy-boot", boot.arg); press("buy-boot", boot.arg, "again"); }
s = press("life", "style");
for (const it of listItems(s).filter((i) => i.action === "buy-item").slice(0, 3)) press("buy-item", it.arg);
press("life");
press("life-dayoff");
press("dayoff", "golf");
press("dayoff", "trip", "second day off (refused)");
s = press("rel-boss");
for (let i = 0; i < 3; i++) s = press("talk-pick", String(i % 3));
press("rel-boss", undefined, "second talk (refused)");
press("tab", "train");
s = press("train-skill", "technique");
press("play-training", "technique:1");
press("play-training", "technique:2");
press("play-training", "technique:3", "third session (refused)");
press("train-back");
// play weeks until a sponsor offer arrives, then sign it
g = S.act(g, "tab", "home", rng);
for (let w = 0; w < 120; w++) {
  const sc = S.screen(g);
  if (g.career.brands?.offers?.length) break;
  const b = sc.buttons.find((x) => x.action === "sim") ?? sc.buttons.find((x) => x.style === "primary") ?? sc.buttons[0];
  if (!b) break;
  g = S.act(g, b.action, b.arg, rng);
}
for (let w = 0; w < 10 && g.phase !== "dashboard"; w++) {
  const b = S.screen(g).buttons.find((x) => x.style === "primary") ?? S.screen(g).buttons[0];
  g = S.act(g, b.action, b.arg, rng);
}
console.log(`week ${g.career.week} season ${g.career.season} ${g.phase}: offers ${g.career.brands?.offers?.length ?? 0}, fame ${g.career.fame}`);
press("tab", "life");
s = press("life", "sponsors");
const offer = listItems(s).find((i) => (i.arg ?? "").startsWith("offer:"));
if (offer) {
  press("life", offer.arg);
  const id = offer.arg!.slice(6);
  press("sponsor", `longer:${id}`);
  press("sponsor", `easier:${id}`);
  press("sponsor", `sign:${id}`);
}
console.log(`final: money ${g.career.money}, energy ${g.career.energy}, happiness ${g.career.happiness}, boss ${g.career.relationships.boss}, skills ${show(g.career.skills)}, boot ${g.career.currentBoot.id} ${g.career.currentBoot.matches}`);
