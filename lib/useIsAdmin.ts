"use client";
/**
 * Is the signed-in person an admin? One shared check for client screens.
 *
 * Harry, 5 Oct 2026: "We need to lock the doors on the settings and the admin
 * stuff. That is 100% real." The Star Career cheat menus (add money, max
 * skills, switch club, skip ahead) sat behind a plain "Show ▾" button that
 * every player could open.
 *
 * Asks /api/profile/admin-check once per page load and shares the answer.
 * A local build that allows offline dev play (`next dev`, the sandbox and the
 * playtest agents, who cannot sign in — see lib/star/devMode.ts) always counts
 * as admin; the deployed app never does unless the server says so.
 *
 * This only hides the tools. The real lock on money is the server, which
 * still trusts the saved career (see the career save route).
 */
import { useEffect, useState } from "react";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";

const DEV_BUILD = offlineDevPlayEnabled();

let answer: boolean | null = DEV_BUILD ? true : null;
let pending: Promise<boolean> | null = null;

function ask(): Promise<boolean> {
  if (answer !== null) return Promise.resolve(answer);
  if (!pending) {
    pending = fetch("/api/profile/admin-check")
      .then(res => (res.ok ? res.json() : { isAdmin: false }))
      .then((d: { isAdmin?: boolean }) => (answer = !!d.isAdmin))
      .catch(() => false)
      .finally(() => { pending = null; });
  }
  return pending;
}

/** False until the server says yes. */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState<boolean>(answer ?? false);
  useEffect(() => {
    let live = true;
    ask().then(v => { if (live) setIsAdmin(v); });
    return () => { live = false; };
  }, []);
  return isAdmin;
}
