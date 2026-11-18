/**
 * THE BROWSER'S localStorage, ON THE PHONE (MMKV).
 *
 * Some of what the match remembers between matches lives in the website's
 * localStorage: the chance maker's picture memory (lib/star/chanceMaker.ts
 * pictureMemory("game"): which drawings were served lately, so the same
 * picture is not served twice running across matches), and the trial's
 * "how to play" cards seen once (trialStages teachSeen). Without a
 * localStorage the lib keeps that in memory only and forgets it at every
 * match. This gives the lib a localStorage backed by MMKV (written straight
 * to the phone's storage, its own file, apart from the career save).
 *
 * Installed only when there is none, only on the phone (never in the
 * headless tools), and before the first chance of the first match
 * (screens/MatchPitch.tsx calls it as it loads).
 */
interface Kv { getString(k: string): string | undefined; set(k: string, v: string): void; remove(k: string): void; getAllKeys(): string[]; clearAll(): void }

export function installWebStorage(): boolean {
  const g = globalThis as Record<string, unknown>;
  if (g.__KIB_HEADLESS__) return false;
  try { if (g.localStorage) return false; } catch { /* a getter that throws: treat as none */ }
  let kv: Kv;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");
    kv = createMMKV({ id: "knowitball-web-storage" }) as unknown as Kv;
  } catch { return false; }
  const storage = {
    getItem: (k: string) => kv.getString(String(k)) ?? null,
    setItem: (k: string, v: string) => { kv.set(String(k), String(v)); },
    removeItem: (k: string) => { kv.remove(String(k)); },
    clear: () => { kv.clearAll(); },
    key: (i: number) => kv.getAllKeys()[i] ?? null,
    get length() { return kv.getAllKeys().length; },
  };
  g.localStorage = storage;
  const w = g.window as Record<string, unknown> | undefined;
  if (w && !w.localStorage) w.localStorage = storage;
  return true;
}
