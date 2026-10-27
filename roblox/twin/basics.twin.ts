// Twin test: JavaScript basics the game relies on. Every line printed here
// must be identical on the website (Node) and in Roblox (Luau).
import { out } from "./_out";

// numbers print like JavaScript
out(1, 1.5, 0.1 + 0.2, 1 / 3, 1e21, 1e-7, -0.000001, 123456789012, 2 ** 53, -7 % 3, 7 % -3, 5.5 % 2);
out((1.005).toFixed(2), (2.5).toFixed(0), (-1.5).toFixed(0), (0.000001234).toFixed(8), (255).toString(16), (35).toString(36));
out(Math.round(2.5), Math.round(-2.5), Math.round(-0.4), Math.max(), Math.min(1, 2, -3), Math.trunc(-4.7), Math.sign(-3));
out(parseInt("42px"), parseInt("0x1f"), parseFloat("3.25abc"), Number(""), Number("12"), Number("1e3"), isNaN(Number("x")));
out(String(12), String(1.25), `${7}-${"x"}-${true}`, "a" + 1 + 2, 1 + 2 + "a");
out(5 | 0, -5 >>> 0, 1 << 31, (0xffffffff ^ 1) | 0, Math.imul(0x6d2b79f5, 0x6d2b79f5), ~5);

// text counts UTF-16 units
const names = ["Atlético Madrid", "Ødegaard", "Müller", "Kanté", "Zürich", "zebra", "apple", "Éclair", "eclair", "Æsir"];
out(names.map((n) => n.length));
out(names.map((n) => n.toUpperCase()));
out(names.map((n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "")));
out([...names].sort());
out([...names].sort((a, b) => a.localeCompare(b)));
out("Bournemouth".slice(-5), "Bournemouth".slice(2, 5), "abc".charCodeAt(1), "Kanté".charCodeAt(4), "hello".indexOf("l"), "Kanté x".indexOf("x"));
out("a,b,,c".split(","), "one  two three".split(/\s+/), "x".padStart(3, "ab"), "7".padStart(2, "0"), "  hi  ".trim(), "ab".repeat(3));
out("Manchester United".replace(/^(\w+)\s+(\w+)$/, "$2 $1"), "a-b-c".replaceAll("-", "+"), "aaa".replace(/a/g, (m) => m.toUpperCase()));
out("Matchday 12 of 38".match(/Matchday (\d+)/)?.[1], /^rg\d+\./.test("rg12.x"), /^rg\d+\./.test("x"), "AFC Wimbledon".replace(/^(AFC|FC)\s+/i, ""));
out("The quick brown fox".split(" ").map((w) => w[0]).join(""), "abc".at(-1), "Hello"[1]);

// sorting is stable and uses the compare function's sign
const rows = [
  { club: "B", pts: 3 }, { club: "A", pts: 3 }, { club: "C", pts: 1 }, { club: "D", pts: 3 }, { club: "E", pts: 1 },
];
out(rows.slice().sort((a, b) => b.pts - a.pts).map((r) => r.club).join(""));
out([10, 9, 1, 100, 25].sort(), [3, 1, 2].sort((a, b) => a - b), [undefined, 3, 1].sort());

// objects keep key order; number-like keys first
const o: Record<string, number> = { b: 1, a: 2 };
o["10"] = 3; o["2"] = 4; o.c = 5;
delete o.a;
o.a = 6;
out(Object.keys(o), Object.values(o), JSON.stringify(o));
out(Object.entries({ x: 1, y: [1, 2, { z: null }] }));
out(JSON.stringify({ a: undefined, b: [undefined, 1], c: "q\"\n", d: 1.5e300, e: NaN }));
out(JSON.stringify({ a: 1, b: { c: [1, 2] } }, null, 2));
const parsed = JSON.parse('{"z":1,"a":[true,false,null,"x\\u00e9"],"m":{"q":2.5}}');
out(Object.keys(parsed), parsed.a, parsed.m.q);
out({ ...{ a: 1, b: 2 }, ...{ b: 3, c: 4 } });

// arrays with holes and 0-based indexes
// (true gaps, from writing past the end, are not copied: Roblox can't tell a
// gap from an empty slot. The game never leaves gaps.)
const arr: (number | undefined)[] = [1, 2, 3, undefined, undefined];
arr[5] = 6;
out(arr.length, arr.map((x) => x ?? 0), arr.filter(Boolean), arr.indexOf(3), arr.includes(undefined));
const spliced = [1, 2, 3, 4, 5];
const removed = spliced.splice(1, 2, 9, 9, 9);
out(spliced, removed, spliced.slice(-2), [1, [2, [3, [4]]]].flat(2), [[1, 2], [3]].flatMap((x) => x));
out([1, 2, 3].reduce((s, x) => s + x, 0), [1, 2, 3].findIndex((x) => x === 2), [1, 2, 3].find((x) => x > 5), Array.from({ length: 3 }, (_, i) => i * i));
let total = 0;
for (let i = 0; i < 5; i++) { if (i === 2) continue; total += i; }
for (const [i, v] of ["a", "b"].entries()) total += i + v.length;
out(total);

// Map and Set keep insertion order
const m = new Map<string, number>([["x", 1], ["y", 2]]);
m.set("a", 3); m.delete("x"); m.set("x", 4);
out([...m.keys()], [...m.values()], m.size, m.get("y"), m.has("q"));
const s = new Set([3, 1, 3, 2]);
out([...s], s.size, s.has(2));
const counts = new Map<number, number>();
for (const n of [1, 2, 1, 3, 1]) counts.set(n, (counts.get(n) ?? 0) + 1);
out([...counts.entries()]);

// dates (UTC)
const d = new Date(Date.UTC(2026, 7, 1));
out(d.getUTCDay(), d.getUTCFullYear(), d.getUTCMonth(), d.toISOString(), new Date(Date.UTC(2027, 1, 29)).toISOString());
out(new Date("2026-10-27").getTime(), Date.UTC(2026, 13, 1), new Date(d.getTime() + 86_400_000 * 40).getUTCDate());

// truthiness
const vals: unknown[] = [0, "", "0", NaN, null, undefined, [], {}, false, -1];
out(vals.map((v) => (v ? "T" : "F")).join(""));
const maybe: number | undefined = undefined;
out(maybe ?? 7, 0 || 9, 0 ?? 9, "" || "x", "y" && "z", null ?? "n");

// switch with fallthrough and default
function kind(n: number): string {
  let r = "";
  switch (n) {
    case 1:
    case 2: r += "low"; break;
    case 3: r += "three";
    // falls through
    case 4: r += "-four"; break;
    default: r += "other";
  }
  return r;
}
out([1, 2, 3, 4, 5].map(kind));

// try / catch / finally
function risky(x: number): string {
  try {
    if (x > 1) throw new Error("too big " + x);
    return "fine";
  } catch (e) {
    return "caught: " + (e as Error).message;
  } finally {
    total++;
  }
}
out(risky(1), risky(5), total);

// classes with getters
class Counter {
  private n = 0;
  constructor(private step: number) {}
  add(): this { this.n += this.step; return this; }
  get value(): number { return this.n; }
}
out(new Counter(3).add().add().value);
