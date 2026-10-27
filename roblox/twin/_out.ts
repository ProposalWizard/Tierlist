// Shared printer for twin tests. JavaScript has two "empty" values (null and
// undefined); Roblox has one (nil). Objects print without empty keys so the
// two sides compare; empty array slots print as null on both.
export function show(x: unknown): string {
  return typeof x === "string" ? x : JSON.stringify(x, (_k, v) => (v === null ? undefined : v)) ?? "undefined";
}
export const out = (...xs: unknown[]) => console.log(xs.map(show).join(" | "));
