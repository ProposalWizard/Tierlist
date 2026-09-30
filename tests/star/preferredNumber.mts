// Your preferred number: earned at the start of a season with a good manager
// and dressing-room relationship, and usually given by a club that signs you
// after your first (Mikey, 28 Sep 2026).
import { numberAtSeasonStart, numberOnSigning, EARN_NUMBER_RELATIONSHIP } from "../../lib/star/recognition.ts";
import type { CareerState } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };

const base = (boss: number, team: number, preferred?: number) => ({
  season: 2, starRating: 2, squadNumber: 22,
  player: { position: "ST", club: "Leyton Orient", preferredNumber: preferred },
  relationships: { boss, team, fans: 50, girlfriend: null, sponsors: 50 },
}) as unknown as CareerState;

const hi = EARN_NUMBER_RELATIONSHIP, lo = EARN_NUMBER_RELATIONSHIP - 1;
check(numberAtSeasonStart(base(hi, hi, 9)) === 9, "both relationships high → your number");
check(numberAtSeasonStart(base(hi, lo, 9)) === 22, "team-mates not there yet → keep 22");
check(numberAtSeasonStart(base(lo, hi, 9)) === 22, "manager not there yet → keep 22");
check(numberAtSeasonStart(base(hi, hi)) === 22, "no preference → keep what you have");

let got = 0;
const clubs = ["Arsenal", "Chelsea", "Burnley", "Wrexham", "Luton Town", "Stoke City", "Hull City", "Fulham", "Brentford", "Everton"];
for (let s = 1; s <= 10; s++) for (const c of clubs) got += numberOnSigning({ ...base(50, 50, 9), season: s } as CareerState, c, false) === 9 ? 1 : 0;
check(got >= 60 && got <= 95, `a new club usually gives it (${got}/100)`);
let first = 0;
for (const c of clubs) first += numberOnSigning(base(50, 50, 9), c, true) === 9 ? 1 : 0;
check(first < 10, `your first club never promises it (${first}/10 happened to be 9 anyway)`);

console.log(fail ? "FAIL" : `PASS — the number is earned at a season's start, and a club that signs you usually gives it (${got}/100)`);
if (fail) process.exit(1);
