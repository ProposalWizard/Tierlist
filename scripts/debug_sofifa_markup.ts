/**
 * scripts/debug_sofifa_markup.ts
 *
 * ONE-TIME DIAGNOSTIC — not part of the app, delete once the scraper fix
 * lands and is confirmed.
 *
 * Reported directly: `sofifa_players` rows scraped for the Championship came
 * back with every player's nationality as "United States" and a garbled
 * positions string with nine entries, some of them (LCM, RDM, ...) not real
 * position tags at all — they look like they came from the position-RATINGS
 * grid on a player's page rather than the actual "plays as" badges under
 * their name. `lib/sofifaScraper.ts`'s selectors (`span.pos` for positions,
 * `div img[title]` for nationality) were presumably right when they were
 * written, but SoFIFA's own markup can only be read live, and this sandbox's
 * network egress is blocked for sofifa.com entirely (an organisation policy
 * denial, confirmed via the proxy status endpoint — not something to route
 * around). This has to be run somewhere with real network access — a local
 * `npm run dev` machine, not here — and its output pasted back so the fix is
 * built against the real markup instead of a guess.
 *
 * Run:
 *   npx tsx scripts/debug_sofifa_markup.ts [sofifaId] [versionCode]
 *
 * Defaults to Hans Vanaken (200155) — the exact player named in the report,
 * with a known-correct answer to check against: Belgium, "CAM CM CDM".
 */
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
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

function section(title: string) {
  console.log(`\n${"=".repeat(10)} ${title} ${"=".repeat(10)}`);
}

async function main() {
  const sofifaId = process.argv[2] ?? "200155";
  const versionCode = process.argv[3]; // optional; auto-discovered if omitted

  // ── 1. The player's own detail page — this is what shows "Belgium" and
  // "CAM CM CDM" right under the name in the report's second screenshot. ──
  const detailUrl = `https://sofifa.com/player/${sofifaId}`;
  const detailHtml = await fetchHtml(detailUrl);
  const $d = cheerio.load(detailHtml);

  section("DETAIL PAGE <title> + canonical URL (confirms we hit the right player)");
  console.log($d("title").text());
  console.log($d('link[rel="canonical"]').attr("href"));

  section("DETAIL PAGE: whole info/meta block around the name");
  // Grab a generous area since we don't know the current class names —
  // print raw HTML around anything that looks like the player header so the
  // real structure is visible rather than guessed at.
  const infoCandidates = $d("div.info, .card.pc, div.meta, .col-4, .grid").first();
  console.log(infoCandidates.length ? $d.html(infoCandidates) : "(no obvious header container found — dumping <body> start instead)");
  if (!infoCandidates.length) console.log($d.html("body")?.slice(0, 4000));

  section("DETAIL PAGE: every element whose class contains 'pos'");
  $d("[class*=pos]").each((_, el) => {
    console.log($d.html(el)?.slice(0, 300));
  });

  section("DETAIL PAGE: every <img> near the top of the page (nationality flag is one of these)");
  $d("img").slice(0, 15).each((_, el) => {
    console.log($d.html(el));
  });

  // ── 2. The players LIST page — what the production scraper actually
  // reads from (lib/sofifaScraper.ts's scrapePage). Needs a version code;
  // reuse the one embedded in the detail page's own links if not given. ──
  let vCode: string | undefined = versionCode;
  if (!vCode) {
    const href = $d('a[href*="/players?"]').attr("href") ?? $d('a[href^="/player/"]').attr("href") ?? "";
    const m = href.match(/[?&]r=(\d+)/) || detailHtml.match(/\/player\/\d+\/[^/]+\/(\d+)\//);
    vCode = m ? m[1] : undefined;
  }
  if (vCode) {
    const listUrl = `https://sofifa.com/players?r=${vCode}&set=true&offset=0`;
    const listHtml = await fetchHtml(listUrl);
    const $l = cheerio.load(listHtml);

    section(`LIST PAGE (r=${vCode}): first row's raw HTML`);
    const firstRow = $l("table > tbody > tr").first();
    console.log($l.html(firstRow));

    section("LIST PAGE: span.pos count and text in that first row");
    const spans = firstRow.find("span.pos");
    console.log(`count: ${spans.length}`);
    spans.each((_, el) => console.log(` - "${$l(el).text().trim()}"  class="${$l(el).attr("class")}"`));

    section("LIST PAGE: div img (nationality candidate) in that first row's name cell");
    const tds = firstRow.find("td");
    const nameCell = $l(tds[1]);
    nameCell.find("div img").each((_, el) => {
      console.log($l.html(el));
    });
  } else {
    console.log("\n(could not determine a version code for the list page — pass one as argv[2])");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
