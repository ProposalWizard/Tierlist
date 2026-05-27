const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const SEARCH_ENDPOINT = "https://www.wikidata.org/w/api.php";
const UA = "Knowitball/1.0 (knowitballcontact@gmail.com)";

type SparqlValue = { value: string };
type SparqlRow = Record<string, SparqlValue | undefined>;

async function sparql(query: string): Promise<SparqlRow[]> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return (json.results?.bindings ?? []) as SparqlRow[];
}

async function entitySearch(query: string, limit = 30): Promise<{ id: string; label: string; description: string }[]> {
  const url = `${SEARCH_ENDPOINT}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&limit=${limit}&format=json&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikidata search ${res.status}`);
  const json = await res.json();
  return (json.search ?? []).map((s: Record<string, string>) => ({
    id: s.id,
    label: s.label ?? "",
    description: s.description ?? "",
  }));
}

export interface WikiPlayer {
  id: string;
  name: string;
  nationality: string;
  position: string;
  dob: string;
  image: string | null;
}

export interface WikiCareerEntry {
  team: string;
  teamId: string;
  startDate: string | null;
  endDate: string | null;
}

export interface WikiClub {
  id: string;
  name: string;
  country: string;
  league: string | null;
  image: string | null;
}

/* ── Search players by name ── */
export async function searchPlayers(name: string): Promise<WikiPlayer[]> {
  const candidates = await entitySearch(name, 50);
  if (candidates.length === 0) return [];

  const idOrder = candidates.map((c) => c.id);
  const ids = candidates.map((c) => `wd:${c.id}`).join(" ");
  const q = `
    SELECT ?player ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image WHERE {
      VALUES ?player { ${ids} }
      ?player wdt:P106 wd:Q937857 .
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P569 ?dob }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;
  const rows = await sparql(q);
  const seen = new Set<string>();
  const unsorted = rows
    .map((r) => {
      const id = r.player?.value?.split("/").pop() ?? "";
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: r.playerLabel?.value ?? "",
        nationality: r.nationalityLabel?.value ?? "",
        position: r.positionLabel?.value ?? "",
        dob: r.dob?.value?.slice(0, 10) ?? "",
        image: r.image?.value ?? null,
      };
    })
    .filter(Boolean) as WikiPlayer[];
  unsorted.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
  return unsorted;
}

/* ── Get player career (all clubs with dates) ── */
export async function getPlayerCareer(playerId: string): Promise<{ player: WikiPlayer; career: WikiCareerEntry[] }> {
  const q = `
    SELECT ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image
           ?teamLabel ?team ?startDate ?endDate WHERE {
      wd:${playerId} wdt:P106 wd:Q937857 .
      OPTIONAL { wd:${playerId} wdt:P27 ?nationality }
      OPTIONAL { wd:${playerId} wdt:P413 ?position }
      OPTIONAL { wd:${playerId} wdt:P569 ?dob }
      OPTIONAL { wd:${playerId} wdt:P18 ?image }
      OPTIONAL {
        wd:${playerId} p:P54 ?membership .
        ?membership ps:P54 ?team .
        OPTIONAL { ?membership pq:P580 ?startDate }
        OPTIONAL { ?membership pq:P582 ?endDate }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?startDate
  `;
  const rows = await sparql(q);
  if (rows.length === 0) throw new Error("Player not found");

  const first = rows[0];
  const player: WikiPlayer = {
    id: playerId,
    name: first.playerLabel?.value ?? "",
    nationality: first.nationalityLabel?.value ?? "",
    position: first.positionLabel?.value ?? "",
    dob: first.dob?.value?.slice(0, 10) ?? "",
    image: first.image?.value ?? null,
  };

  const seen = new Set<string>();
  const career: WikiCareerEntry[] = [];
  for (const row of rows) {
    const teamUri = row.team?.value;
    if (!teamUri) continue;
    const key = `${teamUri}-${row.startDate?.value ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    career.push({
      team: row.teamLabel?.value ?? "",
      teamId: teamUri.split("/").pop() ?? "",
      startDate: row.startDate?.value?.slice(0, 10) ?? null,
      endDate: row.endDate?.value?.slice(0, 10) ?? null,
    });
  }

  return { player, career };
}

/* ── Search clubs by name ── */
export async function searchClubs(name: string): Promise<WikiClub[]> {
  const candidates = await entitySearch(name, 30);
  if (candidates.length === 0) return [];

  const idOrder = candidates.map((c) => c.id);
  const ids = candidates.map((c) => `wd:${c.id}`).join(" ");
  const q = `
    SELECT ?club ?clubLabel ?countryLabel ?leagueLabel ?image WHERE {
      VALUES ?club { ${ids} }
      ?club wdt:P31/wdt:P279* wd:Q476028 .
      OPTIONAL { ?club wdt:P17 ?country }
      OPTIONAL { ?club wdt:P118 ?league }
      OPTIONAL { ?club wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;
  const rows = await sparql(q);
  const seen = new Set<string>();
  const unsorted = rows
    .map((r) => {
      const id = r.club?.value?.split("/").pop() ?? "";
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: r.clubLabel?.value ?? "",
        country: r.countryLabel?.value ?? "",
        league: r.leagueLabel?.value ?? null,
        image: r.image?.value ?? null,
      };
    })
    .filter(Boolean) as WikiClub[];
  unsorted.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
  return unsorted;
}

/* ── Get club squad (current players) ── */
export async function getClubSquad(clubId: string): Promise<{ club: WikiClub; players: WikiPlayer[] }> {
  const q = `
    SELECT DISTINCT ?clubLabel ?countryLabel ?leagueLabel ?clubImage
           ?player ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image WHERE {
      OPTIONAL { wd:${clubId} wdt:P17 ?country }
      OPTIONAL { wd:${clubId} wdt:P118 ?league }
      OPTIONAL { wd:${clubId} wdt:P18 ?clubImage }
      ?player wdt:P106 wd:Q937857 ;
              p:P54 ?membership .
      ?membership ps:P54 wd:${clubId} .
      FILTER NOT EXISTS { ?membership pq:P582 ?endDate }
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P569 ?dob }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?positionLabel ?playerLabel
  `;
  const rows = await sparql(q);

  const first = rows[0];
  const club: WikiClub = {
    id: clubId,
    name: first?.clubLabel?.value ?? clubId,
    country: first?.countryLabel?.value ?? "",
    league: first?.leagueLabel?.value ?? null,
    image: first?.clubImage?.value ?? null,
  };

  const seen = new Set<string>();
  const players: WikiPlayer[] = [];
  for (const row of rows) {
    const id = row.player?.value?.split("/").pop() ?? "";
    if (seen.has(id)) continue;
    seen.add(id);
    players.push({
      id,
      name: row.playerLabel?.value ?? "",
      nationality: row.nationalityLabel?.value ?? "",
      position: row.positionLabel?.value ?? "",
      dob: row.dob?.value?.slice(0, 10) ?? "",
      image: row.image?.value ?? null,
    });
  }

  return { club, players };
}

/* ── Find players who played for both clubs ── */
export async function findPlayersForBothClubs(
  clubId1: string,
  clubId2: string,
): Promise<{ club1: string; club2: string; players: WikiPlayer[] }> {
  const q = `
    SELECT DISTINCT ?player ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image
           ?club1Label ?club2Label WHERE {
      ?player wdt:P106 wd:Q937857 ;
              p:P54 ?mem1 ;
              p:P54 ?mem2 .
      ?mem1 ps:P54 wd:${clubId1} .
      ?mem2 ps:P54 wd:${clubId2} .
      BIND(wd:${clubId1} AS ?club1)
      BIND(wd:${clubId2} AS ?club2)
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P569 ?dob }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?playerLabel
  `;
  const rows = await sparql(q);

  const club1 = rows[0]?.club1Label?.value ?? clubId1;
  const club2 = rows[0]?.club2Label?.value ?? clubId2;

  const seen = new Set<string>();
  const players: WikiPlayer[] = [];
  for (const row of rows) {
    const id = row.player?.value?.split("/").pop() ?? "";
    if (seen.has(id)) continue;
    seen.add(id);
    players.push({
      id,
      name: row.playerLabel?.value ?? "",
      nationality: row.nationalityLabel?.value ?? "",
      position: row.positionLabel?.value ?? "",
      dob: row.dob?.value?.slice(0, 10) ?? "",
      image: row.image?.value ?? null,
    });
  }

  return { club1, club2, players };
}

/* ── Get all players who played for a club (historical) ── */
export async function getClubHistory(clubId: string): Promise<{ club: WikiClub; players: (WikiPlayer & { startDate: string | null; endDate: string | null })[] }> {
  const q = `
    SELECT DISTINCT ?clubLabel ?countryLabel ?leagueLabel ?clubImage
           ?player ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image ?startDate ?endDate WHERE {
      OPTIONAL { wd:${clubId} wdt:P17 ?country }
      OPTIONAL { wd:${clubId} wdt:P118 ?league }
      OPTIONAL { wd:${clubId} wdt:P18 ?clubImage }
      ?player wdt:P106 wd:Q937857 ;
              p:P54 ?membership .
      ?membership ps:P54 wd:${clubId} .
      OPTIONAL { ?membership pq:P580 ?startDate }
      OPTIONAL { ?membership pq:P582 ?endDate }
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P569 ?dob }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY DESC(?startDate)
    LIMIT 200
  `;
  const rows = await sparql(q);

  const first = rows[0];
  const club: WikiClub = {
    id: clubId,
    name: first?.clubLabel?.value ?? clubId,
    country: first?.countryLabel?.value ?? "",
    league: first?.leagueLabel?.value ?? null,
    image: first?.clubImage?.value ?? null,
  };

  const seen = new Set<string>();
  const players: (WikiPlayer & { startDate: string | null; endDate: string | null })[] = [];
  for (const row of rows) {
    const id = row.player?.value?.split("/").pop() ?? "";
    const key = `${id}-${row.startDate?.value ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({
      id,
      name: row.playerLabel?.value ?? "",
      nationality: row.nationalityLabel?.value ?? "",
      position: row.positionLabel?.value ?? "",
      dob: row.dob?.value?.slice(0, 10) ?? "",
      image: row.image?.value ?? null,
      startDate: row.startDate?.value?.slice(0, 10) ?? null,
      endDate: row.endDate?.value?.slice(0, 10) ?? null,
    });
  }

  return { club, players };
}
