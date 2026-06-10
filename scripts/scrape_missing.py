"""
Scrape FIFA editions from SoFIFA (07-26).
Run from your Windows desktop:
  pip install playwright beautifulsoup4 playwright-stealth
  python scrape_missing.py

Single tab, Next button navigation. Stealth + persistent cookies
reduce captchas. Solve Cloudflare once if shown — cookie persists.

Flags:
  --force     Re-scrape all editions, even complete ones
  --year=YYYY Scrape only that edition
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
OUTPUT_DIR.mkdir(exist_ok=True)

PROFILE_DIR = OUTPUT_DIR / ".browser_profile"
PROFILE_DIR.mkdir(exist_ok=True)

ALL_YEARS = list(range(2026, 2006, -1))

VERSION_CODES = {
    2026: "240034", 2025: "240007", 2024: "230054", 2023: "230017",
    2022: "220069", 2021: "210064", 2020: "200061", 2019: "190075",
    2018: "180084", 2017: "170099", 2016: "160058", 2015: "150001",
    2014: "140052", 2013: "130034", 2012: "120002", 2011: "110003",
    2010: "100001", 2009: "090001", 2008: "080001", 2007: "070001",
}

# Column IDs for the showCol[] URL parameter.
# "tm" = Team/Club, "lg" = League — these were missing before, causing
# club and league to be None for all scraped players.
COLUMNS = [
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

BASE_URL = "https://sofifa.com/players"


def build_url(year: int, col_ids: list[str] | None = None) -> str:
    cols = col_ids or COLUMNS
    vc = VERSION_CODES.get(year, "")
    col_str = ",".join(cols)
    show_col = "".join(f"&showCol%5B%5D={c}" for c in cols)
    return f"{BASE_URL}?type=all&r={vc}&set=true&col={col_str}{show_col}"


# ── Column discovery ─────────────────────────────────────────────────────────


async def discover_columns(page) -> dict[str, str]:
    """Read showCol dropdown from the page. Returns {col_id: display_name}."""
    options = await page.query_selector_all('select[name="showCol[]"] option')
    cols = {}
    for opt in options:
        value = await opt.get_attribute("value")
        text = (await opt.inner_text()).strip()
        if value and text:
            cols[value] = text
    return cols


# Column IDs that map to the "club" field
CLUB_COL_IDS = {"tm", "team", "club"}
# Column IDs that map to the "league" field
LEAGUE_COL_IDS = {"lg", "league"}


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
    """Extract positions, nationality from player info cell.
    Also tries to find club/league links as a fallback."""
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

    # Try multiple selectors for club (fallback — main extraction is from tm column)
    if not player.get("club"):
        club_link = (
            td.select_one('a[href*="/team/"]') or
            td.select_one('a[href*="/club/"]') or
            td.select_one('a[href*="&tm="]')
        )
        if club_link:
            player["club"] = club_link.get_text(strip=True)

    # Try multiple selectors for league (fallback)
    if not player.get("league"):
        league_link = (
            td.select_one('a[href*="/league/"]') or
            td.select_one('a[href*="/players?lg="]') or
            td.select_one('a[href*="&lg="]')
        )
        if league_link:
            player["league"] = league_link.get_text(strip=True)


def _cell_text(td) -> str:
    """Get text from a cell, preferring link text if present."""
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

        # Diagnostic dump of first row
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
            player["image_url"] = img.get("data-src") or img.get("src", "")

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

        # Fallback: scan ALL cells for team/league links if still missing
        if not player.get("club"):
            for td in tds:
                for a in td.select("a"):
                    href_val = a.get("href", "")
                    if "/team/" in href_val or "/club/" in href_val:
                        player["club"] = a.get_text(strip=True)
                        break
                if player.get("club"):
                    break

        if not player.get("league"):
            for td in tds:
                for a in td.select("a"):
                    href_val = a.get("href", "")
                    if "/league/" in href_val or "lg=" in href_val:
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


# ── Scraping ─────────────────────────────────────────────────────────────────


async def scrape_edition(page, year: int, is_first: bool = False) -> list[dict]:
    label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"

    url = build_url(year)
    await page.goto(url, wait_until="commit")

    if not await wait_for_players(page):
        print(f"  Could not load {label}, skipping...")
        return []

    # Discover available columns on first edition
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
                elif cid not in COLUMNS:
                    marker = " (not in our COLUMNS list)"
                print(f"    {cid:6s} = {cname}{marker}")

            # Check for club/league columns with unexpected IDs
            found_club = any(cid in CLUB_COL_IDS for cid in disc)
            found_league = any(cid in LEAGUE_COL_IDS for cid in disc)
            if not found_club:
                print("\n  ⚠ No known club column ID found in dropdown!")
                print("    Look for a column that means 'Team' or 'Club' above.")
            if not found_league:
                print("\n  ⚠ No known league column ID found in dropdown!")
                print("    Look for a column that means 'League' above.")
        else:
            print("  Could not discover columns from dropdown.")

    all_players = []
    page_num = 1

    while True:
        html = await page.content()
        players = parse_html(html, dump_first=(page_num == 1))

        if not players:
            print(f"  Page {page_num}: no players parsed, stopping.")
            break

        all_players.extend(players)

        if page_num == 1:
            first = players[0]
            attr_keys = sorted(k for k in first if k.startswith("attr_"))
            clubs_found = sum(1 for p in players if p.get("club"))
            leagues_found = sum(1 for p in players if p.get("league"))
            print(f"  Page 1: {len(players)} players")
            print(f"  >>> {first.get('name')} | club={first.get('club')!r} | league={first.get('league')!r}")
            print(f"  >>> {len(attr_keys)} attrs: {attr_keys[:8]}...")
            print(f"  >>> Club data: {clubs_found}/{len(players)} | League data: {leagues_found}/{len(players)}")
            if clubs_found == 0:
                print(f"  ⚠ WARNING: No club data found on page 1!")
                print(f"    Check the DIAGNOSTIC output above to find the right column.")
                print(f"    The club column may use a different ID than 'tm'.")
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
        print(f"  CLUBS: {clubs}/{len(all_players)} | LEAGUES: {leagues}/{len(all_players)}")
    return all_players


# ── File checking ────────────────────────────────────────────────────────────


MIN_PLAYERS = 5000


def file_is_complete(filepath: Path) -> bool:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list) or len(data) < MIN_PLAYERS:
            return False
        first = data[0]
        attr_keys = [k for k in first.keys() if k.startswith("attr_")]
        if len(attr_keys) < 5:
            return False
        # Verify club data exists (check first 100 players)
        clubs_present = sum(1 for p in data[:100] if p.get("club"))
        if clubs_present < 10:
            return False
        return True
    except Exception:
        return False


# ── Main ─────────────────────────────────────────────────────────────────────


async def main():
    force = "--force" in sys.argv

    # Allow --year=YYYY to scrape a single edition
    single_year = None
    for arg in sys.argv[1:]:
        if arg.startswith("--year="):
            single_year = int(arg.split("=")[1])

    years = [single_year] if single_year else ALL_YEARS

    already_done = []
    incomplete = []
    still_needed = []
    for year in years:
        filepath = OUTPUT_DIR / f"fifa_{year}.json"
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 1000:
                if force or not file_is_complete(filepath):
                    incomplete.append(year)
                else:
                    already_done.append(year)
                continue
        still_needed.append(year)

    if incomplete:
        print(f"Incomplete (missing attrs or club data, will re-scrape): {', '.join(str(y) for y in incomplete)}")
        still_needed = incomplete + still_needed
    if already_done:
        print(f"Complete ({MIN_PLAYERS}+ players, attrs, club data): {', '.join(str(y) for y in already_done)}")
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

            players = await scrape_edition(page, year, is_first=(idx == 0))

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
