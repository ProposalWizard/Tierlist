/**
 * MOVING BETWEEN SCREENS. A stack of screens, like the phone's own apps:
 * go(name, params) opens one on top, back() closes it, home() returns to the tabs.
 * Screens register themselves in screens/registry.tsx by name.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { whenWalkSafe } from "./three/walkLeave";

export interface Route { name: string; params?: Record<string, unknown> }
interface Nav { stack: Route[]; go: (name: string, params?: Record<string, unknown>) => void; replace: (name: string, params?: Record<string, unknown>) => void; back: () => void; home: () => void }
const Ctx = createContext<Nav | null>(null);

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);
  const nav = useMemo<Nav>(() => ({
    stack,
    go: (name, params) => setStack((s) => [...s, { name, params }]),
    replace: (name, params) => setStack((s) => [...s.slice(0, -1), { name, params }]),
    // Back / home while a 3D place is still starting wait for it, then the scene is let go, then the screen goes (three/walkLeave.ts)
    back: () => whenWalkSafe(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))),
    home: () => whenWalkSafe(() => setStack([{ name: "tabs" }])),
  }), [stack]);
  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>;
}
export function useNav(): Nav {
  const n = useContext(Ctx);
  if (!n) throw new Error("useNav outside NavProvider");
  return n;
}
