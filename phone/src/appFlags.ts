// Runs before any game code: this is the phone app, so the game's
// phone-app rules apply (lib/app/packed.ts PACKED_APP: no casino, no
// gambling events — Google Play's age rating, Mikey 18 Nov 2026).
const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
g.process = g.process ?? {};
g.process.env = { ...(g.process.env ?? {}), NEXT_PUBLIC_KIB_APP: "1" };
export {};
