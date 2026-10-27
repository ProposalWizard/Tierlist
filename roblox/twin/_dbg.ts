import * as F from "../game/flow";
import * as M from "../game/match";
import * as C from "../../lib/star/clubs";
import type { StarPlayer } from "../../lib/star/types";
const clubs = C.LEAGUE_TWO_CLUBS;
const p = { firstName: "Match", lastName: "Robot", age: 18, skinTone: "light", club: clubs[4], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const g = F.newGame(p, [...clubs], "league_two");
const setup = M.matchSetupFor(M.readyForMatch(g.career))!;
console.log("duties", JSON.stringify(setup.duties));
