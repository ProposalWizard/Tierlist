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
    throw new Error(`SPARQL ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.results?.bindings ?? [];
}

function extractId(uri: string | undefined): string | null {
  if (!uri) return null;
  return uri.split("/").pop() ?? null;
}

function val(row: Record<string, { value: string } | undefined>, key: string): string | null {
  return row?.[key]?.value ?? null;
}

export async function fetchPlayerBatch(offset: number, limit: number = 2000) {
  const query = `
    SELECT ?player ?playerLabel ?dob ?nationality ?nationalityLabel ?positionLabel ?image WHERE {
      ?player wdt:P106 wd:Q937857 .
      OPTIONAL { ?player wdt:P569 ?dob }
      OPTIONAL { ?player wdt:P27 ?nationality }
      OPTIONAL { ?player wdt:P413 ?position }
      OPTIONAL { ?player wdt:P18 ?image }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?player
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const rows = await runSparql(query);

  const players = new Map<string, {
    wikidata_id: string;
    name: string;
    date_of_birth: string | null;
    country_id: string | null;
    position: string | null;
    image_url: string | null;
  }>();
  const countries = new Map<string, { wikidata_id: string; name: string }>();

  for (const row of rows) {
    const pid = extractId(val(row, "player") ?? undefined);
    if (!pid || players.has(pid)) continue;

    const cid = extractId(val(row, "nationality") ?? undefined);
    const cname = val(row, "nationalityLabel");
    if (cid && cname && !countries.has(cid)) {
      countries.set(cid, { wikidata_id: cid, name: cname });
    }

    players.set(pid, {
      wikidata_id: pid,
      name: val(row, "playerLabel") ?? pid,
      date_of_birth: val(row, "dob")?.slice(0, 10) ?? null,
      country_id: cid,
      position: val(row, "positionLabel"),
      image_url: val(row, "image"),
    });
  }

  return {
    players: Array.from(players.values()),
    countries: Array.from(countries.values()),
    rawRows: rows.length,
    hasMore: rows.length >= limit,
  };
}

export async function fetchCareerBatch(offset: number, limit: number = 3000) {
  const query = `
    SELECT ?player ?club ?clubLabel ?startDate ?endDate WHERE {
      ?player wdt:P106 wd:Q937857 .
      ?player p:P54 ?membership .
      ?membership ps:P54 ?club .
      OPTIONAL { ?membership pq:P580 ?startDate }
      OPTIONAL { ?membership pq:P582 ?endDate }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    ORDER BY ?player ?club
    LIMIT ${limit}
    OFFSET ${offset}
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
    rawRows: rows.length,
    hasMore: rows.length >= limit,
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
