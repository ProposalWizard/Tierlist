// A stand-in for the Supabase client that mimics PostgREST semantics closely
// enough to exercise the real pool code: filters, keyset paging, the 1000-row
// server cap, and ordering.
export function makeFakeDb({ rows, hardCap = 1000, failAfterPages = null, storage = false }) {
  let pageCount = 0;
  const stats = { queries: 0, pages: 0 };

  // Opt-in stand-in for Supabase Storage, used by the staging tests. Off by
  // default so the query-count and randomness tests keep measuring the pure
  // database path.
  const files = new Map();
  const fakeStorage = {
    from: (bucket) => ({
      async download(path) {
        const body = files.get(`${bucket}/${path}`);
        return body === undefined
          ? { data: null, error: { message: "Object not found" } }
          : { data: { text: async () => body }, error: null };
      },
      async upload(path, body, _opts) {
        files.set(`${bucket}/${path}`, typeof body === "string" ? body : await body.text());
        return { data: { path }, error: null };
      },
      async remove(paths) {
        for (const p of paths) files.delete(`${bucket}/${p}`);
        return { data: [], error: null };
      },
    }),
  };

  function makeQuery(table) {
    const f = { table, filters: [], order: null, limitN: null, rangeFrom: null, rangeTo: null };
    const q = {
      select(cols, opts) { f.cols = cols; f.opts = opts; return q; },
      in(col, vals) { f.filters.push(r => vals.includes(r[col])); return q; },
      not(col, _op, _v) { f.filters.push(r => r[col] !== null && r[col] !== undefined); return q; },
      gte(col, v) { f.filters.push(r => r[col] >= v); return q; },
      lte(col, v) { f.filters.push(r => r[col] <= v); return q; },
      gt(col, v) { f.filters.push(r => r[col] > v); return q; },
      lt(col, v) { f.filters.push(r => r[col] < v); return q; },
      eq(col, v) { f.filters.push(r => r[col] === v); return q; },
      or() { f.filters.push(r => r.league === "Premier League"); return q; },
      ilike() { return q; },
      order(col, o) { f.order = { col, asc: o?.ascending !== false }; return q; },
      limit(n) { f.limitN = n; return q.then ? q : q; },
      range(a, b) { f.rangeFrom = a; f.rangeTo = b; return q; },
      maybeSingle() { return run().then(r => ({ data: r.data?.[0] ?? null, error: r.error })); },
      then(res, rej) { return run().then(res, rej); },
    };
    async function run() {
      stats.queries++;
      let out = rows.filter(r => f.filters.every(fn => fn(r)));
      if (f.order) {
        const { col, asc } = f.order;
        out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (f.rangeFrom !== null) out = out.slice(f.rangeFrom, f.rangeTo + 1);
      if (f.limitN !== null) out = out.slice(0, f.limitN);
      // PostgREST hard-caps every response regardless of the requested limit.
      const capped = out.slice(0, hardCap);
      stats.pages++;
      pageCount++;
      if (failAfterPages !== null && pageCount > failAfterPages) {
        return { data: null, error: { message: "canceling statement due to statement timeout" } };
      }
      return { data: capped, error: null };
    }
    return q;
  }
  const db = { from: makeQuery, __stats: stats, __files: files };
  if (storage) db.storage = fakeStorage;
  return db;
}

// ~560 PL players per edition across 20 editions, like the real table.
export function buildRows() {
  const POSN = ["GK","RB","CB","CB","LB","CDM","CM","CM","CAM","RW","LW","ST"];
  const rows = [];
  let id = 1;
  for (let year = 2007; year <= 2026; year++) {
    for (let i = 0; i < 560; i++) {
      rows.push({
        id: id++,                       // ascending by edition, like import order
        sofifa_id: `p${year}_${i}`,
        name: `Player ${year}-${i}`,
        overall: 60 + (i % 35),
        manual_overall: null,
        positions: POSN[i % POSN.length],
        manual_positions: null,
        age: 25, image_url: null, nationality: "England",
        manual_nationality: null, club: `Club ${i % 20}`,
        league: "Premier League",
        fifa_edition: `FIFA ${year}`, fifa_year: year,
      });
    }
  }
  return rows;
}
