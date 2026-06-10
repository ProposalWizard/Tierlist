"""
Scrape ONLY the missing FIFA editions (07-21) from SoFIFA.
Run from your Windows desktop:
  python scrape_missing.py

The browser will open — solve the Cloudflare captcha when prompted.
The script waits up to 3 minutes for you to solve it.
"""

import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

OUTPUT_DIR = Path.home() / "Desktop" / "sofifa_data"
OUTPUT_DIR.mkdir(exist_ok=True)

MISSING_YEARS = list(range(2021, 2006, -1))  # 2021 down to 2007

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
    url = f"{BASE_URL}?type=all&r={vc}&set=true&col={col_str}&showCol%5B%5D=pi&showCol%5B%5D=ae&showCol%5B%5D=oa&showCol%5B%5D=pt"
    if offset > 0:
        url += f"&offset={offset}"
    return url


def count_player_links(page) -> int:
    try:
        return len(page.query_selector_all('a[href*="/player/"]'))
    except Exception:
        return 0


def wait_for_players(page, timeout_ms=180000):
    """Wait until the page shows a real roster (10+ player links).
    Gives up to 3 minutes for the user to solve the captcha."""
    print("  Waiting for players page (solve captcha if shown)...")
    deadline = time.time() + (timeout_ms / 1000)
    last_count = -1

    while time.time() < deadline:
        count = count_player_links(page)
        if count != last_count:
            print(f"  ...seeing {count} player links on page")
            last_count = count

        if count >= 10:
            # Real roster found — let the page settle, then confirm it's still there
            time.sleep(3)
            count2 = count_player_links(page)
            if count2 >= 10:
                print(f"  Players page ready ({count2} player links).")
                return True
            print("  Page changed after settling (probably captcha), waiting...")
            last_count = -1

        time.sleep(2)

    return False


def parse_page(page) -> list[dict]:
    """Parse player data from the current page."""
    from bs4 import BeautifulSoup

    html = page.content()
    soup = BeautifulSoup(html, "html.parser")

    # Find the table containing player rows — don't rely on a specific class
    table = soup.select_one("table.table")
    if not table:
        for t in soup.select("table"):
            if t.select_one('a[href*="/player/"]'):
                table = t
                break
    if not table:
        return []

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
        if img:
            player["image_url"] = img["data-src"]

        tds = row.select("td")
        for td in tds:
            col_class = td.get("class", [])
            for cls in col_class:
                if cls.startswith("col-"):
                    col_name = cls[4:]

                    if col_name == "ae":
                        player["age"] = td.get_text(strip=True)
                    elif col_name == "oa":
                        player["overall"] = td.get_text(strip=True)
                    elif col_name == "pt":
                        player["potential"] = td.get_text(strip=True)
                    elif col_name == "pi":
                        pos_spans = td.select("span.pos")
                        if pos_spans:
                            player["positions"] = ",".join(
                                s.get_text(strip=True) for s in pos_spans
                            )
                        flag = td.select_one("img.flag")
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
                    else:
                        val = td.get_text(strip=True)
                        if val:
                            player[f"attr_{col_name}"] = val

        if player.get("sofifa_id") and player.get("name"):
            players.append(player)

    return players


def scrape_edition(page, year: int) -> list[dict]:
    """Scrape all pages for a single FIFA edition using Next button navigation."""
    vc = VERSION_CODES.get(year)
    if not vc:
        print(f"  No version code for {year}, skipping...")
        return []

    url = build_url(year)
    page.goto(url, wait_until="commit")

    if not wait_for_players(page, timeout_ms=180000):
        print(f"  Could not load {'FC' if year >= 2024 else 'FIFA'} {str(year % 100).zfill(2)}, skipping...")
        return []

    all_players = []
    page_num = 1

    while True:
        players_on_page = parse_page(page)

        if not players_on_page:
            print(f"  Page {page_num}: no players parsed, stopping.")
            break

        all_players.extend(players_on_page)

        if page_num % 5 == 0 or page_num == 1:
            print(f"  Page {page_num}: {len(players_on_page)} players (total: {len(all_players)})")

        # Try clicking Next button
        try:
            next_btn = page.query_selector('a.bp3-button[rel="next"]')
            if not next_btn:
                next_btn = page.query_selector('a[rel="next"]')
            if not next_btn:
                pag_links = page.query_selector_all(".pagination a")
                next_btn = None
                for link in pag_links:
                    text = link.inner_text().strip()
                    if text == "Next" or text == "›" or text == "»":
                        next_btn = link
                        break

            if not next_btn:
                print(f"  No more pages. Total: {len(all_players)} players.")
                break

            next_btn.click()
            page.wait_for_selector('a[href*="/player/"]', timeout=15000)
            time.sleep(1)
            page_num += 1
        except Exception as e:
            print(f"  Pagination stopped: {e}")
            break

    return all_players


def main():
    already_done = []
    still_needed = []
    for year in MISSING_YEARS:
        filepath = OUTPUT_DIR / f"fifa_{year}.json"
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 1000:
                already_done.append(year)
                continue
        still_needed.append(year)

    if already_done:
        print(f"Already scraped: {', '.join(str(y) for y in already_done)}")
    if not still_needed:
        print("All editions already scraped!")
        return

    print(f"Need to scrape: {', '.join(str(y) for y in still_needed)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        for year in still_needed:
            label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"
            print(f"\n{'='*50}")
            print(f"Scraping {label} (year {year})...")
            print(f"{'='*50}")

            players = scrape_edition(page, year)

            if players:
                filepath = OUTPUT_DIR / f"fifa_{year}.json"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(players, f, ensure_ascii=False, indent=2)
                print(f"  SAVED {len(players)} players to {filepath.name}")
            else:
                print(f"  No players scraped for {label}")
                print(f"  >>> Restart the script — it skips already-completed years.")

        browser.close()

    print("\nDONE!")
    print(f"Check {OUTPUT_DIR} for JSON files")
    print("Import each file at: https://knowitball.co.uk/admin/football/scrape")


if __name__ == "__main__":
    main()
