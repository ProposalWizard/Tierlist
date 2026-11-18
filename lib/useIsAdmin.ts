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
 * Asks /api/profile/admin-check once per page load and shares the answer:
 * only for a signed-in person, and kept for 10 minutes per tab.
 * A local build that allows offline dev play (`next dev`, the sandbox and the
 * playtest agents, who cannot sign in — see lib/star/devMode.ts) always counts
 * as admin; the deployed app never does unless the server says so.
 *
 * This only hides the tools. The real lock on money is the server, which
 * still trusts the saved career (see the career save route).
 */
import { useEffect, useState } from "react";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/roles";

const DEV_BUILD = offlineDevPlayEnabled();

interface Answer { isAdmin: boolean; isTester: boolean }
const NOBODY: Answer = { isAdmin: false, isTester: false };

let answer: Answer | null = DEV_BUILD ? { isAdmin: true, isTester: true } : null;
let pending: Promise<Answer> | null = null;

// The answer kept for this tab, per account, so moving between pages does not
// ask the server again each time (Mikey, 6 Nov 2026: server time). 10 minutes,
// so a role given or taken shows soon enough.
const KEEP_KEY = "kib-admin-check";
const KEEP_MS = 10 * 60_000;
function kept(userId: string): Answer | null {
  try {
    const k = JSON.parse(sessionStorage.getItem(KEEP_KEY) ?? "null") as { id: string; at: number; a: Answer } | null;
    return k && k.id === userId && Date.now() - k.at < KEEP_MS ? k.a : null;
  } catch { return null; }
}
function keep(userId: string, a: Answer) {
  try { sessionStorage.setItem(KEEP_KEY, JSON.stringify({ id: userId, at: Date.now(), a })); } catch { /* private mode */ }
}

function ask(): Promise<Answer> {
  if (answer !== null) return Promise.resolve(answer);
  if (!pending) {
    // Signed out (most visitors): nobody, with no server call. The login
    // cookie is read in the browser.
    pending = createClient().auth.getSession()
      .then(({ data }) => {
        const id = data.session?.user.id;
        if (!id) return (answer = NOBODY);
        const hit = kept(id);
        if (hit) return (answer = hit);
        return fetch("/api/profile/admin-check")
          .then(res => (res.ok ? res.json() : NOBODY))
          .then((d: { isAdmin?: boolean; isTester?: boolean }) => {
            answer = { isAdmin: !!d.isAdmin, isTester: !!d.isAdmin || !!d.isTester };
            keep(id, answer);
            return answer;
          });
      })
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

/** Testers and admins, outside React (the 3D frame meter, lib/star/three3d/frameMeter.ts). */
export function isTesterNow(): Promise<boolean> {
  return ask().then(a => a.isTester);
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
