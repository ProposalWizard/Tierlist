/**
 * Real progress for the loading screens: counts the files three.js is asked
 * for (every loader goes through three's DefaultLoadingManager: GLBs,
 * textures, the Draco and KTX2 helpers) from the moment a screen opens.
 *
 * Nothing here imports three up front: the hook is put in only once the
 * place itself has pulled three in (so the loading screen never adds a
 * download). The place's own hooks (assetUrl.ts uses setURLModifier) are
 * left alone; any onStart/onProgress/onLoad already set is still called.
 */
import { progressOf, type LoadSection } from "./pick";

let started = 0;
let ended = 0;
let hooked = false;

type Mgr = { itemStart(u: string): void; itemEnd(u: string): void; itemError(u: string): void };

/** Wrap the manager's own item counters (onProgress alone misses files a loader asks for while another is in flight). */
function hook(mgr: Mgr) {
  if (hooked) return;
  hooked = true;
  const s = mgr.itemStart.bind(mgr), e = mgr.itemEnd.bind(mgr), x = mgr.itemError.bind(mgr);
  mgr.itemStart = (u: string) => { started++; s(u); };
  mgr.itemEnd = (u: string) => { ended++; e(u); };
  mgr.itemError = (u: string) => { ended++; x(u); };
}

/** Put the counter in. Call only for a place that loads three itself (a 3D place), never for a 2D wait. */
export function watchThree() {
  if (hooked || typeof window === "undefined") return;
  // three is one shared file: a 3D place is asking for it at this same moment, so this costs nothing extra
  void import("three").then((T) => hook(T.DefaultLoadingManager as unknown as Mgr)).catch(() => {});
}

const expectKey = (s: LoadSection) => `kib-loading-files-${s}`;

export interface LoadWatch {
  /** 0..0.95, or null before there is anything to count. */
  now(): number | null;
  /** The place is ready: remember how many files it took, for next time. */
  done(): void;
}

export function startLoadWatch(section: LoadSection, three: boolean): LoadWatch {
  if (three) watchThree();
  const s0 = started, e0 = ended;
  let expected = 0;
  try { expected = Number(localStorage.getItem(expectKey(section))) || 0; } catch { /* none */ }
  let prev: number | null = null;
  return {
    now() {
      const asked = started - s0, done = ended - e0;
      if (asked <= 0 && expected <= 0) return prev;
      prev = progressOf(done, asked, expected, prev);
      return prev;
    },
    done() {
      const asked = started - s0;
      if (asked > 0) { try { localStorage.setItem(expectKey(section), String(asked)); } catch { /* fine */ } }
    },
  };
}
