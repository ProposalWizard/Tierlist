import { makeFakeDb } from "./fakeSupabase.mjs";
import { fetchRoundPlayers } from "../../lib/americanDraft";

// Vertonghen: plays LB in 2013 (rated 82), but his BEST season is 2015 where
// he is recorded as CB only (rated 87). Gueye: CDM in 2017, best 2019 as CM.
const rows = [
  { id: 1, sofifa_id: "vert", name: "J. Vertonghen", overall: 82, manual_overall: null,
    positions: "LB, CB", manual_positions: null, age: 26, image_url: null,
    nationality: "Belgium", manual_nationality: null, club: "Spurs",
    league: "Premier League", fifa_edition: "FIFA 14", fifa_year: 2014 },
  { id: 2, sofifa_id: "vert", name: "J. Vertonghen", overall: 87, manual_overall: null,
    positions: "CB", manual_positions: null, age: 28, image_url: null,
    nationality: "Belgium", manual_nationality: null, club: "Spurs",
    league: "Premier League", fifa_edition: "FIFA 16", fifa_year: 2016 },
  { id: 3, sofifa_id: "gueye", name: "I. Gueye", overall: 78, manual_overall: null,
    positions: "CDM", manual_positions: null, age: 27, image_url: null,
    nationality: "Senegal", manual_nationality: null, club: "Everton",
    league: "Premier League", fifa_edition: "FIFA 17", fifa_year: 2017 },
  { id: 4, sofifa_id: "gueye", name: "I. Gueye", overall: 84, manual_overall: null,
    positions: "ST", manual_positions: null, age: 29, image_url: null,
    nationality: "Senegal", manual_nationality: null, club: "Everton",
    league: "Premier League", fifa_edition: "FIFA 19", fifa_year: 2019 },
];

const db = makeFakeDb({ rows });
const lb = await fetchRoundPlayers(db as never, "LB", [], { prime: true }, 5);
const cm = await fetchRoundPlayers(db as never, "CM", [], { prime: true }, 5);

const v = lb.find(p => p.sofifa_id === "vert")!;
const g = cm.find(p => p.sofifa_id === "gueye")!;

console.log("PRIME MODE — drafted into a slot, then upgraded");
console.log(`  Vertonghen drafted at LB -> ovr ${v.ovr} (prime), positions "${v.positions}"`);
console.log(`  Gueye      drafted at CM -> ovr ${g.ovr} (prime), positions "${g.positions}"`);

const vOk = v.positions.includes("LB") && v.ovr === 87;
const gOk = g.positions.includes("CDM") && g.ovr === 84;
console.log(`\n  Vertonghen still eligible at LB? ${vOk ? "YES" : "NO — would show out of position"}`);
console.log(`  Gueye kept his real positions?   ${gOk ? "YES" : "NO — would show out of position"}`);
if (!vOk || !gOk) process.exit(1);
console.log("\nPASS — prime raises the rating without changing the position they were drafted for.");
