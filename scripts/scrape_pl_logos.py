#!/usr/bin/env python3
"""Scrape club badges from SoFIFA into a {club: logo_url} map.

WHY IT LOOKS LIKE THIS
----------------------
Cloudflare challenges every browser NAVIGATION, which made a page-per-edition
sweep unbearable — a CAPTCHA per edition. But the clearance cookie it issues
belongs to the whole browser context, and Playwright's context.request shares
that cookie jar. So we navigate exactly ONCE (which also reads the real roster
codes from the edition dropdown), then pull every teams page over plain HTTP
through the same context. One challenge per run, not twenty.

Pagination uses &offset= rather than clicking "Next". scrape_missing already
documents that the Next button drops the lg[] filter, and with no navigation
there is nothing to click anyway.

By default this sweeps EVERY club SoFIFA lists, not just the Premier League.
Badges for clubs you never use are harmless — club_logos is a lookup table, and
the app only ever reads the rows it needs. Sweeping everything means no league
IDs have to be guessed (SoFIFA's ID 16 is Ligue 1, not League Two, so guessing
is genuinely risky) and it captures the alternate spellings older editions used,
which is what the name matching needs.

Output: <sofifa_data>/pl_club_logos.json — merged with whatever is already
there, so re-runs accumulate and nothing is lost.

Upload it at /admin/football/scrape (the club logos input).

Usage:
    python scrape_pl_logos.py                     # all clubs, editions 2007..2026
    python scrape_pl_logos.py --pl-only           # Premier League only
    python scrape_pl_logos.py --years 2012 2019   # specific editions
    python scrape_pl_logos.py --headless          # no visible window (only works
                                                  # if clearance is already cached)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import scrape_missing  # noqa: E402
from scrape_missing import (  # noqa: E402
    BASE_URL,
    OUTPUT_DIR,
    PROFILE_DIR,
    TEAMS_URL,
    code_for_year,
    discover_versions,
    parse_teams,
    stealth_async,
    wait_for,
)
from playwright.async_api import async_playwright  # noqa: E402

# SoFIFA's Premier League id. Only used with --pl-only. Other English tiers are
# deliberately NOT hardcoded: the id space is not sequential by country (16 is
# Ligue 1), so a guessed id would silently scrape the wrong league.
PREMIER_LEAGUE_ID = "13"

# Edition years covering 2006/07 .. 2025/26.
PL_YEARS = list(range(2007, 2027))

OUT_FILE = OUTPUT_DIR / "pl_club_logos.json"

# Markers that mean we got a Cloudflare interstitial instead of the real page.
CF_MARKERS = ("just a moment", "challenge-platform", "cf-browser-verification",
              "checking your browser", "cf_chl")


def edition_label(year: int) -> str:
    short = str(year % 100).zfill(2)
    return f"FC {short}" if year >= 2024 else f"FIFA {short}"


def season_label(year: int) -> str:
    return f"{year - 1}/{str(year % 100).zfill(2)}"


def teams_page_url(year: int, offset: int = 0, pl_only: bool = False) -> str:
    vc = code_for_year(year)
    url = f"{TEAMS_URL}?type=club&r={vc}&set=true"
    if pl_only:
        url += f"&lg%5B%5D={PREMIER_LEAGUE_ID}"
    if offset:
        url += f"&offset={offset}"
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


def looks_like_challenge(html: str) -> bool:
    head = html[:4000].lower()
    return any(m in head for m in CF_MARKERS)


async def clear_challenge(page, url: str) -> bool:
    """Navigate in the real browser so the user can solve a challenge, which
    refreshes the clearance cookie for all later HTTP fetches."""
    print("\n" + "=" * 60)
    print("  *** CLOUDFLARE CHALLENGE — SOLVE IN THE BROWSER WINDOW ***")
    print("  (only needed once; HTTP fetches reuse the cookie afterwards)")
    print("=" * 60 + "\n")
    try:
        scrape_missing._beep()
    except Exception:
        pass
    await page.goto(url, wait_until="commit")
    return await wait_for(page, 'a[href*="/team/"]', "teams page", min_count=1)


async def fetch_html(context, page, url: str) -> str | None:
    """GET a page through the browser context's cookie jar. Falls back to a real
    navigation (so a human can solve a challenge) if Cloudflare intercepts."""
    try:
        resp = await context.request.get(url, headers={
            "Accept": "text/html,application/xhtml+xml",
            "Referer": "https://sofifa.com/",
        })
        if resp.ok:
            html = await resp.text()
            if not looks_like_challenge(html):
                return html
    except Exception as e:
        print(f"    fetch failed ({e}); falling back to the browser.")

    if not await clear_challenge(page, url):
        return None
    return await page.content()


async def sweep_edition(context, page, year: int, pl_only: bool, diagnose: bool) -> dict[str, str]:
    """Return {club: logo_url} for one edition, paging with &offset=."""
    if not code_for_year(year):
        print(f"  ! No roster code for {edition_label(year)} — skipping.")
        return {}

    found: dict[str, str] = {}
    offset = 0
    page_num = 1

    while True:
        url = teams_page_url(year, offset=offset, pl_only=pl_only)
        html = await fetch_html(context, page, url)
        if html is None:
            print(f"  ! Could not load {edition_label(year)} at offset {offset}.")
            break

        rows = parse_teams(html)
        if diagnose:
            print(f"    [diag] page {page_num} offset={offset}: {len(rows)} rows")
            if rows:
                print(f"    [diag] {', '.join(r['club'] for r in rows[:8])}"
                      + (" …" if len(rows) > 8 else ""))
        if not rows:
            break

        new_this_page = 0
        for r in rows:
            club, logo = r["club"], r["club_logo_url"]
            if club and logo and club not in found:
                found[club] = logo
                new_this_page += 1

        # A page that adds nothing new means SoFIFA is repeating the last page
        # rather than returning empty past the end — stop instead of looping.
        if new_this_page == 0:
            break

        offset += len(rows)
        page_num += 1
        await asyncio.sleep(random.uniform(0.4, 0.9))

    label = f"{edition_label(year)} ({season_label(year)})"
    print(f"  {label}: {len(found)} clubs")
    if pl_only and 0 < len(found) < 20:
        print(f"  ! Expected 20 Premier League clubs, got {len(found)} — "
              f"re-run this edition with --years {year}")
    return found


async def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape SoFIFA club badges.")
    ap.add_argument("--years", nargs="*", type=int, help="Edition years (default 2007..2026)")
    ap.add_argument("--pl-only", action="store_true",
                    help="Only sweep the Premier League instead of every club")
    ap.add_argument("--headless", action="store_true",
                    help="No visible window — only works if clearance is already cached")
    ap.add_argument("--diagnose", action="store_true", help="Print per-page detail")
    args = ap.parse_args()

    years = [y for y in (args.years or PL_YEARS) if 2007 <= y <= 2026]
    if not years:
        print("No valid edition years given (expected 2007..2026).")
        return

    logos = load_existing()
    print(f"Starting with {len(logos)} club badges already in {OUT_FILE.name}.")
    print(f"Sweeping {len(years)} editions ({years[0]}..{years[-1]}), "
          f"{'Premier League only' if args.pl_only else 'all clubs'}.\n")

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

        # The one interactive navigation of the run. It earns the Cloudflare
        # clearance cookie AND exposes the edition dropdown, whose roster codes
        # are authoritative — the hardcoded table is wrong for several editions.
        print("Opening SoFIFA once to sign in past Cloudflare...")
        await page.goto(BASE_URL, wait_until="commit")
        await wait_for(page, 'a[href*="/player/"]', "players page")
        try:
            await discover_versions(page)
            n = len(scrape_missing.DISCOVERED_CODES)
            print(f"Discovered {n} roster codes from the edition dropdown.\n"
                  if n else "Edition dropdown empty — using the hardcoded codes.\n")
        except Exception as e:
            print(f"Version discovery failed ({e}); using the hardcoded codes.\n")

        for idx, year in enumerate(years):
            print(f"[{idx + 1}/{len(years)}] {edition_label(year)}")
            if idx > 0:
                await asyncio.sleep(random.uniform(1.0, 2.0))
            try:
                found = await sweep_edition(context, page, year, args.pl_only, args.diagnose)
            except Exception as e:
                print(f"  ! {edition_label(year)} failed: {e}")
                continue

            new_names = [c for c in found if c not in logos]
            logos.update(found)   # newer editions win — their CDN paths are live
            if new_names:
                preview = ", ".join(sorted(new_names)[:6])
                print(f"  + {len(new_names)} new: {preview}"
                      + (" …" if len(new_names) > 6 else ""))
            save(logos)   # save as we go so a crash keeps progress

        await context.close()

    save(logos)
    print(f"\nDONE — {len(logos)} club badges.")
    print(f"File: {OUT_FILE}")
    print("Upload it at https://knowitball.co.uk/admin/football/scrape (club logos input).")


if __name__ == "__main__":
    asyncio.run(main())
