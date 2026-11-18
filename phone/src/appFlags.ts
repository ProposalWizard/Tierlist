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
import { Platform } from "react-native";
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

// React Native sets `window` (the global object) but no `window.location`. Some
// game files read the page address's ?options when they load, on the guard
// `typeof window !== "undefined"` (lib/star/style3d/toon/bodies.ts TOON_BODY_SET,
// toon/face.ts, toon/shader.ts …), which then fails on the phone. The phone is
// the site's home page with no options, so that is what they read: every
// option at its default, as a player on the website sees.
const SITE = "https://knowitball.co.uk";
const gl = globalThis as unknown as { location?: unknown; window?: { location?: unknown } };
if (!gl.location) {
  const loc = { search: "", hash: "", pathname: "/", origin: SITE, href: SITE + "/", host: "knowitball.co.uk", hostname: "knowitball.co.uk", protocol: "https:", port: "" };
  gl.location = loc;
  if (gl.window && !gl.window.location) gl.window.location = loc;
}

// The browser's name, which React Native leaves empty. The game reads it to
// know what device it is on (lib/star/three3d/quality.ts: Settings → Look →
// "3D quality: Auto" opens a phone on Medium, Low on a small phone; three.js
// reads it too). A phone app is a phone.
const nav = (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator;
if (nav && typeof nav.userAgent !== "string") {
  try {
    nav.userAgent = Platform.OS === "ios"
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) KIBNext"
      : "Mozilla/5.0 (Linux; Android) KIBNext Mobile";
  } catch { /* read-only: left as it is */ }
}
