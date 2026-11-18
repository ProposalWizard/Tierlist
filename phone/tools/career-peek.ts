import { startCareer } from "../src/game/newCareer";
const c = startCareer("Your", "Player") as unknown as Record<string, unknown>;
console.log(Object.keys(c).join(" "));
const lg = c.league as Record<string, unknown> | undefined;
console.log("league keys:", lg && Object.keys(lg).join(" "));
console.log(JSON.stringify(c).length, "bytes");
