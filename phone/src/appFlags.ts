// Runs before any game code: this is the phone app, so the game's
// phone-app rules apply (lib/app/packed.ts PACKED_APP: no casino, no
// gambling events — Google Play's age rating, Mikey 18 Nov 2026).
const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
g.process = g.process ?? {};
g.process.env = { ...(g.process.env ?? {}), NEXT_PUBLIC_KIB_APP: "1" };
export {};

// The game keeps some things in the browser's storage (team sheets, manager
// names, settings, picture memory: 98 places in lib/star check for it). The
// phone has no browser, so it gets the same storage, kept on the phone (MMKV),
// and the game behaves as it does on the website.
import { createMMKV } from "react-native-mmkv";
const ls = createMMKV({ id: "knowitball-localstorage" });
const storage = {
  getItem: (k: string) => { const v = ls.getString(String(k)); return v === undefined ? null : v; },
  setItem: (k: string, v: string) => { ls.set(String(k), String(v)); },
  removeItem: (k: string) => { ls.remove(String(k)); },
  clear: () => { ls.clearAll(); },
  key: (i: number) => ls.getAllKeys()[i] ?? null,
  get length() { return ls.getAllKeys().length; },
};
const gs = globalThis as unknown as { localStorage?: unknown };
if (!gs.localStorage) gs.localStorage = storage;
