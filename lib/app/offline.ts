/**
 * lib/app/offline.ts — THE PACKED APP ANSWERS ITS OWN REQUESTS.
 *
 * Inside the packed phone app only (lib/app/packed.ts; installed by
 * components/app/AppBoot.tsx). The game was written for the website, so it
 * asks the website's server for squads, settings and pictures. The app has no
 * server and may have no signal, so here every one of those requests is
 * answered from the files packed inside the app (mobile/scripts/pack.mts):
 *
 *   - /api/star/league-squads, /api/draft/roster, the settings routes,
 *     and the club_logos / custom_clubs tables  → packed files
 *   - picture addresses (player photos, badges, flags) → packed copies
 *   - online saving (/api/star/career)  → "no account" (saves stay on the phone)
 *   - anything else on /api/ (online-only extras)  → a quick "not available"
 *
 * The website never runs this file.
 */
import type { PackedIndex } from "./packedIndex";

let index: PackedIndex | null = null;
const fileCache = new Map<string, Promise<unknown>>();
let realFetch: typeof fetch;
let installed = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function readPacked(file: string): Promise<unknown> {
  let p = fileCache.get(file);
  if (!p) {
    p = realFetch(file).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    fileCache.set(file, p);
  }
  return p;
}

/** A picture's packed copy, or the address as given. */
export function packedImage(url: string): string {
  return (index && index.images[url]) || url;
}

async function answer(url: URL, method: string): Promise<Response | null> {
  if (!index) return null;
  const local = url.origin === window.location.origin;

  if (local && url.pathname.startsWith("/api/")) {
    const p = url.pathname;
    if (p === "/api/star/league-squads" && method === "GET") {
      const all = (await readPacked(index.squads)) as Record<string, unknown[]> | null;
      if (!all) return json({ error: "packed squads missing" }, 503);
      const clubs = (url.searchParams.get("clubs") ?? "").split("|").map((c) => c.trim()).filter(Boolean);
      const squads = Object.fromEntries(clubs.map((c) => [c, all[c] ?? []]));
      return json({ year: index.year, squads, found: Object.fromEntries(clubs.map((c) => [c, squads[c].length])) });
    }
    if (p === "/api/draft/roster" && method === "GET") {
      const file = index.rosters[url.searchParams.get("club") ?? ""];
      const body = file ? await readPacked(file) : null;
      return body ? json(body) : json({ error: "No players for this club" }, 404);
    }
    const route = index.routes[p + url.search] ?? index.routes[p];
    if (route && method === "GET") {
      const body = await readPacked(route);
      if (body) return json(body);
    }
    // Online saving: the app has no account, so there is never a cloud copy.
    if (p === "/api/star/career") return method === "GET" ? json({ career: null }, 404) : json({ ok: true });
    return json({ error: "Not available in the app" }, 503);
  }

  // The two tables the game reads straight from the database.
  const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/);
  if (m && method === "GET" && index.supabase[m[1]]) {
    const body = await readPacked(index.supabase[m[1]]);
    if (body) return json(body);
  }

  // A packed picture asked for by fetch (a canvas, a preload).
  const img = index.images[url.href];
  if (img && method === "GET") return realFetch(img);
  return null;
}

/** Point every picture the game shows at its packed copy, however it is set. */
function patchImages() {
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (desc?.set && desc.get) {
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(this: HTMLImageElement, v: string) { desc.set!.call(this, typeof v === "string" ? packedImage(v) : v); },
    });
  }
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if (this instanceof HTMLImageElement && name === "src" && typeof value === "string") value = packedImage(value);
    return setAttr.call(this, name, value);
  };
}

/** Load the packed list and take over the game's requests. Once, at start. */
export async function installOffline(): Promise<void> {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  realFetch = window.fetch.bind(window);
  try {
    const r = await realFetch("/packed/index.json");
    index = r.ok ? ((await r.json()) as PackedIndex) : null;
  } catch { index = null; }
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const hit = await answer(new URL(raw, window.location.href), method);
      if (hit) return hit;
    } catch { /* fall through to the real request */ }
    return realFetch(input as RequestInfo, init);
  };
  patchImages();
}
