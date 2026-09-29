// Training: 2 sessions a week, back to 2 only after a SATURDAY match
// (Mikey, 29 Sep 2026).
import { trainingLeft, spendTrainingSession, sessionsAfterMatch, TRAINING_SESSIONS_PER_WEEK } from "../../lib/star/week.ts";
import type { CareerState } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };

const fresh = {} as CareerState;
check(trainingLeft(fresh) === 2 && TRAINING_SESSIONS_PER_WEEK === 2, "a career starts with 2 sessions");
const one = spendTrainingSession(fresh);
const none = spendTrainingSession(one);
check(trainingLeft(one) === 1 && trainingLeft(none) === 0, "each level uses one session");
check(trainingLeft(spendTrainingSession(none)) === 0, "never below zero");
check(sessionsAfterMatch(none, "wednesday").trainingSessions === 0, "a midweek match does not refill");
check(sessionsAfterMatch(one, "tuesday").trainingSessions === 1, "…nor does a Tuesday one");
check(sessionsAfterMatch(none, "saturday").trainingSessions === 2, "a Saturday match refills to 2");
check(sessionsAfterMatch(fresh, "saturday").trainingSessions === 2, "unused ones don't pile up past 2");

console.log(fail ? "FAIL" : "PASS — 2 training sessions a week, refilled only after the Saturday match");
if (fail) process.exit(1);
