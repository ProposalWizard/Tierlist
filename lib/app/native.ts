/**
 * lib/app/native.ts — the PACKED PHONE APP's phone features.
 *
 * Inside the packed app only (components/app/AppBoot.tsx). Capacitor puts its
 * plugins on window.Capacitor.Plugins, so nothing here is imported from the
 * mobile/ folder and the website's build never sees Capacitor.
 *
 *  - ANDROID BACK BUTTON. Left alone, it closes the app from any screen. Here
 *    it presses the screen's own Back or Close button (the topmost one on
 *    screen). On a screen with none (Home, a match) nothing happens the first
 *    time; a second press inside 2 seconds puts the app away, like most games.
 *  - VIBRATION. The game buzzes through navigator.vibrate, which iPhone does
 *    not have. In the app the buzz goes through the phone's own haptics.
 */

interface CapPlugin { [method: string]: (...args: unknown[]) => unknown }
function plugin(name: string): CapPlugin | null {
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, CapPlugin>; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  if (!cap?.Plugins || (cap.isPluginAvailable && !cap.isPluginAvailable(name))) return null;
  return cap.Plugins[name] ?? null;
}

const BACK_LABEL = /^(back|close|go back)\b/i;
const BACK_TEXT = /^\s*(‹|←|✕|×)(\s|$)|^\s*(‹|←)\s*(back|leave|main menu|home)\b/i;

/** The screen's own Back / Close button: the one drawn on top, if any. */
export function findBackButton(doc: Document = document): HTMLElement | null {
  let best: HTMLElement | null = null, bestZ = -Infinity;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("button, a, [role=button], [data-back], [data-back-button]"))) {
    if ((el as HTMLButtonElement).disabled) continue;
    const label = el.getAttribute("aria-label") ?? "";
    const text = (el.textContent ?? "").trim();
    const isBack = el.hasAttribute("data-back") || el.hasAttribute("data-back-button") || BACK_LABEL.test(label) || (text.length <= 14 && BACK_TEXT.test(text));
    if (!isBack) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > window.innerHeight) continue;
    // Really on screen and not covered: what is drawn at its middle is it (or inside it).
    const top = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!top || !(el === top || el.contains(top))) continue;
    // The one in the topmost layer wins (a sheet's Close over the page's Back).
    let z = 0;
    for (let n: HTMLElement | null = el; n; n = n.parentElement) {
      const zi = Number(getComputedStyle(n).zIndex);
      if (Number.isFinite(zi)) z = Math.max(z, zi);
    }
    if (z >= bestZ) { best = el; bestZ = z; }
  }
  return best;
}

let lastBack = 0;
function onBack() {
  const btn = findBackButton();
  if (btn) { btn.click(); return; }
  const now = Date.now();
  if (now - lastBack < 2000) { void plugin("App")?.minimizeApp?.(); lastBack = 0; return; }
  lastBack = now;
  toast("Press back again to leave");
}

function toast(text: string) {
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.style.cssText = "position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483647;background:rgba(10,16,13,.94);color:#fff;font:700 13px system-ui,sans-serif;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);pointer-events:none";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export function installNative(): void {
  if (typeof window === "undefined") return;
  try { void plugin("App")?.addListener?.("backButton", onBack); } catch { /* not in the app shell (a browser test) */ }
  // The keyboard's Go / Enter closes the keyboard (11 Nov 2026: on a phone there was no way back but the back button).
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (e.key === "Enter" && t && t.tagName === "INPUT") (t as HTMLInputElement).blur();
  });
  speedReadout();
  const haptics = plugin("Haptics");
  if (haptics?.vibrate) {
    try {
      (navigator as unknown as { vibrate: (p: number | number[]) => boolean }).vibrate = (p) => {
        const ms = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
        try { void haptics.vibrate({ duration: Math.max(1, Math.round(ms)) }); } catch { /* no buzz */ }
        return true;
      };
    } catch { /* navigator.vibrate is read-only here: the game's own buzz still works on Android */ }
  }
}

/**
 * A SPEED READOUT FOR TESTING ON A REAL PHONE. Touch the screen with THREE
 * fingers at once to show or hide it (it stays as set between launches). It
 * shows frames a second and the slowest frame of the last two seconds, so a
 * tester can say "the match runs at 38, worst 120" instead of "it feels slow".
 */
function speedReadout(): void {
  const KEY = "kib-speed-readout";
  let box: HTMLDivElement | null = null, raf = 0;
  const show = () => {
    if (box) return;
    box = document.createElement("div");
    box.style.cssText = "position:fixed;left:6px;top:calc(6px + env(safe-area-inset-top,0px));z-index:2147483647;background:rgba(0,0,0,.78);color:#7CFC9A;font:800 12px/1.2 ui-monospace,monospace;padding:4px 7px;border-radius:6px;pointer-events:none";
    document.body.appendChild(box);
    let last = performance.now(), frames: number[] = [], shown = last;
    const step = (now: number) => {
      frames.push(now - last); last = now;
      if (now - shown >= 500) {
        const recent = frames.slice(-120), sum = recent.reduce((a, b) => a + b, 0);
        if (box) box.textContent = `${Math.round((1000 * recent.length) / sum)} fps · worst ${Math.round(Math.max(...recent))} ms`;
        frames = recent; shown = now;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const hide = () => { cancelAnimationFrame(raf); box?.remove(); box = null; };
  try { if (localStorage.getItem(KEY) === "1") show(); } catch { /* no storage: off */ }
  window.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 3) return;
    const on = !box;
    if (on) show(); else hide();
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* not kept */ }
  }, { passive: true });
}
