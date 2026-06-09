"""
Scrape ONLY the missing FIFA editions (07-21) from SoFIFA.
Run from your Windows desktop:
  python scrape_missing.py

The browser will open — solve the Cloudflare captcha when prompted.
The script waits up to 120 seconds for you to solve it (double the previous timeout).
"""

import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

OUTPUT_DIR = Path.home() / "Desktop" / "sofifa_data"
OUTPUT_DIR.mkdir(exist_ok=True)

# Only the years that got skipped
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


def wait_for_page_ready(page, timeout_ms=120000):
    """Wait for player links to appear, giving user time to solve captcha."""
    try:
        page.wait_for_selector('a[href*="/player/"]', timeout=timeout_ms)
        return True
    except PlaywrightTimeout:
        return False


def scrape_edition(page, year: int) -> list[dict]:
    """Scrape all pages for a single FIFA edition using Next button navigation."""
    vc = VERSION_CODES.get(year)
    if not vc:
        print(f"  No version code for {year}, skipping...")
        return []

    url = build_url(year)
    print(f"  Loading first page (solve captcha if shown)...")
    page.goto(url, wait_until="commit")

    if not wait_for_page_ready(page, timeout_ms=120000):
        print(f"  Could not load {'FC' if year >= 2024 else 'FIFA'} {str(year % 100).zfill(2)}, skipping...")
        return []

    all_players = []
    page_num = 1

    while True:
        html = page.content()

        # Parse player rows from table
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        table = soup.select_one("table.table")
        if not table:
            break

        rows = table.select("tbody tr")
        if not rows:
            break

        for row in rows:
            player: dict = {}

            # Player link and ID
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

            # Image
            img = row.select_one("img[data-src]")
            if img:
                player["image_url"] = img["data-src"]

            # Get all td cells
            tds = row.select("td")
            for td in tds:
                col_class = td.get("class", [])
                for cls in col_class:
                    if cls.startswith("col-"):
                        col_name = cls[4:]  # strip "col-"

                        if col_name == "ae":
                            player["age"] = td.get_text(strip=True)
                        elif col_name == "oa":
                            player["overall"] = td.get_text(strip=True)
                        elif col_name == "pt":
                            player["potential"] = td.get_text(strip=True)
                        elif col_name == "pi":
                            # Player info cell — extract positions, nationality, club
                            pos_spans = td.select("span.pos")
                            if pos_spans:
                                player["positions"] = ",".join(
                                    s.get_text(strip=True) for s in pos_spans
                                )

                            # Nationality from flag image
                            flag = td.select_one("img.flag")
                            if flag:
                                player["nationality"] = flag.get("title", "")

                            # Club
                            club_links = td.select('a[href*="/team/"]')
                            if club_links:
                                player["club"] = club_links[0].get_text(strip=True)

                            # League
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
                all_players.append(player)

        if page_num % 5 == 0:
            print(f"  Page {page_num}, {len(all_players)} players...")

        # Try clicking Next button instead of navigating to new URL
        try:
            next_btn = page.query_selector('a.bp3-button[rel="next"]')
            if not next_btn:
                next_btn = page.query_selector('a[rel="next"]')
            if not next_btn:
                # Try pagination links
                pag_links = page.query_selector_all(".pagination a")
                next_btn = None
                for link in pag_links:
                    text = link.inner_text().strip()
                    if text == "Next" or text == "›" or text == "»":
                        next_btn = link
                        break

            if not next_btn:
                break

            next_btn.click()
            # Wait for the table to update
            page.wait_for_selector('a[href*="/player/"]', timeout=15000)
            time.sleep(0.5)
            page_num += 1
        except Exception:
            break

    return all_players


def main():
    # Check which years are already scraped
    already_done = []
    still_needed = []
    for year in MISSING_YEARS:
        filepath = OUTPUT_DIR / f"fifa_{year}.json"
        if filepath.exists():
            size = filepath.stat().st_size
            if size > 1000:  # more than 1KB means it has real data
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
            print(f"\nScraping {label} (year {year})...")

            players = scrape_edition(page, year)

            if players:
                filepath = OUTPUT_DIR / f"fifa_{year}.json"
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(players, f, ensure_ascii=False, indent=2)
                print(f"  Saved {len(players)} players to {filepath.name}")
            else:
                print(f"  No players scraped for {label}")
                print(f"  >>> If captcha appeared, solve it and the script will retry on the next edition.")
                print(f"  >>> Or restart the script — it skips already-completed years.")

        browser.close()

    print("\nDONE!")
    print(f"Check {OUTPUT_DIR} for JSON files")
    print("Import each file at: https://knowitball.co.uk/admin/football/scrape")


if __name__ == "__main__":
    main()
