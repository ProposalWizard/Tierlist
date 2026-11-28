/**
 * lib/app/notify.ts — PHONE NOTIFICATIONS in the packed phone app.
 *
 * Inside the packed app only. Capacitor puts its plugins on
 * window.Capacitor.Plugins, so nothing here is imported from the mobile/
 * folder and the website's build never sees Capacitor (same as native.ts).
 *
 * Two kinds:
 *  - LOCAL: the phone shows them itself at a time we set. Work with no signal
 *    and need no account or server ("Your next match day is ready").
 *  - PUSH: sent from a server through Apple (APNs). `registerPush` gets this
 *    phone's address (token) and hands it to the caller. Sending them needs the
 *    Apple push key (made in the developer account) and a server: not built yet.
 *
 * Nothing here runs on its own. A screen must call `askForNotifications()` at a
 * good moment (for example after the first match), never at launch: Apple's
 * reviewer and players both dislike a permission box before the game has begun.
 */

interface CapPlugin { [method: string]: (...args: unknown[]) => unknown }
function plugin(name: string): CapPlugin | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, CapPlugin>; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
  if (!cap?.Plugins || (cap.isPluginAvailable && !cap.isPluginAvailable(name))) return null;
  return cap.Plugins[name] ?? null;
}

const TOKEN_KEY = "kib-push-token";

export type NotifyState = "granted" | "denied" | "ask" | "unavailable";

/** Can this phone show notifications, and did the player say yes? */
export async function notifyState(): Promise<NotifyState> {
  const ln = plugin("LocalNotifications");
  if (!ln?.checkPermissions) return "unavailable";
  try {
    const r = (await ln.checkPermissions()) as { display?: string };
    if (r.display === "granted") return "granted";
    if (r.display === "denied") return "denied";
    return "ask";
  } catch { return "unavailable"; }
}

/** Shows the phone's own "Allow notifications?" box (once). Returns true if allowed. */
export async function askForNotifications(): Promise<boolean> {
  const ln = plugin("LocalNotifications");
  if (!ln?.requestPermissions) return false;
  try {
    const r = (await ln.requestPermissions()) as { display?: string };
    return r.display === "granted";
  } catch { return false; }
}

/**
 * Schedule one notification at a time in the future. `id` is a whole number you
 * choose: using the same id again replaces the old one (so a reminder is never
 * doubled). Does nothing if the player has not allowed notifications.
 */
export async function scheduleLocal(id: number, title: string, body: string, at: Date): Promise<boolean> {
  const ln = plugin("LocalNotifications");
  if (!ln?.schedule || (await notifyState()) !== "granted") return false;
  try {
    await ln.cancel?.({ notifications: [{ id }] });
    await ln.schedule({ notifications: [{ id, title, body, schedule: { at, allowWhileIdle: true } }] });
    return true;
  } catch { return false; }
}

/** Cancel one scheduled notification. */
export async function cancelLocal(id: number): Promise<void> {
  try { await plugin("LocalNotifications")?.cancel?.({ notifications: [{ id }] }); } catch { /* nothing to cancel */ }
}

/**
 * Ask Apple for this phone's push address. Needs the push plugin, the app's
 * push entitlement and an allowed permission. `onToken` gets the token string
 * (also kept in localStorage under "kib-push-token" so a later server upload
 * can read it). Returns false if push is not possible here.
 */
export async function registerPush(onToken?: (token: string) => void): Promise<boolean> {
  const pn = plugin("PushNotifications");
  if (!pn?.requestPermissions || !pn.register) return false;
  try {
    const perm = (await pn.requestPermissions()) as { receive?: string };
    if (perm.receive !== "granted") return false;
    await pn.addListener?.("registration", (t: unknown) => {
      const token = (t as { value?: string })?.value;
      if (!token) return;
      try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode: token not kept */ }
      onToken?.(token);
    });
    await pn.register();
    return true;
  } catch { return false; }
}

/** The push token saved by `registerPush`, if any. */
export function savedPushToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
