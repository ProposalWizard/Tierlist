#!/usr/bin/env python3
"""Scrape Premier League club badges from SoFIFA into a {club: logo_url} map.

WHY IT LOOKS LIKE THIS
----------------------
Cloudflare challenges every browser NAVIGATION, so a goto() per edition meant a
CAPTCHA per edition. Reusing the clearance cookie through context.request does
NOT help — that issues requests outside the browser's network stack, so the TLS
and header fingerprint differ and Cloudflare challenges them anyway.

What works is running fetch() INSIDE the already-cleared page via
page.evaluate: the real browser stack, the live cookie jar, and a same-origin
request. So we navigate once to earn clearance (which also reads the roster
codes from the edition dropdown), then pull every teams page in-page.

Sweeping the Premier League only is the default, and deliberately so: it is one
page per edition, and the American draft this feeds uses PL players
exclusively. --all-clubs sweeps everything, but that is roughly twelve pages
per edition instead of one, which is a lot more exposure to challenges for
coverage the draft never reads.

Output: <sofifa_data>/pl_club_logos.json — merged with whatever is already
there, so re-runs accumulate and nothing is lost.

Upload it at /admin/football/scrape (the club logos input).

Usage:
    python scrape_pl_logos.py                     # PL, editions 2007..2026
    python scrape_pl_logos.py --years 2012 2019   # specific editions
    python scrape_pl_logos.py --all-clubs         # every club (slow, many pages)
    python scrape_pl_logos.py --diagnose          # per-page detail
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
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
    _abs_cdn,
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


async def reclear(page, url: str) -> str | None:
    """Navigate for real so a human can solve a challenge; returns the page HTML."""
    print("\n" + "=" * 60)
    print("  *** CLOUDFLARE CHALLENGE — SOLVE IN THE BROWSER WINDOW ***")
    print("=" * 60 + "\n")
    try:
        scrape_missing._beep()
    except Exception:
        pass
    await page.goto(url, wait_until="commit")
    if not await wait_for(page, 'a[href*="/team/"]', "teams page", min_count=1):
        return None
    return await page.content()


async def fetch_html(page, url: str, allow_reclear: bool = True) -> str | None:
    """Fetch a page WITHOUT navigating, by running fetch() inside the already
    cleared page.

    context.request looked like the obvious way to reuse the clearance cookie,
    but it issues requests outside the browser's network stack — different TLS
    and header fingerprint — so Cloudflare challenged every one regardless of
    cookies. Running fetch() inside the page uses the real browser stack, the
    live cookie jar and a same-origin request, which is what actually gets
    through. Navigation is then only needed if clearance genuinely lapses.
    """
    try:
        html = await page.evaluate(
            """async (u) => {
                const r = await fetch(u, { credentials: 'include' });
                return await r.text();
            }""",
            url,
        )
    except Exception as e:
        print(f"    in-page fetch failed ({e})")
        html = None

    if html and not looks_like_challenge(html):
        return html
    if not allow_reclear:
        return None
    return await reclear(page, url)


def parse_teams_with_logos(html: str) -> list[dict]:
    """Parse the teams table, resolving badge URLs from RAW server HTML.

    scrape_missing.parse_teams reads img["src"], which is correct for a rendered
    page but empty here: fetching the HTML directly skips the lazy-load script
    that fills src in, so every badge came back blank even though the club names
    parsed fine. Check the lazy-load attributes too, and if there is still no
    image, derive the badge from the team id in the row's own link — SoFIFA
    serves them at a predictable path, so the id is enough.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table.table")
    if not table:
        for t in soup.select("table"):
            if t.select_one('a[href*="/team/"]'):
                table = t
                break
    if not table:
        return []

    rows = table.select("tbody tr") or table.select("tr")
    out: list[dict] = []

    for row in rows:
        tlink = row.select_one('a[href*="/team/"]')
        if not tlink:
            continue
        club = tlink.get_text(strip=True)
        if not club:
            continue

        logo = ""
        for img in row.select("img"):
            for attr in ("data-src", "data-original", "data-lazy", "src"):
                val = (img.get(attr) or "").strip()
                if val and "/teams/" in val:
                    logo = val
                    break
            if not logo:
                srcset = (img.get("srcset") or img.get("data-srcset") or "").strip()
                if srcset and "/teams/" in srcset:
                    logo = srcset.split(",")[0].strip().split(" ")[0]
            if logo:
                break

        # Fallback: /team/<id>/<slug>/ -> the badge path for that id.
        if not logo:
            m = re.search(r"/team/(\d+)", tlink.get("href", "") or "")
            if m:
                logo = f"https://cdn.sofifa.net/teams/{m.group(1)}/60.png"

        if logo:
            out.append({"club": club, "club_logo_url": _abs_cdn(logo), "league": None})

    return out


async def sweep_edition(page, year: int, pl_only: bool, diagnose: bool) -> dict[str, str]:
    """Return {club: logo_url} for one edition, paging with &offset=."""
    if not code_for_year(year):
        print(f"  ! No roster code for {edition_label(year)} — skipping.")
        return {}

    found: dict[str, str] = {}
    offset = 0
    page_num = 1

    while True:
        url = teams_page_url(year, offset=offset, pl_only=pl_only)
        # Only allow a re-clear on the first page of an edition. Without this a
        # persistently blocked page loops forever re-prompting for a CAPTCHA.
        html = await fetch_html(page, url, allow_reclear=(page_num == 1))
        if html is None:
            print(f"  ! Could not load {edition_label(year)} at offset {offset}.")
            break

        rows = parse_teams_with_logos(html)
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
        if page_num > 40:
            print("    (stopping — page cap reached)")
            break
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
    ap.add_argument("--all-clubs", action="store_true",
                    help="Sweep every club, not just the Premier League. Far more "
                         "page loads (~12 pages per edition instead of 1).")
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
          f"{'all clubs' if args.all_clubs else 'Premier League only'}.\n")

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
                found = await sweep_edition(page, year, not args.all_clubs, args.diagnose)
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
