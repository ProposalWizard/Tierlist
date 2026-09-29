/**
 * Settings → "Refresh Player Photos" updates photos and NOTHING else.
 *
 * It used to replace every club with the database's copy, keeping only goals
 * and assists — so pressing it undid transfers, grown ratings, signings and
 * a merger's emptied club. Each of those must survive a refresh now, while
 * a changed photo still comes through.
 */
import type { LeaguePlayer, LeagueSquad, SquadPlayer } from "../../lib/star/types";
const { refreshLeagueSquadPhotos } = await import("../../lib/star/leagueSquads");
const { refreshSquadPhotos } = await import("../../lib/star/realSquad");

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const lp = (id: string, name: string, overall: number, image?: string, goals = 0): LeaguePlayer =>
  ({ id, name, position: "ST", overall, goals, assists: 0, ...(image ? { image } : {}) });

// What the career has: Mbappé grew 88 → 93 and scored 12; Rodri moved Real → City
// (a transfer); "Absorbed FC" was emptied by a merger; "Gen United" is invented.
const current: LeagueSquad[] = [
  { club: "Real Madrid", players: [lp("1", "Mbappé", 93, "old-mbappe.png", 12)] },
  { club: "Man City", players: [lp("2", "Haaland", 91, "old-haaland.png"), lp("3", "Rodri", 90, "old-rodri.png")] },
  { club: "Absorbed FC", players: [] },
  { club: "Gen United", players: [lp("gen:1", "Invented Ivan", 60)] },
];
// What the database says: Rodri still at Real, Mbappé back at 88, new photos,
// Absorbed FC and Gen United both have real players.
const fresh: LeagueSquad[] = [
  { club: "Real Madrid", players: [lp("1", "Mbappé", 88, "new-mbappe.png"), lp("3", "Rodri", 90, "new-rodri.png")] },
  { club: "Man City", players: [lp("2", "Haaland", 91, "new-haaland.png")] },
  { club: "Absorbed FC", players: [lp("9", "Real Rob", 70, "rob.png")] },
  { club: "Gen United", players: [lp("8", "Real Ray", 65, "ray.png")] },
];

const out = refreshLeagueSquadPhotos(current, fresh, c => c === "Absorbed FC");
const by = new Map(out.map(s => [s.club, s]));
const real = by.get("Real Madrid")!.players, city = by.get("Man City")!.players;

check(real.length === 1 && real[0].name === "Mbappé", "the transfer survives: Rodri is not put back at Real Madrid");
check(city.some(p => p.name === "Rodri"), "the transfer survives: Rodri stays at Man City");
check(real[0].overall === 93, `a grown rating survives (got ${real[0].overall})`);
check(real[0].goals === 12, "goals survive");
check(real[0].image === "new-mbappe.png", "the photo IS refreshed");
check(city.find(p => p.name === "Rodri")?.image === "new-rodri.png", "a moved player's photo is refreshed too, matched by id");
check(by.get("Absorbed FC")!.players.length === 0, "a merger's emptied club stays empty");
check(by.get("Gen United")!.players[0]?.name === "Real Ray", "an invented club is upgraded to its real players");

// Your own club: a signing the database doesn't know about stays; photos refresh.
const sp = (id: string, sofifaId: string | undefined, name: string, imageUrl?: string): SquadPlayer =>
  ({ id, sofifaId, name, shortName: name, position: "ST", seasonGoals: 5, seasonAssists: 0, careerGoals: 5, careerAssists: 0, imageUrl } as SquadPlayer);
const mine = [sp("a", "100", "Palmer", "old-palmer.png"), sp("b", "200", "New Signing", "sign.png")];
const freshMine = [sp("a", "100", "Palmer", "new-palmer.png"), sp("c", "300", "Sold Guy", "sold.png")];
const own = refreshSquadPhotos(freshMine, mine);
check(own.length === 2 && own.some(p => p.name === "New Signing"), "your own signing survives the refresh");
check(!own.some(p => p.name === "Sold Guy"), "a player you sold is not brought back");
check(own.find(p => p.name === "Palmer")?.imageUrl === "new-palmer.png", "your own players' photos refresh");
check(own.find(p => p.name === "Palmer")?.seasonGoals === 5, "your own players' goals survive");

if (problems.length) { console.log("FAIL\n  " + problems.join("\n  ")); process.exit(1); }
console.log("PASS — Refresh Player Photos changes photos only: transfers, growth, signings and mergers survive");
