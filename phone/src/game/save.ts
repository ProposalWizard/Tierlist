// The career is saved on the phone (MMKV: fast, written straight to the phone's storage).
// Off a phone (the headless checks in phone/tools/), it falls back to memory.
import type { CareerState } from "@/lib/star/types";

interface Kv { getString(k: string): string | undefined; set(k: string, v: string): void; remove(k: string): void }
function memoryKv(): Kv {
  const m = new Map<string, string>();
  return { getString: (k) => m.get(k), set: (k, v) => { m.set(k, v); }, remove: (k) => { m.delete(k); } };
}
function openStore(): Kv {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");
    return createMMKV({ id: "knowitball-career" }) as unknown as Kv;
  } catch {
    return memoryKv();
  }
}
const store: Kv = (globalThis as { __KIB_HEADLESS__?: boolean }).__KIB_HEADLESS__ ? memoryKv() : openStore();
const KEY = "career-v2";
export function loadCareer(): CareerState | null {
  try { const s = store.getString(KEY); return s ? (JSON.parse(s) as CareerState) : null; } catch { return null; }
}
export function saveCareer(c: CareerState) { store.set(KEY, JSON.stringify(c)); }
export function clearCareer() { store.remove(KEY); }

/** Small saved values the flow and settings keep (not the career). */
export function loadJson<T>(key: string): T | null {
  try { const s = store.getString(key); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}
export function saveJson(key: string, v: unknown) { store.set(key, JSON.stringify(v)); }
