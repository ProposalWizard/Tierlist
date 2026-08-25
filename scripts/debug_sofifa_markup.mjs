/**
 * scripts/debug_sofifa_markup.mjs
 *
 * ONE-TIME DIAGNOSTIC — not part of the app, delete once the scraper fix
 * lands and is confirmed. Zero dependencies on purpose: it can run from
 * literally anywhere (a Desktop, a random folder) with nothing installed
 * beyond Node itself, since getting a real project checkout in place has
 * been the actual blocker every time so far, not the diagnostic itself.
 *
 * Reported directly: `sofifa_players` rows scraped for the Championship came
 * back with every player's nationality as "United States" and a garbled
 * positions string with nine entries, some of them (LCM, RDM, ...) not real
 * position tags at all — they look like they came from the position-RATINGS
 * grid on a player's page rather than the actual "plays as" badges under
 * their name. `lib/sofifaScraper.ts`'s selectors were presumably right when
 * written, but SoFIFA's own markup can only be read live, and the network
 * this normally runs from (the Claude session) is blocked from reaching
 * sofifa.com by an organisation policy denial — not something to route
 * around. This has to run somewhere with real network access instead, and
 * its output pasted back so the fix is built against the real markup
 * rather than a guess.
 *
 * Run (from anywhere, e.g. a plain Command Prompt on the Desktop):
 *   node debug_sofifa_markup.mjs
 *
 * Optionally: node debug_sofifa_markup.mjs <sofifaId> <versionCode>
 * Defaults to Hans Vanaken (200155) — the exact player named in the report,
 * with a known-correct answer to check against: Belgium, "CAM CM CDM".
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  console.log(`GET ${url} -> ${res.status}`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.text();
}

function section(title) {
  console.log(`\n${"=".repeat(10)} ${title} ${"=".repeat(10)}`);
}

/** Every match of `needle` in `html`, with `pad` characters of context either side. */
function contextsOf(html, needle, pad = 150, max = 25) {
  const out = [];
  let from = 0;
  while (out.length < max) {
    const i = html.indexOf(needle, from);
    if (i === -1) break;
    out.push(html.slice(Math.max(0, i - pad), i + needle.length + pad));
    from = i + needle.length;
  }
  return out;
}

function firstTagBlock(html, openTagStart, closeTag) {
  const start = html.indexOf(openTagStart);
  if (start === -1) return null;
  const end = html.indexOf(closeTag, start);
  if (end === -1) return null;
  return html.slice(start, end + closeTag.length);
}

async function main() {
  const sofifaId = process.argv[2] ?? "200155";
  const versionCodeArg = process.argv[3];

  // ── 1. The player's own detail page — shows "Belgium" and "CAM CM CDM"
  // right under the name in the report's screenshot. ──
  const detailUrl = `https://sofifa.com/player/${sofifaId}`;
  const detailHtml = await fetchHtml(detailUrl);

  section("DETAIL PAGE <title> (confirms we hit the right player)");
  console.log((detailHtml.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim());

  section("DETAIL PAGE: every snippet containing class=\"pos");
  for (const c of contextsOf(detailHtml, 'class="pos')) console.log(c.replace(/\s+/g, " ") + "\n---");

  section("DETAIL PAGE: every snippet containing 'nationality' or a flag reference");
  for (const c of contextsOf(detailHtml, "flag")) console.log(c.replace(/\s+/g, " ") + "\n---");

  section("DETAIL PAGE: the first 20 <img ...> tags");
  const imgMatches = detailHtml.match(/<img\b[^>]*>/g) || [];
  for (const tag of imgMatches.slice(0, 20)) console.log(tag);

  // ── 2. The players LIST page — what the production scraper actually
  // reads from. Needs a version code; try to discover one from the detail
  // page's own links if not given. ──
  let versionCode = versionCodeArg;
  if (!versionCode) {
    const m =
      detailHtml.match(/\/players\?r=(\d+)/) ||
      detailHtml.match(/\/player\/\d+\/[^/"]+\/(\d+)\//);
    versionCode = m ? m[1] : undefined;
  }

  if (versionCode) {
    const listUrl = `https://sofifa.com/players?r=${versionCode}&set=true&offset=0`;
    const listHtml = await fetchHtml(listUrl);

    section(`LIST PAGE (r=${versionCode}): first <tr>...</tr> row, raw`);
    const row = firstTagBlock(listHtml.slice(listHtml.indexOf("<tbody")), "<tr", "</tr>");
    console.log(row ?? "(could not find a <tr> row — pasting first 3000 chars of the page instead)");
    if (!row) console.log(listHtml.slice(0, 3000));

    if (row) {
      section("LIST PAGE: every snippet in that row containing class=\"pos");
      for (const c of contextsOf(row, 'class="pos', 100, 15)) console.log(c.replace(/\s+/g, " ") + "\n---");

      section("LIST PAGE: every <img ...> tag in that row");
      for (const tag of row.match(/<img\b[^>]*>/g) || []) console.log(tag);
    }
  } else {
    console.log("\n(could not determine a version code for the list page — pass one as the 2nd argument)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
