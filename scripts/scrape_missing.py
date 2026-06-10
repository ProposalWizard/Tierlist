"""
Scrape missing FIFA editions (07-21) from SoFIFA — parallel tabs + fallback.
Run from your Windows desktop:
  pip install playwright beautifulsoup4 playwright-stealth
  python scrape_missing.py

3 parallel tabs share a work queue. Any pages a worker tab fails to load
are retried on the main tab, so data is always complete even if
Cloudflare blocks some workers. Solve the captcha once if shown.
"""

import asyncio
import json, os, random, re, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

# playwright-stealth changed its API in v2.0 — support both versions
stealth_async = None
try:
    # v1.x API
    from playwright_stealth import stealth_async  # type: ignore
except ImportError:
    try:
        # v2.x API
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


# ── HTML parsing ─────────────────────────────────────────────────────────────


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


async def fetch_offset(page, year: int, offset: int, patient: bool = False) -> list[dict] | None:
    """Load one offset page and parse it. Returns None if page failed to load."""
    url = build_url(year, offset)
    try:
        await page.goto(url, wait_until="commit")
    except Exception:
        return None

    await asyncio.sleep(random.uniform(0.3, 0.7))

    tries = 8 if patient else 4
    for _ in range(tries):
        if await count_links(page) >= 1:
            html = await page.content()
            return parse_html(html)
        await asyncio.sleep(1.5)

    return None  # page never loaded players (blocked or empty)


# ── Parallel scraping with shared queue ──────────────────────────────────────


async def queue_worker(
    tab, year: int, queue: list[int], results: dict, failed: list[int], progress: dict, worker_id: int
):
    """Pull offsets from the shared queue. After 3 consecutive failures, give up
    (remaining offsets stay in the queue for other workers / fallback)."""
    consecutive_fails = 0

    while queue:
        offset = queue.pop(0)
        players = await fetch_offset(tab, year, offset)

        if players is None:
            # Page didn't load — probably Cloudflare challenge on this tab
            failed.append(offset)
            consecutive_fails += 1
            if consecutive_fails >= 3:
                print(f"  Tab {worker_id}: blocked (3 fails) — stopping this tab.")
                return
            continue

        consecutive_fails = 0

        if not players:
            # Page loaded but no players — past the end of data
            progress["end_seen"] = True
            return

        results[offset] = players
        progress["done"] += 1
        progress["players"] += len(players)

        if progress["done"] % 15 == 0:
            print(f"  {progress['done']}/{progress['total']} pages | {progress['players']} players")


async def scrape_edition(context, main_page, year: int) -> list[dict]:
    label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"

    # ── Page 1 on the main tab (handles captcha) ──
    await main_page.goto(build_url(year, 0), wait_until="commit")

    if not await wait_for_players(main_page):
        print(f"  Could not load {label}, skipping...")
        return []

    html = await main_page.content()
    first_batch = parse_html(html)
    if not first_batch:
        print("  Page 1: no players parsed.")
        return []

    # Diagnostic
    first = first_batch[0]
    attr_keys = sorted(k for k in first if k.startswith("attr_"))
    print(f"  Page 1: {len(first_batch)} players")
    print(f"  >>> {first.get('name')} | {len(attr_keys)} attrs: {attr_keys[:8]}...")
    if len(attr_keys) < 5:
        print(f"  !!! WARNING: Very few attributes found!")
        print(f"  !!! {json.dumps(first, indent=2)}")

    total_players = detect_total_players(html)
    max_offset = total_players if total_players else 25000
    if total_players:
        print(f"  Detected ~{total_players} total players")

    offsets = list(range(PAGE_SIZE, max_offset, PAGE_SIZE))
    if not offsets:
        return first_batch

    # ── Parallel phase: shared queue, N tabs ──
    queue = list(offsets)
    results: dict[int, list[dict]] = {0: first_batch}
    failed: list[int] = []
    progress = {"done": 1, "total": len(offsets) + 1, "players": len(first_batch), "end_seen": False}

    num_workers = min(NUM_TABS, len(offsets))
    tabs = [main_page]
    for _ in range(num_workers - 1):
        t = await context.new_page()
        if stealth_async:
            await stealth_async(t)
        tabs.append(t)

    print(f"  Scraping with {len(tabs)} parallel tabs...")
    await asyncio.gather(
        *(queue_worker(tabs[i], year, queue, results, failed, progress, i + 1) for i in range(len(tabs)))
    )

    # ── Fallback phase: retry failed + leftover offsets on the main tab ──
    leftovers = sorted(set(failed) | set(queue))
    # Don't retry offsets past the detected end of data
    if results:
        max_done = max(results.keys())
    else:
        max_done = 0

    if leftovers and not progress["end_seen"]:
        print(f"  Retrying {len(leftovers)} failed/remaining pages on main tab...")
        for offset in leftovers:
            players = await fetch_offset(main_page, year, offset, patient=True)
            if players is None:
                # Main tab blocked too — wait for captcha solve and retry once
                print("  Main tab blocked — waiting for captcha...")
                await main_page.goto(build_url(year, offset), wait_until="commit")
                if await wait_for_players(main_page, timeout=120):
                    html = await main_page.content()
                    players = parse_html(html)
                else:
                    print(f"  Skipping offset {offset} (could not load).")
                    continue
            if players:
                results[offset] = players
                progress["players"] += len(players)
    elif leftovers:
        # End of data was seen — only retry offsets below the highest successful one
        retry = [o for o in leftovers if o < max_done]
        if retry:
            print(f"  Retrying {len(retry)} gap pages on main tab...")
            for offset in retry:
                players = await fetch_offset(main_page, year, offset, patient=True)
                if players:
                    results[offset] = players
                    progress["players"] += len(players)

    # Close worker tabs (keep main)
    for t in tabs[1:]:
        try:
            await t.close()
        except Exception:
            pass

    # ── Merge in offset order ──
    all_players = []
    for offset in sorted(results.keys()):
        all_players.extend(results[offset])

    print(f"  TOTAL: {len(all_players)} players for {label}")
    return all_players


# ── File checking ────────────────────────────────────────────────────────────


MIN_PLAYERS = 5000  # every FIFA edition has well over 5000 players


def file_is_complete(filepath: Path) -> bool:
    """A file is complete if it has plenty of players AND detailed attributes."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list) or len(data) < MIN_PLAYERS:
            return False
        first = data[0]
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
                if force or not file_is_complete(filepath):
                    incomplete.append(year)
                else:
                    already_done.append(year)
                continue
        still_needed.append(year)

    if incomplete:
        print(f"Incomplete data (will re-scrape): {', '.join(str(y) for y in incomplete)}")
        still_needed = incomplete + still_needed
    if already_done:
        print(f"Complete (full attributes + {MIN_PLAYERS}+ players): {', '.join(str(y) for y in already_done)}")
    if not still_needed:
        print("All editions complete!")
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
                print(f"  Pausing {delay:.1f}s...")
                await asyncio.sleep(delay)

            players = await scrape_edition(context, main_page, year)

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
