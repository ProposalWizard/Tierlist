const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

async function sparql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Knowitball/1.0 (knowitballcontact@gmail.com)", Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return (json.results?.bindings ?? []) as T[];
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
  const q = `
    SELECT DISTINCT ?player ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image WHERE {
      ?player wdt:P106 wd:Q937857 ;
              rdfs:label ?label .
      FILTER(LANG(?label) = "en")
      FILTER(CONTAINS(LCASE(?label), "${name.toLowerCase().replace(/"/g, "")}"))
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P569 ?dob }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    LIMIT 30
  `;
  const rows = await sparql(q);
  const seen = new Set<string>();
  return rows
    .map((r: Record<string, Record<string, string>>) => {
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
}

/* ── Get player career (all clubs with dates) ── */
export async function getPlayerCareer(playerId: string): Promise<{ player: WikiPlayer; career: WikiCareerEntry[] }> {
  const q = `
    SELECT ?playerLabel ?nationalityLabel ?positionLabel ?dob ?image
           ?teamLabel ?team ?startDate ?endDate WHERE {
      wd:${playerId} wdt:P106 wd:Q937857 ;
                      rdfs:label ?pLabel .
      FILTER(LANG(?pLabel) = "en")
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

  const first = rows[0] as Record<string, Record<string, string>>;
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
  for (const r of rows) {
    const row = r as Record<string, Record<string, string>>;
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
  const q = `
    SELECT DISTINCT ?club ?clubLabel ?countryLabel ?leagueLabel ?image WHERE {
      ?club wdt:P31/wdt:P279* wd:Q476028 ;
            rdfs:label ?label .
      FILTER(LANG(?label) = "en")
      FILTER(CONTAINS(LCASE(?label), "${name.toLowerCase().replace(/"/g, "")}"))
      OPTIONAL { ?club wdt:P17 ?country }
      OPTIONAL { ?club wdt:P118 ?league }
      OPTIONAL { ?club wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    LIMIT 30
  `;
  const rows = await sparql(q);
  const seen = new Set<string>();
  return rows
    .map((r: Record<string, Record<string, string>>) => {
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

  const first = rows[0] as Record<string, Record<string, string>> | undefined;
  const club: WikiClub = {
    id: clubId,
    name: first?.clubLabel?.value ?? clubId,
    country: first?.countryLabel?.value ?? "",
    league: first?.leagueLabel?.value ?? null,
    image: first?.clubImage?.value ?? null,
  };

  const seen = new Set<string>();
  const players: WikiPlayer[] = [];
  for (const r of rows) {
    const row = r as Record<string, Record<string, string>>;
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

  const first = rows[0] as Record<string, Record<string, string>> | undefined;
  const club: WikiClub = {
    id: clubId,
    name: first?.clubLabel?.value ?? clubId,
    country: first?.countryLabel?.value ?? "",
    league: first?.leagueLabel?.value ?? null,
    image: first?.clubImage?.value ?? null,
  };

  const seen = new Set<string>();
  const players: (WikiPlayer & { startDate: string | null; endDate: string | null })[] = [];
  for (const r of rows) {
    const row = r as Record<string, Record<string, string>>;
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
