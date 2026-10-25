/**
 * lib/guest/captcha.ts — the bot check before a guest account is made.
 *
 * Guest accounts cost nothing to make, so a bot could make thousands. Supabase
 * can demand a Cloudflare Turnstile token on every new guest (Authentication →
 * Attack Protection → "Enable Captcha protection", provider Turnstile). This
 * fetches that token in the browser.
 *
 * With no NEXT_PUBLIC_TURNSTILE_SITE_KEY it returns null at once and the guest
 * is made without one (fine while Supabase's captcha switch is off too; if
 * Supabase demands a captcha and the key is missing, sign-in fails politely).
 *
 * Turnstile is mostly invisible ("interaction-only"): it only shows a box when
 * Cloudflare is unsure, in the middle of the screen, then disappears.
 */

import { turnstileSiteKey } from "./config";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
      s.onerror = () => { loading = null; reject(new Error("turnstile failed to load")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** A fresh Turnstile token, or null when no captcha is set up. Rejects if the check fails. */
export async function captchaToken(timeoutMs = 30000): Promise<string | null> {
  const sitekey = turnstileSiteKey();
  if (!sitekey) return null;
  const api = await loadTurnstile();
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483000;";
  document.body.appendChild(host);
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("captcha timed out")), timeoutMs);
      api.render(host, {
        sitekey,
        appearance: "interaction-only",
        callback: (token: string) => { clearTimeout(timer); resolve(token); },
        "error-callback": () => { clearTimeout(timer); reject(new Error("captcha failed")); },
      });
    });
  } finally {
    host.remove();
  }
}
