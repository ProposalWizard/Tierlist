const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "Knowitball/1.0 (knowitballcontact@gmail.com)";

async function runSparql(query: string): Promise<Record<string, { value: string } | undefined>[]> {
  const res = await fetch(SPARQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "User-Agent": UA,
    },
    body: `query=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SPARQL ${res.status}: ${text.slice(0, 200)}`);
  }

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.results?.bindings ?? [];
  } catch {
    throw new Error(`SPARQL returned non-JSON: ${text.slice(0, 200)}`);
  }
}

function extractId(uri: string | undefined): string | null {
  if (!uri) return null;
  return uri.split("/").pop() ?? null;
}

function val(row: Record<string, { value: string } | undefined>, key: string): string | null {
  return row?.[key]?.value ?? null;
}

// Phase 1: Fast player import — names + DOB only (no OPTIONALs)
// half=1 → months 1-6, half=2 → months 7-12
export async function fetchPlayersByYear(year: number, half: 1 | 2) {
  const monthFilter = half === 1
    ? `&& MONTH(?dob) <= 6`
    : `&& MONTH(?dob) > 6`;
  const query = `
    SELECT ?player ?playerLabel ?dob WHERE {
      ?player wdt:P106 wd:Q937857 .
      ?player wdt:P569 ?dob .
      FILTER(YEAR(?dob) = ${year} ${monthFilter})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;

  const rows = await runSparql(query);

  const players = new Map<string, {
    wikidata_id: string;
    name: string;
    date_of_birth: string | null;
  }>();

  for (const row of rows) {
    const pid = extractId(val(row, "player") ?? undefined);
    if (!pid || players.has(pid)) continue;
    players.set(pid, {
      wikidata_id: pid,
      name: val(row, "playerLabel") ?? pid,
      date_of_birth: val(row, "dob")?.slice(0, 10) ?? null,
    });
  }

  return { players: Array.from(players.values()), rawRows: rows.length };
}

export async function fetchPlayersNoDob() {
  const query = `
    SELECT ?player ?playerLabel WHERE {
      ?player wdt:P106 wd:Q937857 .
      FILTER NOT EXISTS { ?player wdt:P569 ?anyDob }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    LIMIT 10000
  `;

  const rows = await runSparql(query);

  const players = new Map<string, {
    wikidata_id: string;
    name: string;
    date_of_birth: string | null;
  }>();

  for (const row of rows) {
    const pid = extractId(val(row, "player") ?? undefined);
    if (!pid || players.has(pid)) continue;
    players.set(pid, {
      wikidata_id: pid,
      name: val(row, "playerLabel") ?? pid,
      date_of_birth: null,
    });
  }

  return { players: Array.from(players.values()), rawRows: rows.length };
}

// Phase 2: Enrich players with nationality, position, image (VALUES-based)
export async function fetchPlayerDetails(playerIds: string[]) {
  if (playerIds.length === 0) return { details: [], countries: [] };

  const values = playerIds.map((id) => `wd:${id}`).join(" ");
  const query = `
    SELECT ?player ?nationality ?nationalityLabel ?positionLabel ?image WHERE {
      VALUES ?player { ${values} }
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;

  const rows = await runSparql(query);

  const details = new Map<string, {
    wikidata_id: string;
    country_id: string | null;
    position: string | null;
    image_url: string | null;
  }>();
  const countries = new Map<string, { wikidata_id: string; name: string }>();

  for (const row of rows) {
    const pid = extractId(val(row, "player") ?? undefined);
    if (!pid || details.has(pid)) continue;

    const cid = extractId(val(row, "nationality") ?? undefined);
    const cname = val(row, "nationalityLabel");
    if (cid && cname && !countries.has(cid)) {
      countries.set(cid, { wikidata_id: cid, name: cname });
    }

    details.set(pid, {
      wikidata_id: pid,
      country_id: cid,
      position: val(row, "positionLabel"),
      image_url: val(row, "image"),
    });
  }

  return {
    details: Array.from(details.values()),
    countries: Array.from(countries.values()),
  };
}

// Image-only fetch: fast query that skips OPTIONAL (only returns players WITH images)
export async function fetchPlayerImages(playerIds: string[]): Promise<{ wikidata_id: string; image_url: string }[]> {
  if (playerIds.length === 0) return [];

  const values = playerIds.map((id) => `wd:${id}`).join(" ");
  const query = `
    SELECT ?player ?image WHERE {
      VALUES ?player { ${values} }
      ?player wdt:P18 ?image .
    }
  `;

  const rows = await runSparql(query);
  const seen = new Set<string>();
  const results: { wikidata_id: string; image_url: string }[] = [];

  for (const row of rows) {
    const pid = extractId(val(row, "player") ?? undefined);
    const img = val(row, "image");
    if (!pid || !img || seen.has(pid)) continue;
    seen.add(pid);
    results.push({ wikidata_id: pid, image_url: img });
  }

  return results;
}

// Phase 3: Careers for specific players (VALUES-based)
export async function fetchCareersForPlayers(playerIds: string[]) {
  if (playerIds.length === 0) return { careers: [], clubs: [] };

  const values = playerIds.map((id) => `wd:${id}`).join(" ");
  const query = `
    SELECT ?player ?club ?clubLabel ?startDate ?endDate WHERE {
      VALUES ?player { ${values} }
      ?player p:P54 ?membership .
      ?membership ps:P54 ?club .
      OPTIONAL { ?membership pq:P580 ?startDate }
      OPTIONAL { ?membership pq:P582 ?endDate }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;

  const rows = await runSparql(query);

  const careers: {
    player_id: string;
    club_id: string;
    start_date: string;
    end_date: string | null;
  }[] = [];
  const clubs = new Map<string, { wikidata_id: string; name: string }>();
  const seen = new Set<string>();

  for (const row of rows) {
    const pid = extractId(val(row, "player") ?? undefined);
    const cid = extractId(val(row, "club") ?? undefined);
    if (!pid || !cid) continue;

    if (!clubs.has(cid)) {
      clubs.set(cid, { wikidata_id: cid, name: val(row, "clubLabel") ?? cid });
    }

    const startDate = val(row, "startDate")?.slice(0, 10) ?? "";
    const endDate = val(row, "endDate")?.slice(0, 10) ?? null;
    const key = `${pid}-${cid}-${startDate}`;
    if (seen.has(key)) continue;
    seen.add(key);

    careers.push({ player_id: pid, club_id: cid, start_date: startDate, end_date: endDate });
  }

  return {
    careers,
    clubs: Array.from(clubs.values()),
  };
}

export async function fetchCountryFlags(countryIds: string[]) {
  if (countryIds.length === 0) return [];

  const values = countryIds.map((id) => `wd:${id}`).join(" ");
  const query = `
    SELECT ?country ?flag WHERE {
      VALUES ?country { ${values} }
      OPTIONAL { ?country wdt:P41 ?flag }
    }
  `;

  const rows = await runSparql(query);
  return rows
    .map((row) => ({
      wikidata_id: extractId(val(row, "country") ?? undefined),
      flag_url: val(row, "flag"),
    }))
    .filter((c): c is { wikidata_id: string; flag_url: string | null } => !!c.wikidata_id);
}

export async function fetchClubDetails(clubIds: string[]) {
  if (clubIds.length === 0) return [];

  const values = clubIds.map((id) => `wd:${id}`).join(" ");
  const query = `
    SELECT ?club ?clubLabel ?countryLabel ?leagueLabel ?image WHERE {
      VALUES ?club { ${values} }
      OPTIONAL { ?club wdt:P17 ?country }
      OPTIONAL { ?club wdt:P118 ?league }
      OPTIONAL { ?club wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
  `;

  const rows = await runSparql(query);

  const clubMap = new Map<string, {
    wikidata_id: string;
    name: string;
    country: string | null;
    league: string | null;
    image_url: string | null;
  }>();

  for (const row of rows) {
    const id = extractId(val(row, "club") ?? undefined);
    if (!id || clubMap.has(id)) continue;
    clubMap.set(id, {
      wikidata_id: id,
      name: val(row, "clubLabel") ?? id,
      country: val(row, "countryLabel"),
      league: val(row, "leagueLabel"),
      image_url: val(row, "image"),
    });
  }

  return Array.from(clubMap.values());
}
