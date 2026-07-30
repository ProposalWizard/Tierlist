#!/usr/bin/env python3
"""Scrape every Premier League club badge from the 2006/07 season through 2025/26.

FIFA editions are named for their release year but cover the season starting the
year before, so FIFA 07 (r-code year 2007) is the 2006/07 season and FC 26
(year 2026) is 2025/26. That means we sweep edition years 2007..2026 inclusive.

Only the Premier League teams list is loaded for each edition (lg[]=13), so this
is far quicker than a full team sweep and can't pick up badges from other
leagues. Club names drift between editions ("Man Utd" vs "Manchester United"),
which is exactly why we sweep every edition rather than just the newest one —
whatever spelling a player row uses, some edition will have supplied a badge
under that spelling.

Output: <sofifa_data>/pl_club_logos.json  — a flat {club: logo_url} map, merged
with anything already in the file so re-runs accumulate.

Upload it at /admin/football/scrape (the "club logos" JSON input).

Usage:
    python scripts/scrape_pl_logos.py                # all editions, 2007..2026
    python scripts/scrape_pl_logos.py --years 2007 2012 2019
    python scripts/scrape_pl_logos.py --headless     # no visible browser

A CAPTCHA may appear on the first page load. The browser profile is persisted,
so solve it once in the visible window and later runs reuse the session.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# Reuse the existing scraper's helpers so URL building, pagination, CAPTCHA
# waiting and CDN path handling all stay in one place.
from scrape_missing import (  # noqa: E402
    OUTPUT_DIR,
    PROFILE_DIR,
    TEAMS_URL,
    click_next,
    code_for_year,
    discover_versions,
    parse_teams,
    stealth_async,
    wait_for,
)
from playwright.async_api import async_playwright  # noqa: E402

PREMIER_LEAGUE_ID = "13"

# Edition years covering 2006/07 .. 2025/26.
PL_YEARS = list(range(2007, 2027))

OUT_FILE = OUTPUT_DIR / "pl_club_logos.json"


def edition_label(year: int) -> str:
    short = str(year % 100).zfill(2)
    return f"FC {short}" if year >= 2024 else f"FIFA {short}"


def season_label(year: int) -> str:
    return f"{year - 1}/{str(year % 100).zfill(2)}"


def pl_teams_url(year: int) -> str:
    """Teams list for one edition, filtered to the Premier League only."""
    vc = code_for_year(year)
    url = f"{TEAMS_URL}?type=club&r={vc}&set=true&lg%5B%5D={PREMIER_LEAGUE_ID}"
    return url


def load_existing() -> dict[str, str]:
    if not OUT_FILE.exists():
        return {}
    try:
        data = json.loads(OUT_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save(logos: dict[str, str]) -> None:
    OUT_FILE.write_text(
        json.dumps(dict(sorted(logos.items())), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def sweep_edition(page, year: int) -> dict[str, str]:
    """Return {club: logo_url} for one edition's Premier League teams list."""
    url = pl_teams_url(year)
    if not code_for_year(year):
        print(f"  ! No roster code for {edition_label(year)} — skipping.")
        return {}

    await page.goto(url, wait_until="commit")
    # PL is 20 clubs, so a single page — don't demand 10+ rows before proceeding.
    if not await wait_for(page, 'a[href*="/team/"]', "PL teams list", min_count=1):
        print(f"  ! Could not load the teams list for {edition_label(year)}.")
        return {}

    found: dict[str, str] = {}
    page_num = 1
    while True:
        rows = parse_teams(await page.content())
        if not rows:
            break
        for r in rows:
            club, logo = r["club"], r["club_logo_url"]
            if club and logo and club not in found:
                found[club] = logo
        if not await click_next(page, 'a[href*="/team/"]'):
            break
        page_num += 1

    missing = [r for r in found.items() if not r[1]]
    print(f"  {edition_label(year)} ({season_label(year)}): {len(found)} clubs"
          + (f", {len(missing)} without a badge" if missing else ""))
    return found


async def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape Premier League club badges, 2006/07 to 2025/26.")
    ap.add_argument("--years", nargs="*", type=int, help="Specific edition years (default: 2007..2026)")
    ap.add_argument("--headless", action="store_true", help="Run without a visible browser window")
    args = ap.parse_args()

    years = args.years or PL_YEARS
    years = [y for y in years if 2007 <= y <= 2026]
    if not years:
        print("No valid edition years given (expected 2007..2026).")
        return

    logos = load_existing()
    print(f"Starting with {len(logos)} club badges already in {OUT_FILE.name}.")
    print(f"Sweeping {len(years)} editions: {years[0]}..{years[-1]}\n")

    async with async_playwright() as pw:
        context = await pw.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=args.headless,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1440, "height": 900},
            locale="en-GB",
            timezone_id="Europe/London",
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else await context.new_page()
        if stealth_async:
            await stealth_async(page)
            print("Stealth mode active.\n")

        # Read the real roster codes from SoFIFA's edition dropdown — the
        # hardcoded table in scrape_missing has been wrong for some editions.
        try:
            await discover_versions(page)
        except Exception as e:
            print(f"Version discovery failed ({e}); falling back to the hardcoded codes.\n")

        for idx, year in enumerate(years):
            print(f"[{idx + 1}/{len(years)}] {edition_label(year)}")
            if idx > 0:
                await asyncio.sleep(random.uniform(2, 4))
            try:
                found = await sweep_edition(page, year)
            except Exception as e:
                print(f"  ! {edition_label(year)} failed: {e}")
                continue

            # Newer editions win on conflict — their CDN paths are the ones
            # least likely to have been retired.
            new_names = [c for c in found if c not in logos]
            logos.update(found)
            if new_names:
                print(f"  + {len(new_names)} new: {', '.join(sorted(new_names)[:6])}"
                      + (" …" if len(new_names) > 6 else ""))
            save(logos)   # save as we go so a crash doesn't lose progress

        await context.close()

    save(logos)
    print(f"\nDONE — {len(logos)} Premier League club badges.")
    print(f"File: {OUT_FILE}")
    print("Upload it at https://knowitball.co.uk/admin/football/scrape (club logos input).")


if __name__ == "__main__":
    asyncio.run(main())
