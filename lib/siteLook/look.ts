/**
 * lib/siteLook/look.ts — the New look preview switch (Leo, 26 Nov 2026).
 *
 * Leo: "is there a way I can test all this without having to change the
 * entire website … maybe just make it a lil secret admin setting."
 *
 * A cookie on YOUR device: kib_look=v2 turns the new look on, kib_theme
 * picks light (default) or dark. Everyone without the cookie sees today's
 * site. Only an admin can set it (Admin → New look, or the link
 * knowitball.co.uk/?look=v2 while signed in as an admin; ?look=off ends it).
 *
 * html gets three attributes, set before the page paints (the inline script
 * in app/layout.tsx) and again on every page change (SiteLook.tsx):
 *   data-look  "v2" or absent
 *   data-theme "light" | "dark"
 *   data-scope "page" (recoloured) | "game" | "admin" (left as they are)
 * Pure apart from the cookie helpers.
 */

export const LOOK_COOKIE = "kib_look";
export const THEME_COOKIE = "kib_theme";
export type Theme = "light" | "dark";
export type Scope = "page" | "game" | "admin";

/** Game screens and admin keep their own look; everything else is a public page. */
export function scopeOf(path: string): Scope {
  const p = (path || "/").split("?")[0];
  if (p === "/admin" || p.startsWith("/admin/")) return "admin";
  if (p.startsWith("/road-to-the-golden-ball") || p.startsWith("/star-") || p.startsWith("/road-to-ballon-dor")) return "game";
  return "page";
}

export function readCookie(cookie: string, name: string): string | null {
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function lookFromCookie(cookie: string): { on: boolean; theme: Theme } {
  return { on: readCookie(cookie, LOOK_COOKIE) === "v2", theme: readCookie(cookie, THEME_COOKIE) === "dark" ? "dark" : "light" };
}

/** Writes the attributes onto <html>. */
export function applyLook(el: HTMLElement, look: { on: boolean; theme: Theme }, path: string): void {
  if (look.on) { el.dataset.look = "v2"; el.dataset.theme = look.theme; el.dataset.scope = scopeOf(path); }
  else { delete el.dataset.look; delete el.dataset.theme; delete el.dataset.scope; }
}

const YEAR = 60 * 60 * 24 * 365;
export function setLookCookie(on: boolean): void {
  document.cookie = on ? `${LOOK_COOKIE}=v2; path=/; max-age=${YEAR}; samesite=lax` : `${LOOK_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try { window.dispatchEvent(new Event("kib-look-change")); } catch { /* not in a browser */ }
}
export function setThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${YEAR}; samesite=lax`;
}

/**
 * The same as lookFromCookie + scopeOf + applyLook, as a tiny script run in
 * <head> before anything paints (so there is no flash of the old look).
 * Kept in step with the functions above by tests/siteLook.mts.
 */
export const BOOT_SCRIPT = `(function(){try{var c=document.cookie,h=document.documentElement;if(!/(?:^|; )${LOOK_COOKIE}=v2(?:;|$)/.test(c))return;var p=location.pathname,s=/^\\/admin(\\/|$)/.test(p)?"admin":/^\\/(road-to-the-golden-ball|star-|road-to-ballon-dor)/.test(p)?"game":"page";h.dataset.look="v2";h.dataset.theme=/(?:^|; )${THEME_COOKIE}=dark(?:;|$)/.test(c)?"dark":"light";h.dataset.scope=s;}catch(e){}})();`;
