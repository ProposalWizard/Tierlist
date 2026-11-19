/**
 * WEB ONLY (the look check, phone/tools/look). The Android app never reads this
 * file: on a phone `./nav` is nav.tsx; in a browser the bundler picks this one.
 *
 * The same screen stack as nav.tsx, plus two ways in for the look check:
 *   ?screen=<name>&params=<json>  opens that screen on top of the tabs at start
 *   window.__kibNav               the live stack (go, replace, back, home)
 */
import { useEffect, type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: the phone's own nav (an explicit .tsx so this file does not load itself)
import * as Base from "./nav.tsx";
import type { Route } from "./nav";

type NavApi = { stack: Route[]; go: (n: string, p?: Record<string, unknown>) => void; replace: (n: string, p?: Record<string, unknown>) => void; back: () => void; home: () => void };
export type { Route };
export const useNav = Base.useNav as () => NavApi;

let opened = false;
function LookHook() {
  const nav = useNav();
  useEffect(() => { (window as unknown as { __kibNav?: NavApi }).__kibNav = nav; }, [nav]);
  useEffect(() => {
    if (opened) return;
    opened = true;
    const q = new URLSearchParams(window.location.search);
    const screen = q.get("screen");
    if (!screen || screen === "title") return;
    let params: Record<string, unknown> | undefined;
    try { params = JSON.parse(q.get("params") || "null") ?? undefined; } catch { params = undefined; }
    nav.home();
    if (screen !== "tabs") nav.go(screen, params);
  }, [nav]);
  return null;
}

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const P = Base.NavProvider as (p: { initial: Route; children: ReactNode }) => ReactNode;
  return <P initial={initial}><LookHook />{children}</P>;
}
