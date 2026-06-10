"""
Scrape ALL SoFIFA players across every FIFA edition (07-26).

Captures, for every player in every edition:
  - identity: sofifa_id, name, positions, nationality, age, overall, potential
  - club + league (the columns that were silently missing before)
  - EVERY stat column SoFIFA exposes (pulled dynamically from the page so
    nothing is left out)
  - face image URL at high resolution, specific to that FIFA edition

Run from your Windows desktop:
  pip install playwright beautifulsoup4 playwright-stealth
  python scrape_missing.py

Single tab, Next button navigation. Stealth + persistent cookies
reduce captchas. Solve Cloudflare once if shown — cookie persists.

Flags:
  --force            Re-scrape all editions, even complete ones
  --year=YYYY        Scrape only that edition
  --pl-only          Scrape only the Premier League (fast, ~10 pages/edition)
  --download-faces   Also download face images to sofifa_data/faces/
"""

import asyncio
import json, os, random, re, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

# playwright-stealth v2.x API
stealth_async = None
try:
    from playwright_stealth import stealth_async  # type: ignore
except ImportError:
    try:
        from playwright_stealth import Stealth
        _stealth = Stealth()
        async def stealth_async(page):
            await _stealth.apply_stealth_async(page)
    except ImportError:
        print("NOTE: playwright-stealth not installed (optional, reduces CAPTCHAs).")
        print("  pip install playwright-stealth\n")

OUTPUT_DIR = Path.home() / "Desktop" / "sofifa_data"
# Fall back to OneDrive Desktop if the plain Desktop doesn't exist
if not OUTPUT_DIR.parent.exists():
    alt = Path.home() / "OneDrive" / "Desktop" / "sofifa_data"
    if alt.parent.exists():
        OUTPUT_DIR = alt
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PROFILE_DIR = OUTPUT_DIR / ".browser_profile"
PROFILE_DIR.mkdir(exist_ok=True)

FACES_DIR = OUTPUT_DIR / "faces"

ALL_YEARS = list(range(2026, 2006, -1))

VERSION_CODES = {
    2026: "240034", 2025: "240007", 2024: "230054", 2023: "230017",
    2022: "220069", 2021: "210064", 2020: "200061", 2019: "190075",
    2018: "180084", 2017: "170099", 2016: "160058", 2015: "150001",
    2014: "140052", 2013: "130034", 2012: "120002", 2011: "110003",
    2010: "100001", 2009: "090001", 2008: "080001", 2007: "070001",
}

# Premier League league ID on SoFIFA (only used with --pl-only).
PL_LEAGUE_ID = "13"

# Seed column IDs for the showCol[] URL parameter. This is expanded at runtime
# with every column SoFIFA actually offers (see discover_columns), so the seed
# list just guarantees the important ones are present from the first request.
# "tm" = Team/Club, "lg" = League — these were missing before, which is why
# club and league came back None for all players.
SEED_COLUMNS = [
    "pi", "ae", "oa", "pt", "tm", "lg",
    "pac", "sho", "pas", "dri", "def", "phy",
    "sm", "ir", "wf", "aw", "dw", "a/w", "d/w", "bs", "tp",
    "cr", "fi", "he", "lo", "sh", "vo",
    "ag", "re", "ha", "sp", "acc", "ss",
    "dr", "cu", "fk", "lp", "sc",
    "in", "po", "vi",
    "ma", "st", "ta",
    "gd", "gk", "gp", "gr",
    "tt", "vl", "rl",
]

# Expanded at runtime to the full set of columns SoFIFA offers.
ACTIVE_COLUMNS = list(SEED_COLUMNS)

# Column IDs that map to the club / league fields. These get extended at
# runtime by matching the dropdown's display names (so we adapt even if SoFIFA
# renames the column ID).
CLUB_COL_IDS = {"tm", "team", "club"}
LEAGUE_COL_IDS = {"lg", "league"}

BASE_URL = "https://sofifa.com/players"


def build_url(year: int, league_id: str | None) -> str:
    cols = ACTIVE_COLUMNS
    vc = VERSION_CODES.get(year, "")
    col_str = ",".join(cols)
    show_col = "".join(f"&showCol%5B%5D={c}" for c in cols)
    lg = f"&lg%5B%5D={league_id}" if league_id else ""
    return f"{BASE_URL}?type=all{lg}&r={vc}&set=true&col={col_str}{show_col}"


def upscale_face_url(url: str | None) -> str | None:
    """SoFIFA face URLs end in _NN.png (size). Normalise to 120px — the
    largest variant that exists reliably across ALL editions (older FIFA
    editions don't always have the 180px version, which would 404)."""
    if not url:
        return url
    return re.sub(r"_(\d+)\.png", "_120.png", url)


# ── Column discovery ─────────────────────────────────────────────────────────


async def discover_columns(page) -> dict[str, str]:
    """Read the showCol dropdown. Returns {col_id: display_name} and updates
    ACTIVE_COLUMNS / CLUB_COL_IDS / LEAGUE_COL_IDS in place."""
    options = await page.query_selector_all('select[name="showCol[]"] option')
    cols: dict[str, str] = {}
    for opt in options:
        value = await opt.get_attribute("value")
        text = (await opt.inner_text()).strip()
        if not value or not text:
            continue
        cols[value] = text

        # Add to the active column set so every column gets rendered + scraped
        if value not in ACTIVE_COLUMNS:
            ACTIVE_COLUMNS.append(value)

        # Auto-classify club / league columns by their display name
        lower = text.lower()
        if "team" in lower or "club" in lower:
            CLUB_COL_IDS.add(value)
        if "league" in lower:
            LEAGUE_COL_IDS.add(value)

    return cols


# ── HTML parsing ─────────────────────────────────────────────────────────────


def _get_col_id(el) -> str:
    for cls in el.get("class", []):
        if cls.startswith("col-"):
            return cls[4:]
    return el.get("data-col", "")


def _build_header_map(table) -> list[str]:
    header_row = table.select_one("thead tr")
    if not header_row:
        return []
    return [_get_col_id(th) for th in header_row.select("th")]


def _extract_pi_cell(td, player: dict):
    """Positions + nationality from the player info cell, plus a club/league
    link fallback."""
    pos_spans = td.select("span.pos")
    if not pos_spans:
        pos_spans = td.select("span[class*='pos']")
    if pos_spans:
        player["positions"] = ",".join(s.get_text(strip=True) for s in pos_spans)

    flag = td.select_one("img.flag")
    if not flag:
        flag = td.select_one("img[title]")
    if flag:
        player["nationality"] = flag.get("title", "")

    if not player.get("club"):
        club_link = (
            td.select_one('a[href*="/team/"]') or
            td.select_one('a[href*="/club/"]') or
            td.select_one('a[href*="&tm="]')
        )
        if club_link:
            player["club"] = club_link.get_text(strip=True)

    if not player.get("league"):
        league_link = (
            td.select_one('a[href*="/league/"]') or
            td.select_one('a[href*="/players?lg="]') or
            td.select_one('a[href*="&lg="]')
        )
        if league_link:
            player["league"] = league_link.get_text(strip=True)


def _cell_text(td) -> str:
    link = td.select_one("a")
    if link:
        return link.get_text(strip=True)
    return td.get_text(strip=True)


def _extract_td_value(col_id: str, td, player: dict):
    if col_id == "ae":
        player["age"] = td.get_text(strip=True)
    elif col_id == "oa":
        player["overall"] = td.get_text(strip=True)
    elif col_id == "pt":
        player["potential"] = td.get_text(strip=True)
    elif col_id == "pi":
        _extract_pi_cell(td, player)
    elif col_id in CLUB_COL_IDS:
        text = _cell_text(td)
        if text and not player.get("club"):
            player["club"] = text
    elif col_id in LEAGUE_COL_IDS:
        text = _cell_text(td)
        if text and not player.get("league"):
            player["league"] = text
    elif col_id:
        val = td.get_text(strip=True)
        if val:
            player[f"attr_{col_id}"] = val


def parse_html(html: str, dump_first: bool = False) -> list[dict]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    table = soup.select_one("table.table")
    if not table:
        for t in soup.select("table"):
            if t.select_one('a[href*="/player/"]'):
                table = t
                break
    if not table:
        return []

    header_ids = _build_header_map(table)

    rows = table.select("tbody tr")
    if not rows:
        rows = table.select("tr")

    players = []
    for row_idx, row in enumerate(rows):
        player: dict = {}

        name_link = row.select_one('a[href*="/player/"]')
        if not name_link:
            continue

        if dump_first and row_idx == 0:
            tds = row.select("td")
            print("\n  ─── HTML DIAGNOSTIC: First player row ───")
            for i, td in enumerate(tds):
                cls = td.get("class", [])
                dc = td.get("data-col", "")
                txt = td.get_text(strip=True)[:80]
                col_label = ""
                if i < len(header_ids) and header_ids[i]:
                    col_label = f" (header: {header_ids[i]})"
                print(f"  TD[{i}] class={cls} data-col='{dc}'{col_label}")
                print(f"         text='{txt}'")
                for a in td.select("a")[:3]:
                    print(f"         <a href='{a.get('href', '')[:60]}' text='{a.get_text(strip=True)}'")
            print(f"  Header map: {header_ids}")
            print("  ─── END DIAGNOSTIC ───\n")

        href = name_link.get("href", "")
        sofifa_id = ""
        parts = href.split("/")
        for i, part in enumerate(parts):
            if part == "player" and i + 1 < len(parts):
                sofifa_id = parts[i + 1]
                break

        player["sofifa_id"] = sofifa_id
        player["name"] = name_link.get_text(strip=True)

        img = row.select_one("img[data-src]")
        if not img:
            img = row.select_one("img[src*='sofifa']")
        if img:
            raw = img.get("data-src") or img.get("src", "")
            player["image_url"] = upscale_face_url(raw)

        tds = row.select("td")
        for idx, td in enumerate(tds):
            col_id = ""
            for cls in td.get("class", []):
                if cls.startswith("col-"):
                    col_id = cls[4:]
                    break
            if not col_id:
                col_id = td.get("data-col", "")
            if not col_id and idx < len(header_ids):
                col_id = header_ids[idx]

            if col_id:
                _extract_td_value(col_id, td, player)

        # Fallback: scan all cells for team/league links if still missing
        if not player.get("club"):
            for td in tds:
                for a in td.select("a"):
                    h = a.get("href", "")
                    if "/team/" in h or "/club/" in h:
                        player["club"] = a.get_text(strip=True)
                        break
                if player.get("club"):
                    break

        if not player.get("league"):
            for td in tds:
                for a in td.select("a"):
                    h = a.get("href", "")
                    if "/league/" in h or "lg=" in h:
                        player["league"] = a.get_text(strip=True)
                        break
                if player.get("league"):
                    break

        if player.get("sofifa_id") and player.get("name"):
            players.append(player)

    return players


# ── Async browser helpers ────────────────────────────────────────────────────


async def count_links(page) -> int:
    try:
        return len(await page.query_selector_all('a[href*="/player/"]'))
    except Exception:
        return 0


async def wait_for_players(page, timeout: int = 180) -> bool:
    print("  Waiting for players page (solve captcha if shown)...")
    deadline = time.time() + timeout
    last_count = -1

    while time.time() < deadline:
        count = await count_links(page)
        if count != last_count:
            print(f"  ...seeing {count} player links")
            last_count = count

        if count >= 10:
            await asyncio.sleep(3)
            if await count_links(page) >= 10:
                print(f"  Players page ready.")
                return True
            last_count = -1

        await asyncio.sleep(2)

    return False


# ── Face downloading (optional) ──────────────────────────────────────────────


async def download_face(context, url: str, year: int, sofifa_id: str) -> bool:
    """Download one face image to faces/<year>/<sofifa_id>.png."""
    if not url:
        return False
    dest_dir = FACES_DIR / str(year)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{sofifa_id}.png"
    if dest.exists():
        return True
    try:
        resp = await context.request.get(url)
        if resp.ok:
            dest.write_bytes(await resp.body())
            return True
    except Exception:
        pass
    return False


# ── Scraping ─────────────────────────────────────────────────────────────────


async def scrape_edition(page, context, year: int, league_id: str | None,
                         is_first: bool, download_faces: bool) -> list[dict]:
    label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"

    await page.goto(build_url(year, league_id), wait_until="commit")

    if not await wait_for_players(page):
        print(f"  Could not load {label}, skipping...")
        return []

    # On the first edition, discover the full column list and reload so every
    # column is rendered into the table.
    if is_first:
        disc = await discover_columns(page)
        if disc:
            print(f"\n  Discovered {len(disc)} column options from SoFIFA:")
            for cid, cname in sorted(disc.items()):
                marker = ""
                if cid in CLUB_COL_IDS:
                    marker = " ← CLUB"
                elif cid in LEAGUE_COL_IDS:
                    marker = " ← LEAGUE"
                print(f"    {cid:6s} = {cname}{marker}")
            print(f"\n  Scraping {len(ACTIVE_COLUMNS)} columns total.")
            # Reload with the full column set
            print("  Reloading with full column set...")
            await page.goto(build_url(year, league_id), wait_until="commit")
            await wait_for_players(page)
        else:
            print("  Could not discover columns — using seed list.")

    all_players = []
    page_num = 1

    while True:
        html = await page.content()
        players = parse_html(html, dump_first=(page_num == 1))

        if not players:
            print(f"  Page {page_num}: no players parsed, stopping.")
            break

        all_players.extend(players)

        if download_faces:
            for p in players:
                await download_face(context, p.get("image_url"), year, p.get("sofifa_id"))

        if page_num == 1:
            first = players[0]
            attr_keys = sorted(k for k in first if k.startswith("attr_"))
            clubs_found = sum(1 for p in players if p.get("club"))
            leagues_found = sum(1 for p in players if p.get("league"))
            faces_found = sum(1 for p in players if p.get("image_url"))
            print(f"  Page 1: {len(players)} players")
            print(f"  >>> {first.get('name')} | club={first.get('club')!r} | league={first.get('league')!r}")
            print(f"  >>> {len(attr_keys)} attrs: {attr_keys[:10]}...")
            print(f"  >>> Club: {clubs_found}/{len(players)} | League: {leagues_found}/{len(players)} | Faces: {faces_found}/{len(players)}")
            print(f"  >>> Face URL: {first.get('image_url')}")
            if clubs_found == 0:
                print(f"  ⚠ WARNING: No club data found on page 1!")
                print(f"    Check the DIAGNOSTIC output above and paste it to fix the column.")
            if len(attr_keys) < 5:
                print(f"  ⚠ WARNING: Very few attributes found!")
        elif page_num % 10 == 0:
            print(f"  Page {page_num}: {len(all_players)} players so far...")

        # Click Next
        try:
            next_btn = await page.query_selector('a.bp3-button[rel="next"]')
            if not next_btn:
                next_btn = await page.query_selector('a[rel="next"]')
            if not next_btn:
                pag_links = await page.query_selector_all(".pagination a")
                for link in pag_links:
                    text = (await link.inner_text()).strip()
                    if text in ("Next", "›", "»"):
                        next_btn = link
                        break

            if not next_btn:
                print(f"  No more pages. Total: {len(all_players)} players.")
                break

            await next_btn.click()
            await page.wait_for_selector('a[href*="/player/"]', timeout=15000)
            await asyncio.sleep(random.uniform(0.5, 1.0))
            page_num += 1
        except Exception as e:
            print(f"  Pagination stopped: {e}")
            break

    print(f"  TOTAL: {len(all_players)} players for {label}")
    if all_players:
        clubs = sum(1 for p in all_players if p.get("club"))
        leagues = sum(1 for p in all_players if p.get("league"))
        faces = sum(1 for p in all_players if p.get("image_url"))
        print(f"  CLUBS: {clubs}/{len(all_players)} | LEAGUES: {leagues}/{len(all_players)} | FACES: {faces}/{len(all_players)}")
    return all_players


# ── File checking ────────────────────────────────────────────────────────────


def min_players(league_id: str | None) -> int:
    # PL-only editions have ~500-700 players; all-league editions ~17,000+.
    return 300 if league_id else 5000


def file_is_complete(filepath: Path, league_id: str | None) -> bool:
    """Complete = enough players, real attributes, club data, AND face URLs.
    Anything missing forces a re-scrape so we never end up half-done again."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list) or len(data) < min_players(league_id):
            return False
        sample = data[:100]
        # Attributes present
        if not any(
            len([k for k in p.keys() if k.startswith("attr_")]) >= 5 for p in sample
        ):
            return False
        # Club data present
        if sum(1 for p in sample if p.get("club")) < 10:
            return False
        # Face URLs present
        if sum(1 for p in sample if p.get("image_url")) < 10:
            return False
        return True
    except Exception:
        return False


# ── Main ─────────────────────────────────────────────────────────────────────


async def main():
    force = "--force" in sys.argv
    pl_only = "--pl-only" in sys.argv
    download_faces = "--download-faces" in sys.argv
    league_id = PL_LEAGUE_ID if pl_only else None

    single_year = None
    for arg in sys.argv[1:]:
        if arg.startswith("--year="):
            single_year = int(arg.split("=")[1])

    years = [single_year] if single_year else ALL_YEARS

    mode = f"PREMIER LEAGUE ONLY (lg={PL_LEAGUE_ID})" if pl_only else "ALL LEAGUES & CLUBS"
    print(f"Mode: {mode}")
    if download_faces:
        print(f"Downloading face images to: {FACES_DIR}")
    print()

    already_done = []
    incomplete = []
    still_needed = []
    for year in years:
        filepath = OUTPUT_DIR / f"fifa_{year}.json"
        if filepath.exists() and filepath.stat().st_size > 1000:
            if force or not file_is_complete(filepath, league_id):
                incomplete.append(year)
            else:
                already_done.append(year)
            continue
        still_needed.append(year)

    if incomplete:
        print(f"Incomplete (missing club/face/attrs or wrong size, will re-scrape): {', '.join(str(y) for y in incomplete)}")
        still_needed = incomplete + still_needed
    if already_done:
        print(f"Complete (players + attrs + club + league + faces): {', '.join(str(y) for y in already_done)}")
    if not still_needed:
        print("All editions complete!")
        return

    print(f"Need to scrape: {', '.join(str(y) for y in still_needed)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    async with async_playwright() as pw:
        context = await pw.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=False,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900},
            locale="en-GB",
            timezone_id="Europe/London",
            args=["--disable-blink-features=AutomationControlled"],
        )

        page = context.pages[0] if context.pages else await context.new_page()
        if stealth_async:
            await stealth_async(page)
            print("Stealth mode active.\n")

        for idx, year in enumerate(still_needed):
            label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"
            print(f"\n{'=' * 50}")
            print(f"Scraping {label} (year {year})... [{idx + 1}/{len(still_needed)}]")
            print(f"{'=' * 50}")

            if idx > 0:
                delay = random.uniform(2, 4)
                print(f"  Pausing {delay:.1f}s...")
                await asyncio.sleep(delay)

            players = await scrape_edition(
                page, context, year, league_id,
                is_first=(idx == 0), download_faces=download_faces,
            )

            if players:
                filepath = OUTPUT_DIR / f"fifa_{year}.json"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(players, f, ensure_ascii=False, indent=2)
                print(f"  SAVED {len(players)} players -> {filepath.name}")
            else:
                print(f"  No players scraped for {label}")
                print(f"  >>> Restart the script -- it skips completed years.")

        await context.close()

    print("\nDONE!")
    print(f"Files: {OUTPUT_DIR}")
    print("Import at: https://knowitball.co.uk/admin/football/scrape")


if __name__ == "__main__":
    asyncio.run(main())
