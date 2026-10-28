/**
 * COOKIE CONSENT (Mikey, 27 Oct 2026, before the Road to Ballon d'Or release).
 *
 * UK rules (PECR): analytics cookies only after the visitor says yes. Until
 * then nothing that tracks is loaded: not Google Analytics (app/layout.tsx used
 * to load it on every page for everyone), not PostHog (components/PostHogProvider.tsx).
 * Login and saving your career are strictly necessary and need no consent.
 *
 * The choice lives on this device ("yes" | "no"); no choice yet = not asked,
 * which also means no tracking. The banner (components/CookieConsent.tsx) asks;
 * the legal page's "Change your cookie choice" clears it so the banner asks again.
 */
export type CookieChoice = "yes" | "no";

export const COOKIE_CONSENT_KEY = "kib-cookie-consent";
/** Fired on window whenever the choice changes (detail: the new choice or null). */
export const COOKIE_CONSENT_EVENT = "kib-cookie-consent";

export function cookieChoice(): CookieChoice | null {
  try {
    const v = typeof localStorage === "undefined" ? null : localStorage.getItem(COOKIE_CONSENT_KEY);
    return v === "yes" || v === "no" ? v : null;
  } catch {
    return null;
  }
}

/** Analytics may run only after a "yes". */
export const analyticsAllowed = (): boolean => cookieChoice() === "yes";

export function setCookieChoice(v: CookieChoice | null): void {
  try {
    if (v) localStorage.setItem(COOKIE_CONSENT_KEY, v);
    else localStorage.removeItem(COOKIE_CONSENT_KEY);
  } catch { /* private mode: the choice holds for this visit only */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: v }));
}
