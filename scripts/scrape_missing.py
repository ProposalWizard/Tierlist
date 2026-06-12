"""
Scrape ALL SoFIFA players across every FIFA edition (07-26).

Captures, for every player in every edition:
  - identity: sofifa_id, name, positions, nationality, age, overall, potential
  - club (from the player list) + league (joined from the Teams list, because
    SoFIFA no longer exposes league as a column on the players page)
  - EVERY stat column SoFIFA exposes (pulled dynamically so nothing is missed)
  - face image URL specific to that FIFA edition

How league works: the players page has no league column, so for each edition we
also sweep sofifa.com/teams (~14 pages) to build a club -> league map, then
stamp league onto every player by club name.

Run from your Windows desktop:
  python -m pip install playwright beautifulsoup4 playwright-stealth
  python -m playwright install chromium
  python scrape_missing.py

Single tab, Next button navigation. Stealth + persistent cookies reduce
captchas. Solve Cloudflare once if shown — cookie persists.

Flags:
  --force            Re-scrape all editions, even complete ones
  --year=YYYY        Scrape only that edition
  --download-faces   Also download face images to sofifa_data/faces/
  --infer-positions  Patch positions into existing JSON files using stat-based
                     inference. No browser needed — runs locally in seconds.
                     Combine with --year=YYYY to target specific editions.
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

# Seed column IDs for showCol[]. Expanded at runtime with every column SoFIFA
# offers (see discover_columns), so nothing is left out.
SEED_COLUMNS = [
    "pi", "ae", "oa", "pt",
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

ACTIVE_COLUMNS = list(SEED_COLUMNS)
COLUMNS_DISCOVERED = False

# Filled at runtime by reading SoFIFA's own edition dropdown (see
# discover_versions). This is AUTHORITATIVE — the hardcoded VERSION_CODES above
# were wrong for several editions (they pulled the wrong season's roster), so we
# always prefer codes read live from the site.
DISCOVERED_CODES: dict[int, str] = {}
VERSIONS_DISCOVERED = False


def code_for_year(year: int) -> str:
    """Prefer the code discovered live from SoFIFA; fall back to the hardcoded
    table only if discovery hasn't run / didn't find this edition."""
    return DISCOVERED_CODES.get(year) or VERSION_CODES.get(year, "")


BASE_URL = "https://sofifa.com/players"
TEAMS_URL = "https://sofifa.com/teams"


def build_url(year: int) -> str:
    vc = code_for_year(year)
    col_str = ",".join(ACTIVE_COLUMNS)
    show_col = "".join(f"&showCol%5B%5D={c}" for c in ACTIVE_COLUMNS)
    return f"{BASE_URL}?type=all&r={vc}&set=true&col={col_str}{show_col}"


def teams_url(year: int) -> str:
    vc = code_for_year(year)
    return f"{TEAMS_URL}?type=club&r={vc}&set=true"


def upscale_face_url(url: str | None) -> str | None:
    """SoFIFA face URLs end in _NN.png (size). Normalise to 120px — the
    largest variant that exists reliably across ALL editions."""
    if not url:
        return url
    return re.sub(r"_(\d+)\.png", "_120.png", url)


# ── Column discovery ─────────────────────────────────────────────────────────


async def discover_versions(page) -> dict[int, str]:
    """Read SoFIFA's edition dropdown so each year maps to the REAL roster code.

    The dropdown lists every edition, e.g. "EA SPORTS FC 26", "FIFA 23", each
    with an ?r=NNNNNN value. We map the edition label -> calendar year and keep
    the FIRST (latest) code seen per edition. This replaces the unreliable
    hardcoded table that was pulling the wrong season's data.
    """
    options = await page.query_selector_all('select[name="version"] option')
    for opt in options:
        value = await opt.get_attribute("value") or ""
        text = ((await opt.inner_text()) or "").strip()
        m = re.search(r"r=(\d+)", value)
        if not m:
            continue
        code = m.group(1)

        # "EA SPORTS FC 26" -> 2026 ;  "FIFA 23" -> 2023 ;  "FIFA 07" -> 2007
        em = re.search(r"\bFC\s*0?(\d{1,2})\b", text, re.I)
        if not em:
            em = re.search(r"\bFIFA\s*0?(\d{1,2})\b", text, re.I)
        if not em:
            continue
        year = 2000 + int(em.group(1))
        if year not in DISCOVERED_CODES:
            DISCOVERED_CODES[year] = code
    return DISCOVERED_CODES


async def discover_columns(page) -> dict[str, str]:
    """Read the showCol dropdown and add every option to ACTIVE_COLUMNS."""
    options = await page.query_selector_all('select[name="showCol[]"] option')
    cols: dict[str, str] = {}
    for opt in options:
        value = await opt.get_attribute("value")
        text = (await opt.inner_text()).strip()
        if not value or not text:
            continue
        cols[value] = text
        if value not in ACTIVE_COLUMNS:
            ACTIVE_COLUMNS.append(value)
    return cols


# ── HTML parsing: players ─────────────────────────────────────────────────────


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
    pos_spans = td.select("span.pos")
    if not pos_spans:
        pos_spans = td.select("span[class*='pos']")
    if not pos_spans:
        pos_spans = td.select("a[rel='nofollow'] span")
    if not pos_spans:
        # Fallback: any short text spans that look like position codes
        for span in td.select("span"):
            txt = span.get_text(strip=True)
            if txt in ("GK","CB","RB","LB","RWB","LWB","CDM","CM","CAM",
                        "RM","LM","RW","LW","ST","CF","SW","DM","RAM","LAM"):
                pos_spans.append(span)
    if pos_spans:
        player["positions"] = ",".join(s.get_text(strip=True) for s in pos_spans)

    flag = td.select_one("img.flag")
    if not flag:
        flag = td.select_one("img[title]")
    if flag:
        player["nationality"] = flag.get("title", "")


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
                print(f"  TD[{i}] class={cls} data-col='{dc}' text='{txt}'")
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

        # Club: scan every cell for a /team/ link (it lives in a column with no
        # data-col, so we can't address it directly).
        if not player.get("club"):
            for td in tds:
                tlink = td.select_one('a[href*="/team/"]')
                if tlink:
                    player["club"] = tlink.get_text(strip=True)
                    break

        if player.get("sofifa_id") and player.get("name"):
            players.append(player)

    return players


# ── HTML parsing: teams (for the club -> league map) ──────────────────────────


def parse_teams(html: str, dump_first: bool = False) -> list[tuple[str, str | None]]:
    """Return [(club_name, league_name)] from a Teams list page."""
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

    rows = table.select("tbody tr")
    if not rows:
        rows = table.select("tr")

    out: list[tuple[str, str | None]] = []
    for row_idx, row in enumerate(rows):
        tlink = row.select_one('a[href*="/team/"]')
        if not tlink:
            continue

        if dump_first and row_idx == 0:
            tds = row.select("td")
            print("\n  ─── TEAMS DIAGNOSTIC: First team row ───")
            for i, td in enumerate(tds):
                cls = td.get("class", [])
                dc = td.get("data-col", "")
                txt = td.get_text(strip=True)[:80]
                print(f"  TD[{i}] class={cls} data-col='{dc}' text='{txt}'")
                for a in td.select("a")[:3]:
                    print(f"         <a href='{a.get('href', '')[:60]}' text='{a.get_text(strip=True)}'")
            print("  ─── END TEAMS DIAGNOSTIC ───\n")

        club = tlink.get_text(strip=True)

        league = None
        llink = row.select_one('a[href*="/league/"]')
        if llink:
            league = llink.get_text(strip=True)
        else:
            # Fallback: any link that looks like a league filter
            for a in row.select("a"):
                h = a.get("href", "")
                if "/league/" in h or "lg=" in h:
                    league = a.get_text(strip=True)
                    break

        if club:
            out.append((club, league))

    return out


# ── Async browser helpers ────────────────────────────────────────────────────


async def _count(page, selector: str) -> int:
    try:
        return len(await page.query_selector_all(selector))
    except Exception:
        return 0


async def wait_for(page, selector: str, what: str, timeout: int = 180) -> bool:
    print(f"  Waiting for {what} (solve captcha if shown)...")
    deadline = time.time() + timeout
    last = -1
    while time.time() < deadline:
        c = await _count(page, selector)
        if c != last:
            print(f"  ...seeing {c} links")
            last = c
        if c >= 10:
            await asyncio.sleep(3)
            if await _count(page, selector) >= 10:
                print(f"  {what} ready.")
                return True
            last = -1
        await asyncio.sleep(2)
    return False


async def click_next(page, ready_selector: str, expected_r: str | None = None) -> bool:
    next_btn = await page.query_selector('a.bp3-button[rel="next"]')
    if not next_btn:
        next_btn = await page.query_selector('a[rel="next"]')
    if not next_btn:
        for link in await page.query_selector_all(".pagination a"):
            text = (await link.inner_text()).strip()
            if text in ("Next", "›", "»"):
                next_btn = link
                break
    if not next_btn:
        return False
    try:
        await next_btn.click()
        await page.wait_for_selector(ready_selector, timeout=15000)
        await asyncio.sleep(random.uniform(0.5, 1.0))
        if expected_r:
            url = page.url
            if f"r={expected_r}" not in url:
                print(f"  ⚠ VERSION DRIFT: expected r={expected_r} but URL is: {url[:120]}")
                print(f"  Stopping pagination — SoFIFA dropped the version filter.")
                return False
        return True
    except Exception as e:
        print(f"  Pagination stopped: {e}")
        return False


# ── Face downloading (optional) ──────────────────────────────────────────────


async def download_face(context, url: str, year: int, sofifa_id: str) -> bool:
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


# ── Club -> league map ─────────────────────────────────────────────────────────


async def build_club_league_map(page, year: int, dump: bool) -> dict[str, str]:
    print("  Building club -> league map from the Teams list...")
    await page.goto(teams_url(year), wait_until="commit")
    if not await wait_for(page, 'a[href*="/team/"]', "teams list"):
        print("  ⚠ Could not load teams list — league will stay blank.")
        return {}

    mapping: dict[str, str] = {}
    page_num = 1
    while True:
        html = await page.content()
        rows = parse_teams(html, dump_first=(dump and page_num == 1))
        if not rows:
            break
        for club, league in rows:
            if club and league and club not in mapping:
                mapping[club] = league
        if page_num == 1:
            with_league = sum(1 for _, lg in rows if lg)
            print(f"  Teams page 1: {len(rows)} clubs, {with_league} with a league link")
            if with_league == 0:
                print("  ⚠ No league links on the teams page — paste the TEAMS DIAGNOSTIC above.")
        if not await click_next(page, 'a[href*="/team/"]'):
            break
        page_num += 1

    print(f"  Mapped {len(mapping)} clubs to leagues.")
    return mapping


def apply_leagues(players: list[dict], club_league: dict[str, str]) -> int:
    matched = 0
    for p in players:
        club = (p.get("club") or "").strip()
        lg = club_league.get(club)
        if lg:
            p["league"] = lg
            matched += 1
    return matched


# ── Player scraping ────────────────────────────────────────────────────────────


async def ensure_discovery(page) -> None:
    """One-time: read SoFIFA's edition + column dropdowns from the default
    players page, so every edition uses the correct roster code and full columns."""
    global COLUMNS_DISCOVERED, VERSIONS_DISCOVERED
    if COLUMNS_DISCOVERED and VERSIONS_DISCOVERED:
        return

    await page.goto(BASE_URL, wait_until="commit")
    if not await wait_for(page, 'a[href*="/player/"]', "players page"):
        return

    if not VERSIONS_DISCOVERED:
        await discover_versions(page)
        VERSIONS_DISCOVERED = True
        if DISCOVERED_CODES:
            sample = ", ".join(
                f"{y}={DISCOVERED_CODES[y]}" for y in sorted(DISCOVERED_CODES, reverse=True)[:5]
            )
            print(f"  Discovered version codes for {len(DISCOVERED_CODES)} editions (e.g. {sample}).")
        else:
            print("  ⚠ Could not read the edition dropdown — falling back to hardcoded codes.")

    if not COLUMNS_DISCOVERED:
        disc = await discover_columns(page)
        if disc:
            print(f"  Discovered {len(disc)} columns; scraping {len(ACTIVE_COLUMNS)} total.")
        COLUMNS_DISCOVERED = True


async def scrape_players(page, context, year: int, download_faces: bool) -> list[dict]:
    label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"

    await ensure_discovery(page)

    vc = code_for_year(year)
    if not vc:
        print(f"  ⚠ No version code for {label} — cannot scrape safely, skipping.")
        return []
    print(f"  Using roster code r={vc} for {label}.")

    await page.goto(build_url(year), wait_until="commit")
    if not await wait_for(page, 'a[href*="/player/"]', "players page"):
        print(f"  Could not load {label}, skipping...")
        return []

    all_players: list[dict] = []
    seen_ids: set[str] = set()
    page_num = 1
    while True:
        html = await page.content()
        players = parse_html(html, dump_first=(page_num == 1))
        if not players:
            print(f"  Page {page_num}: no players parsed, stopping.")
            break

        dupes = sum(1 for p in players if p.get("sofifa_id") in seen_ids)
        if dupes > len(players) // 2:
            print(f"  ⚠ Page {page_num}: {dupes}/{len(players)} players already seen — pagination looped. Stopping.")
            break

        for p in players:
            pid = p.get("sofifa_id")
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                all_players.append(p)

        if download_faces:
            for p in players:
                await download_face(context, p.get("image_url"), year, p.get("sofifa_id"))

        if page_num == 1:
            first = players[0]
            attr_keys = sorted(k for k in first if k.startswith("attr_"))
            clubs = sum(1 for p in players if p.get("club"))
            faces = sum(1 for p in players if p.get("image_url"))
            print(f"  Page 1: {len(players)} players | {first.get('name')} | club={first.get('club')!r}")
            print(f"  >>> {len(attr_keys)} attrs | Club: {clubs}/{len(players)} | Faces: {faces}/{len(players)}")
            print(f"  >>> Face URL: {first.get('image_url')}")
            if clubs == 0:
                print("  ⚠ WARNING: No club data — paste the HTML DIAGNOSTIC above.")
        elif page_num % 10 == 0:
            print(f"  Page {page_num}: {len(all_players)} unique players so far...")

        if not await click_next(page, 'a[href*="/player/"]', expected_r=vc):
            print(f"  No more pages. Total: {len(all_players)} unique players.")
            break
        page_num += 1

    print(f"  TOTAL: {len(all_players)} unique players for {label}")
    return all_players


# ── File checking ────────────────────────────────────────────────────────────


MIN_PLAYERS = 5000


def _load(filepath: Path):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def players_complete(data) -> bool:
    """Players + attrs + club + faces present (league checked separately)."""
    if not isinstance(data, list) or len(data) < MIN_PLAYERS:
        return False
    sample = data[:100]
    if not any(len([k for k in p if k.startswith("attr_")]) >= 5 for p in sample):
        return False
    if sum(1 for p in sample if p.get("club")) < 10:
        return False
    if sum(1 for p in sample if p.get("image_url")) < 10:
        return False
    return True


def has_league(data) -> bool:
    if not isinstance(data, list):
        return False
    sample = data[:100]
    return sum(1 for p in sample if p.get("league")) >= 10


# ── Offline position inference (no browser needed) ──────────────────────────


def _parse_int(val) -> int:
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        return int(val.split()[0]) if val.strip() else 0
    return 0


def infer_position_from_stats(p: dict) -> str:
    pac = _parse_int(p.get("attr_pac", 0))
    sho = _parse_int(p.get("attr_sho", 0))
    pas = _parse_int(p.get("attr_pas", 0))
    dri = _parse_int(p.get("attr_dri", 0))
    defe = _parse_int(p.get("attr_def", 0))
    gd = _parse_int(p.get("attr_gd", 0)) or _parse_int(p.get("attr_div", 0))
    gr = _parse_int(p.get("attr_gr", 0)) or _parse_int(p.get("attr_ref", 0))
    fin = _parse_int(p.get("attr_fi", 0))
    cr = _parse_int(p.get("attr_cr", 0))
    vi = _parse_int(p.get("attr_vi", 0))
    ins = _parse_int(p.get("attr_in", 0))
    st = _parse_int(p.get("attr_st", 0))
    ma = _parse_int(p.get("attr_ma", 0))

    if gd > 50 or gr > 50:
        return "GK"
    if defe >= 75 and sho <= 60 and pac < 78:
        return "CB"
    if defe >= 70 and pac >= 78 and sho <= 65:
        return "RB,LB"
    if defe >= 70 and pas >= 70 and sho <= 65:
        return "CDM"
    if pac >= 82 and dri >= 75 and defe < 55 and pac > sho:
        return "RW,LW"
    if fin >= 75 and sho >= 70 and defe < 50:
        return "ST"
    if pas >= 75 and dri >= 73 and sho >= 68:
        return "CAM"
    if pas >= 68 and defe >= 50 and sho >= 55:
        return "CM"
    if pac >= 78 and dri >= 70 and defe < 60:
        return "RM,LM"
    if defe >= 65:
        return "CB"
    if sho >= 65:
        return "ST"
    return "CM"


def run_infer_positions(years: list[int]):
    """Patch positions into existing JSON files using stat-based inference.
    No browser needed — runs locally in seconds."""
    print("=== INFER POSITIONS (offline, no browser) ===\n")
    for year in years:
        fp = OUTPUT_DIR / f"fifa_{year}.json"
        data = _load(fp)
        if not data:
            print(f"  {fp.name}: not found or empty, skipping")
            continue

        missing = 0
        patched = 0
        for p in data:
            if not p.get("positions"):
                missing += 1
                pos = infer_position_from_stats(p)
                if pos:
                    p["positions"] = pos
                    patched += 1

        if missing == 0:
            print(f"  {fp.name}: all {len(data)} players already have positions ✓")
            continue

        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {fp.name}: patched {patched}/{missing} missing positions ({len(data)} total players)")

    print("\nDone! Re-import patched files at: https://knowitball.co.uk/admin/football/scrape")


# ── Main ─────────────────────────────────────────────────────────────────────


async def main():
    force = "--force" in sys.argv
    download_faces = "--download-faces" in sys.argv

    # Allow multiple --year= args; explicitly requesting a year always
    # re-scrapes it (so the 4 mislabelled editions can be redone without
    # --force re-doing all 20).
    requested_years = [
        int(arg.split("=")[1]) for arg in sys.argv[1:] if arg.startswith("--year=")
    ]

    years = requested_years if requested_years else ALL_YEARS
    force_years = force or bool(requested_years)

    # Fast offline mode: infer positions from stats, no browser needed
    if "--infer-positions" in sys.argv:
        run_infer_positions(years)
        return

    print("Mode: ALL LEAGUES & CLUBS")
    if download_faces:
        print(f"Downloading face images to: {FACES_DIR}")
    print()

    done = []
    need_league = []   # players ok, just backfill league (cheap)
    need_full = []     # full re-scrape
    for year in years:
        fp = OUTPUT_DIR / f"fifa_{year}.json"
        data = _load(fp) if fp.exists() and fp.stat().st_size > 1000 else None
        if data is not None and players_complete(data) and not force_years:
            if has_league(data):
                done.append(year)
            else:
                need_league.append(year)
        else:
            need_full.append(year)

    if done:
        print(f"Complete (players+club+league+faces): {', '.join(map(str, done))}")
    if need_league:
        print(f"Players OK, league backfill only (fast): {', '.join(map(str, need_league))}")
    if need_full:
        print(f"Full scrape needed: {', '.join(map(str, need_full))}")
    todo = need_full + need_league
    if not todo:
        print("All editions complete!")
        return

    print(f"Output directory: {OUTPUT_DIR}\n")

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

        first_teams_dump = True

        for idx, year in enumerate(todo):
            label = f"FC {str(year % 100).zfill(2)}" if year >= 2024 else f"FIFA {str(year % 100).zfill(2)}"
            backfill = year in need_league and year not in need_full
            print(f"\n{'=' * 50}")
            print(f"{'League backfill' if backfill else 'Scraping'} {label} (year {year})... [{idx + 1}/{len(todo)}]")
            print(f"{'=' * 50}")

            if idx > 0:
                await asyncio.sleep(random.uniform(2, 4))

            fp = OUTPUT_DIR / f"fifa_{year}.json"

            if backfill:
                players = _load(fp) or []
                if not players:
                    print("  Could not load existing file; will full-scrape instead.")
                    players = await scrape_players(page, context, year, download_faces)
            else:
                players = await scrape_players(page, context, year, download_faces)

            if not players:
                print(f"  No players for {label}. Restart later — finished years are skipped.")
                continue

            # Build club -> league map and stamp it on
            club_league = await build_club_league_map(page, year, dump=first_teams_dump)
            first_teams_dump = False
            matched = apply_leagues(players, club_league)
            print(f"  League stamped onto {matched}/{len(players)} players.")

            with open(fp, "w", encoding="utf-8") as f:
                json.dump(players, f, ensure_ascii=False, indent=2)
            print(f"  SAVED {len(players)} players -> {fp.name}")

        await context.close()

    print("\nDONE!")
    print(f"Files: {OUTPUT_DIR}")
    print("Import at: https://knowitball.co.uk/admin/football/scrape")


if __name__ == "__main__":
    asyncio.run(main())
