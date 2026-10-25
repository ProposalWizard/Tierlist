#!/usr/bin/env node
/**
 * scripts/supabase/export-sofifa-attributes.mjs — the cold copy of the FIFA stats.
 *
 * READ ONLY. What: reads every row's id, year and full stats bundle
 * (sofifa_players: sofifa_id, fifa_year, attributes) and writes them to one
 * gzipped file, one player-edition per line. Changes nothing in the database.
 * Why: supabase/migrations/fifa_stats_drop_unnamed_keys.sql removes keys no
 * screen reads; this copy (kept in Cloudflare R2) is how none of them is lost.
 *
 * Uses only the public anon key: sofifa_players is public-read by RLS.
 * Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the
 * environment or in .env.local.
 *
 *   node scripts/supabase/export-sofifa-attributes.mjs [out.jsonl.gz]
 *
 * Prints the row count at the end; it should match block 1 of
 * supabase/checks/fifa_stats_columns.sql.
 */
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (env or .env.local).");
  process.exit(1);
}

const day = new Date().toISOString().slice(0, 10);
const out = process.argv[2] ?? `sofifa_attributes_${day}.jsonl.gz`;
const supabase = createClient(url, key, { auth: { persistSession: false } });
const gzip = createGzip({ level: 9 });
const done = new Promise((resolve, reject) => {
  gzip.pipe(createWriteStream(out)).on("finish", resolve).on("error", reject);
});

const PAGE = 1000;
let lastId = 0;
let rows = 0;
for (;;) {
  // Keyset paging on the primary key: stable and never skips a row.
  const { data, error } = await supabase
    .from("sofifa_players")
    .select("id, sofifa_id, fifa_year, attributes")
    .gt("id", lastId)
    .order("id", { ascending: true })
    .limit(PAGE);
  if (error) { console.error("Read failed:", error.message); process.exit(1); }
  if (!data.length) break;
  for (const r of data) {
    if (!gzip.write(JSON.stringify({ sofifa_id: r.sofifa_id, fifa_year: r.fifa_year, attributes: r.attributes }) + "\n")) {
      await new Promise((res) => gzip.once("drain", res));
    }
  }
  rows += data.length;
  lastId = data[data.length - 1].id;
  if (rows % 20000 < data.length) console.log(`${rows} rows…`);
  // No "short page = last page" shortcut: the project's row cap may be under PAGE.
}
gzip.end();
await done;
console.log(`Done: ${rows} rows written to ${out}`);
