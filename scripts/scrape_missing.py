"""
Scrape missing FIFA editions (07-21) from SoFIFA — parallel tabs.
Run from your Windows desktop:
  pip install playwright playwright-stealth beautifulsoup4
  python scrape_missing.py

Uses 3 parallel browser tabs + stealth + persistent cookies.
Solve the Cloudflare captcha ONCE (if shown) — all tabs share the cookie.
"""

import asyncio
import json, os, random, re, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

try:
    from playwright_stealth import stealth_async
except ImportError:
    stealth_async = None
    print("WARNING: playwright-stealth not installed. CAPTCHAs will be more frequent.")
    print("  Install it:  pip install playwright-stealth\n")

OUTPUT_DIR = Path.home() / "Desktop" / "sofifa_data"
OUTPUT_DIR.mkdir(exist_ok=True)

PROFILE_DIR = OUTPUT_DIR / ".browser_profile"
PROFILE_DIR.mkdir(exist_ok=True)

MISSING_YEARS = list(range(2021, 2006, -1))  # 2021 down to 2007

NUM_TABS = 3     # parallel tabs per edition
PAGE_SIZE = 60   # SoFIFA players per page

VERSION_CODES = {
    2026: "240034", 2025: "240007", 2024: "230054", 2023: "230017",
    2022: "220069", 2021: "210064", 2020: "200061", 2019: "190075",
    2018: "180084", 2017: "170099", 2016: "160058", 2015: "150001",
    2014: "140052", 2013: "130034", 2012: "120002", 2011: "110003",
    2010: "100001", 2009: "090001", 2008: "080001", 2007: "070001",
}

COLUMNS = [
    "pi", "ae", "oa", "pt", "pac", "sho", "pas", "dri", "def", "phy",
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


def build_url(year: int, offset: int = 0) -> str:
    vc = VERSION_CODES.get(year, "")
    col_str = ",".join(COLUMNS)
    show_col = "".join(f"&showCol%5B%5D={c}" for c in COLUMNS)
    url = f"{BASE_URL}?type=all&r={vc}&set=true&col={col_str}{show_col}"
    if offset > 0:
        url += f"&offset={offset}"
    return url


# ── HTML parsing (sync — BeautifulSoup, no async needed) ─────────────────────


def _get_col_id(th) -> str:
    for cls in th.get("class", []):
        if cls.startswith("col-"):
            return cls[4:]
    return th.get("data-col", "")


def _build_header_map(table) -> list[str]:
    header_row = table.select_one("thead tr")
    if not header_row:
        return []
    return [_get_col_id(th) for th in header_row.select("th")]


def _extract_pi_cell(td, player: dict):
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

    club_links = td.select('a[href*="/team/"]')
    if club_links:
        player["club"] = club_links[0].get_text(strip=True)

    league_links = td.select('a[href*="/league/"]')
    if not league_links:
        league_links = td.select('a[href*="/players?lg="]')
    if league_links:
        player["league"] = league_links[0].get_text(strip=True)


def _extract_td_value(col_id: str, td, player: dict):
    if col_id == "ae":
        player["age"] = td.get_text(strip=True)
    elif col_id == "oa":
        player["overall"] = td.get_text(strip=True)
    elif col_id == "pt":
        player["potential"] = td.get_text(strip=True)
    elif col_id == "pi":
        _extract_pi_cell(td, player)
    elif col_id:
        val = td.get_text(strip=True)
        if val:
            player[f"attr_{col_id}"] = val


def parse_html(html: str) -> list[dict]:
    """Parse player rows from an HTML string. Returns list of player dicts."""
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
    if not rows:
        return []

    players = []
    for row in rows:
        player: dict = {}

        name_link = row.select_one('a[href*="/player/"]')
        if not name_link:
            continue

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

        if player.get("sofifa_id") and player.get("name"):
            players.append(player)

    return players


def detect_total_players(html: str) -> int | None:
    """Try to extract total player count from pagination text (e.g. '1 - 60 of 18,827')."""
    m = re.search(r"of\s+([\d,]+)", html)
    if m:
        return int(m.group(1).replace(",", ""))
    return None


# ── Async browser helpers ────────────────────────────────────────────────────


async def count_links(page) -> int:
    try:
        return len(await page.query_selector_all('a[href*="/player/"]'))
    except Exception:
        return 0


async def wait_for_players(page, timeout: int = 180) -> bool:
    """Wait for real player content. Handles Cloudflare captcha (user solves it)."""
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
            print("  Page changed after settling, waiting...")
            last_count = -1

        await asyncio.sleep(2)

    return False


async def navigate_and_parse(page, url: str) -> list[dict]:
    """Navigate to URL, wait for content, parse. Returns [] on failure."""
    try:
        await page.goto(url, wait_until="commit")
    except Exception:
        return []

    await asyncio.sleep(random.uniform(0.3, 0.8))

    # Quick check: any player links?
    for _ in range(3):
        if await count_links(page) >= 1:
            break
        await asyncio.sleep(1.5)
    else:
        return []

    html = await page.content()
    return parse_html(html)


# ── Workers ──────────────────────────────────────────────────────────────────


async def worker(tab, offsets: list[int], year: int, progress: dict) -> list[dict]:
    """Scrape a sequential chunk of offsets. Stops on first empty page."""
    results = []
    for offset in offsets:
        url = build_url(year, offset)
        players = await navigate_and_parse(tab, url)
        if not players:
            break
        results.extend(players)
        progress["done"] += 1
        if progress["done"] % 10 == 0:
            total = progress["total"]
            print(f"  Progress: {progress['done']}/{total} pages | {progress['players'] + len(results)} players")
    progress["players"] += len(results)
    return results


async def scrape_edition(context, year: int) -> list[dict]:
    """Scrape one FIFA edition using parallel tabs."""
    label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"

    main_page = context.pages[0] if context.pages else await context.new_page()

    url = build_url(year, 0)
    await main_page.goto(url, wait_until="commit")

    if not await wait_for_players(main_page):
        print(f"  Could not load {label}, skipping...")
        return []

    html = await main_page.content()
    first_batch = parse_html(html)
    if not first_batch:
        print("  Page 1: no players parsed.")
        return []

    # Diagnostic: verify attributes are captured
    first = first_batch[0]
    attr_keys = sorted(k for k in first if k.startswith("attr_"))
    print(f"  Page 1: {len(first_batch)} players")
    print(f"  >>> {first.get('name')} | {len(attr_keys)} attrs: {attr_keys[:8]}...")
    if len(attr_keys) < 5:
        print(f"  !!! WARNING: Very few attributes — HTML may not match parser.")
        print(f"  !!! Data: {json.dumps(first, indent=2)}")

    # Determine how many pages to scrape
    total_players = detect_total_players(html)
    if total_players:
        max_offset = total_players
        est_pages = total_players // PAGE_SIZE + 1
        print(f"  Detected {total_players} total players (~{est_pages} pages)")
    else:
        max_offset = 25000
        print(f"  Could not detect total — will paginate up to offset {max_offset}")

    offsets = list(range(PAGE_SIZE, max_offset, PAGE_SIZE))
    if not offsets:
        return first_batch

    # Create worker tabs
    num_workers = min(NUM_TABS, len(offsets))
    tabs = []
    for _ in range(num_workers):
        p = await context.new_page()
        if stealth_async:
            await stealth_async(p)
        tabs.append(p)

    # Split offsets into sequential chunks (preserves order, workers stop at end of data)
    chunk_size = (len(offsets) + num_workers - 1) // num_workers
    chunks = [offsets[i * chunk_size:(i + 1) * chunk_size] for i in range(num_workers)]

    progress = {"done": 1, "total": len(offsets) + 1, "players": len(first_batch)}

    print(f"  Scraping with {num_workers} parallel tabs...")
    tasks = [worker(tabs[i], chunks[i], year, progress) for i in range(num_workers) if chunks[i]]
    results = await asyncio.gather(*tasks)

    # Merge in order (chunks are sequential, so this preserves overall order)
    all_players = list(first_batch)
    for r in results:
        all_players.extend(r)

    # Cleanup worker tabs
    for tab in tabs:
        try:
            await tab.close()
        except Exception:
            pass

    print(f"  TOTAL: {len(all_players)} players for {label}")
    return all_players


# ── File checking ────────────────────────────────────────────────────────────


def file_has_attributes(filepath: Path) -> bool:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not data:
            return False
        first = data[0] if isinstance(data, list) else data
        attr_keys = [k for k in first.keys() if k.startswith("attr_")]
        return len(attr_keys) >= 5
    except Exception:
        return False


# ── Main ─────────────────────────────────────────────────────────────────────


async def main():
    force = "--force" in sys.argv

    already_done = []
    incomplete = []
    still_needed = []
    for year in MISSING_YEARS:
        filepath = OUTPUT_DIR / f"fifa_{year}.json"
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 1000:
                if force or not file_has_attributes(filepath):
                    incomplete.append(year)
                else:
                    already_done.append(year)
                continue
        still_needed.append(year)

    if incomplete:
        print(f"Incomplete data (will re-scrape): {', '.join(str(y) for y in incomplete)}")
        still_needed = incomplete + still_needed
    if already_done:
        print(f"Already scraped with full attributes: {', '.join(str(y) for y in already_done)}")
    if not still_needed:
        print("All editions already scraped with full attributes!")
        return

    print(f"Need to scrape: {', '.join(str(y) for y in still_needed)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Parallel tabs: {NUM_TABS}")
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

        main_page = context.pages[0] if context.pages else await context.new_page()
        if stealth_async:
            await stealth_async(main_page)
            print("Stealth mode active.\n")

        for idx, year in enumerate(still_needed):
            label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"
            print(f"\n{'=' * 50}")
            print(f"Scraping {label} (year {year})... [{idx + 1}/{len(still_needed)}]")
            print(f"{'=' * 50}")

            if idx > 0:
                delay = random.uniform(2, 4)
                print(f"  Pausing {delay:.1f}s between editions...")
                await asyncio.sleep(delay)

            players = await scrape_edition(context, year)

            if players:
                filepath = OUTPUT_DIR / f"fifa_{year}.json"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(players, f, ensure_ascii=False, indent=2)
                print(f"  SAVED {len(players)} players → {filepath.name}")
            else:
                print(f"  No players scraped for {label}")
                print(f"  >>> Restart the script — it skips completed years.")

        await context.close()

    print("\nDONE!")
    print(f"Files: {OUTPUT_DIR}")
    print("Import at: https://knowitball.co.uk/admin/football/scrape")


if __name__ == "__main__":
    asyncio.run(main())
