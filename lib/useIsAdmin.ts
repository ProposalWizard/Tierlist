"use client";
/**
 * Is the signed-in person an admin? A tester? One shared check for client screens.
 *
 * Harry, 5 Oct 2026: "We need to lock the doors on the settings and the admin
 * stuff. That is 100% real." The Star Career cheat menus (add money, max
 * skills, switch club, skip ahead) sat behind a plain "Show ▾" button that
 * every player could open.
 *
 * Later the same day: "a 'tester access' link and accounts that we will use
 * for our testers to be able to have god mode too". `useIsTester` is true for
 * testers AND admins (lib/roles.ts).
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
import type { Role } from "@/lib/roles";

const DEV_BUILD = offlineDevPlayEnabled();

interface Answer { isAdmin: boolean; isTester: boolean }
const NOBODY: Answer = { isAdmin: false, isTester: false };

let answer: Answer | null = DEV_BUILD ? { isAdmin: true, isTester: true } : null;
let pending: Promise<Answer> | null = null;

function ask(): Promise<Answer> {
  if (answer !== null) return Promise.resolve(answer);
  if (!pending) {
    pending = fetch("/api/profile/admin-check")
      .then(res => (res.ok ? res.json() : NOBODY))
      .then((d: { isAdmin?: boolean; isTester?: boolean }) => (answer = { isAdmin: !!d.isAdmin, isTester: !!d.isAdmin || !!d.isTester }))
      .catch(() => NOBODY)
      .finally(() => { pending = null; });
  }
  return pending;
}

function useAnswer(): Answer {
  const [a, setA] = useState<Answer>(answer ?? NOBODY);
  useEffect(() => {
    let live = true;
    ask().then(v => { if (live) setA(v); });
    return () => { live = false; };
  }, []);
  return a;
}

/** False until the server says yes. */
export function useIsAdmin(): boolean {
  return useAnswer().isAdmin;
}

/** Testers and admins. False until the server says yes. */
export function useIsTester(): boolean {
  return useAnswer().isTester;
}

/** "admin" | "tester" | "player" — "player" until the server answers. */
export function useRole(): Role {
  const a = useAnswer();
  return a.isAdmin ? "admin" : a.isTester ? "tester" : "player";
}
