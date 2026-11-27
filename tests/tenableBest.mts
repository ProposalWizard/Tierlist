import assert from "node:assert/strict";
import { shareLine, oncePerTitle } from "../lib/tenable/best";
assert.equal(shareLine("X", 7, "a"), "Ten-A-Ball: X\n7/10 ⚽⚽⚽⚽⚽⚽⚽❌❌❌\nknowitball.co.uk/tenable/a");
assert.equal(shareLine("X", 12, "a").split("\n")[1], "10/10 ⚽⚽⚽⚽⚽⚽⚽⚽⚽⚽");
assert.deepEqual(oncePerTitle([{ title: "Danish Players" }, { title: "danish players " }, { title: "Swiss" }]).map((r) => r.title), ["Danish Players", "Swiss"]);
console.log("tenableBest: ok");
