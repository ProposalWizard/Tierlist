// Prints every commentator-team line as JSON (used by generate_teams.py).
import { allTeamLines } from "../../lib/star/goalClip/commentators";
console.log(JSON.stringify(allTeamLines()));
