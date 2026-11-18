/**
 * THE PHONE APP ANSWERS THE GAME'S REQUESTS ITSELF — the phone's copy of
 * lib/app/offline.ts (the packed Android app's), giving the SAME answers from
 * the SAME packed files (./packed.ts).
 *
 * The game's rules (lib/star) were written for the website and ask its server
 * for squads and settings with fetch("/api/…"). The phone has no server and
 * may have no signal, so installOfflineFetch() answers those here:
 *
 *   /api/star/league-squads   every club's squad (and "Free Agents")
 *   /api/draft/roster         one club's roster (your own dressing room)
 *   the settings routes       xp-config, lineups, star-pass, sfx-overrides, cutscene-edits
 *   /rest/v1/club_logos, /rest/v1/custom_clubs   the two tables read straight from the database
 *   /api/star/career          "no account" (saves stay on the phone)
 *   any other /api/ address   a quick "not available in the app"
 *
 * Anything else (a real https address) goes to the network as before.
 */
import { packedData } from "./packed";

/** Where a site-relative address ("/api/…") is taken to be. */
const SITE = "https://knowitball.co.uk";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** path, query string and parameters of an address (React Native's URL has no searchParams). */
function parse(raw: string): { site: boolean; path: string; search: string; params: Map<string, string> } {
  let rest = raw;
  let site = true;
  const abs = raw.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i);
  if (abs) { site = abs[0].toLowerCase() === SITE || /^https?:\/\/(www\.)?knowitball\.co\.uk$/i.test(abs[0]); rest = raw.slice(abs[0].length) || "/"; }
  rest = rest.split("#")[0];
  const qi = rest.indexOf("?");
  const path = qi >= 0 ? rest.slice(0, qi) : rest;
  const search = qi >= 0 ? rest.slice(qi) : "";
  const params = new Map<string, string>();
  for (const part of search.slice(1).split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const dec = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
    const k = dec(eq >= 0 ? part.slice(0, eq) : part);
    if (!params.has(k)) params.set(k, dec(eq >= 0 ? part.slice(eq + 1) : ""));
  }
  return { site, path, search, params };
}

/**
 * The packed answer to a request, or null for "not ours, use the network".
 * Same rules, in the same order, as lib/app/offline.ts `answer`.
 */
export function answerPacked(raw: string, method = "GET"): Response | null {
  const { site, path, search, params } = parse(raw);
  const index = packedData();
  const api = site && path.startsWith("/api/");
  if (!index) return api ? json({ error: "Not available in the app" }, 503) : null;

  if (api) {
    if (path === "/api/star/league-squads" && method === "GET") {
      const all = index.squads();
      const clubs = (params.get("clubs") ?? "").split("|").map((c) => c.trim()).filter(Boolean);
      const squads = Object.fromEntries(clubs.map((c) => [c, all[c] ?? []]));
      return json({ year: index.year, squads, found: Object.fromEntries(clubs.map((c) => [c, squads[c].length])) });
    }
    if (path === "/api/draft/roster" && method === "GET") {
      const file = index.rosters[params.get("club") ?? ""];
      const body = file ? file() : null;
      return body ? json(body) : json({ error: "No players for this club" }, 404);
    }
    const route = index.routes[path + search] ?? index.routes[path];
    if (route && method === "GET") {
      const body = route();
      if (body) return json(body);
    }
    // Online saving: the app has no account, so there is never a cloud copy.
    if (path === "/api/star/career") return method === "GET" ? json({ career: null }, 404) : json({ ok: true });
    return json({ error: "Not available in the app" }, 503);
  }

  // The two tables the game reads straight from the database.
  const m = path.match(/\/rest\/v1\/([a-z_]+)$/);
  if (m && method === "GET" && index.tables[m[1]]) {
    const body = index.tables[m[1]]();
    if (body) return json(body);
  }
  return null;
}

let installed = false;
/** Take over the game's requests. Once, before any game code fetches; safe to call again. */
export function installOfflineFetch(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as { fetch?: typeof fetch };
  const realFetch = g.fetch ? g.fetch.bind(globalThis) : null;
  g.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const method = (init?.method ?? (typeof input === "object" && "method" in input ? (input as Request).method : "GET")).toUpperCase();
      const hit = answerPacked(raw, method);
      if (hit) return hit;
    } catch { /* fall through to the real request */ }
    if (!realFetch) throw new TypeError("Network request failed");
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
}
