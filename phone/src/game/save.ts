// The career is saved on the phone (MMKV: fast, written straight to the phone's storage).
import { createMMKV } from "react-native-mmkv";
import type { CareerState } from "@/lib/star/types";
const store = createMMKV({ id: "knowitball-career" });
const KEY = "career-v2";
export function loadCareer(): CareerState | null {
  try { const s = store.getString(KEY); return s ? (JSON.parse(s) as CareerState) : null; } catch { return null; }
}
export function saveCareer(c: CareerState) { store.set(KEY, JSON.stringify(c)); }
export function clearCareer() { store.remove(KEY); }
