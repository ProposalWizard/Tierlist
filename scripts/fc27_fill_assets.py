"""
Fill in every missing face, position and nationality on the FC 27 roster —
in ONE pass, for every club the star career game actually uses.

WHAT IT DOES

  Reads the FC 27 roster straight from Supabase (fifa_year = 2027 — which is
  exactly the clubs in the Lineups area, because those rows only exist at all
  because the fc27_clone_* migrations put them there, plus anyone marked a
  free agent by hand). For every player, it works out what is actually
  MISSING and fetches only that:

    · a face      — if we do not already host one for him in Supabase Storage
    · positions   — if `positions` AND `manual_positions` are both blank
    · nationality — if `nationality` AND `manual_nationality` are both blank

  A player who needs nothing is never visited. A player who needs all three
  is visited ONCE and all three come off the same page load.

  What it writes:
    · the face   -> Storage at player-portraits/{sofifa_id}.png  (the exact
                    path the game already reads — see upload_player_images.py)
                    and then `image_url` on his FC 27 row, pointed at it
    · positions  -> `positions` on his FC 27 row
    · nationality-> `nationality` on his FC 27 row

WHY IT WILL NOT LEAVE A MESS BEHIND (the "no extra files" requirement)

  Nothing here ever creates a second copy of anything:

    · The storage path is DERIVED from the sofifa_id, so the same player
      always writes to the same object. There is no timestamp, no random
      suffix, no per-run folder. Uploading twice overwrites; it cannot
      duplicate.
    · Before scraping anything it LISTS what is already in Storage, so a
      player whose face we already host is skipped outright — not
      re-downloaded, not re-uploaded, not re-written.
    · Erling Haaland is the worked example: he already has a self-hosted
      face, so he is skipped for the face entirely, and he already has a
      position and a nationality, so he is skipped for those too. He is
      never visited at all.
    · It only ever WRITES a column that is currently blank. It cannot
      overwrite a real value, and it cannot overwrite an edit you made by
      hand.

  So running it twice is safe, and the second run has almost nothing to do.

RESUMABLE — this matters, because the first run is long

  Roughly 3,500 players; realistically an hour or two with the polite delay
  between page loads. Progress is written to a state file after every single
  player (sofifa_data/fc27_assets_state.json). If it crashes, if SoFIFA
  throws a Cloudflare check, if you close the laptop — just run the exact
  same command again. It picks up where it stopped and re-does nothing.

  Use --restart only if you deliberately want to re-check every player from
  scratch (it still skips anything already done in the database/storage, so
  even that is cheap).

BEFORE YOU RUN IT

  1. You must be signed in to SoFIFA in the scraper's browser profile. This
     uses the SAME persistent profile scrape_missing.py uses, so if that has
     worked for you recently, you are already signed in. If a Cloudflare
     check or a login page appears, solve it in the window — the script
     waits for you and then carries on.

  2. Environment variables (same values the app uses — the SERVICE ROLE key,
     not the anon key; it writes directly and bypasses row-level security):

         SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co
         SUPABASE_SERVICE_ROLE_KEY=...

  3. Dependencies, if you have not already:

         python -m pip install playwright beautifulsoup4 playwright-stealth requests
         python -m playwright install chromium

RUN

     python fc27_fill_assets.py --dry-run     # says exactly what it WOULD do
     python fc27_fill_assets.py               # does it

  Other flags:
     --faces-only          skip the positions/nationality work
     --data-only           skip the face work
     --limit=N             stop after N players (a small trial run)
     --restart             ignore the saved progress and re-check everyone
     --retry-failed        also re-check players previously found to have no
                           photo on SoFIFA at all (worth doing months later,
                           if they have since added some)
"""

import asyncio
import hashlib
import json
import os
import random
import sys

import requests

# Reuse the scraper that already knows how to get past SoFIFA, rather than
# writing a second, subtly different one. Everything imported here is
# unchanged and untouched by this file.
from scrape_missing import (
    FACES_DIR,
    OUTPUT_DIR,
    PROFILE_DIR,
    POSITION_CODES,
    code_for_year,
    build_url,
    discover_versions,
    download_face,
    upscale_face_url,
    _abs_cdn,
    wait_for,
    _is_cf_challenge,
    _beep,
)
from playwright.async_api import async_playwright

try:
    from playwright_stealth import stealth_async
except Exception:
    stealth_async = None


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

STAR_FIFA_YEAR = 2027       # must match STAR_FIFA_YEAR in lib/star/edition.ts
SOURCE_SCRAPE_YEAR = 2026   # FC 27 does not exist on SoFIFA; its rows are FC 26 clones
BUCKET = "tierlist-images"
STORAGE_PREFIX = "player-portraits"

STATE_FILE = OUTPUT_DIR / "fc27_assets_state.json"

# Polite pacing between player pages. The scraper this borrows from uses the
# same shape of delay; going faster is how a session gets challenged.
MIN_DELAY = 0.7
MAX_DELAY = 1.4

# How many players in a row can come back with neither a position nor a
# nationality before this is treated as something systemically wrong rather
# than an unlucky run of genuinely sparse data. See the circuit breaker below.
EMPTY_STREAK_LIMIT = 8


def die(msg: str) -> None:
    print(f"\n✗ {msg}")
    sys.exit(1)


async def _is_signin_page(page) -> bool:
    """SoFIFA has bounced this request to its own sign-in page.

    A DIFFERENT thing from `_is_cf_challenge` — that is Cloudflare's "checking
    your browser" interstitial, which clears itself or is solved with a
    puzzle. This is SoFIFA's own login wall, and it is what actually happens
    partway through a long run of single-player-page visits: hitting one
    page after another in quick succession, thousands of times, reads
    differently to SoFIFA than normal browsing, and it can quietly sign the
    session back out — with no Cloudflare challenge involved at all, so the
    existing check never saw it. Every player visited after that point looks
    like "nothing found" instead of "not signed in", which is exactly the
    failure this is here to catch instead.
    """
    try:
        if "/signin" in (page.url or ""):
            return True
        if await page.query_selector('input[type="password"]'):
            return True
    except Exception:
        pass
    return False


async def _wait_for_signin(page, url: str) -> bool:
    """Pause and alert, the same shape as the Cloudflare wait below, until a
    human has actually logged back in. Returns False if ten minutes pass with
    nobody there — the caller stops the whole run rather than grinding
    through the remaining roster recording nothing but failures.

    Deliberately does NOT reload the page while waiting — only checks its
    current state. Re-navigating every few seconds would wipe out an email
    and password mid-type, turning "please log in" into something nobody
    could actually act on.
    """
    print("\n" + "=" * 60)
    print("  *** SIGNED OUT OF SOFIFA — PLEASE LOG BACK IN ***")
    print("  A browser window is open. Sign in there, then this")
    print("  will notice and carry on by itself.")
    print("=" * 60 + "\n")
    _beep()
    for _ in range(120):  # 120 x 5s = 10 minutes
        await asyncio.sleep(5)
        if not await _is_signin_page(page):
            print("  ...signed in, carrying on.\n")
            # SoFIFA redirects on login to wherever it likes, not back to the
            # player we actually wanted — one real navigation, now that it is
            # safe to do without disturbing anything.
            await page.goto(url, wait_until="commit")
            await asyncio.sleep(1.0)
            return True
    return False


def _headers() -> dict:
    return {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}


# ── Reading what we already have ────────────────────────────────────────────


def fetch_roster() -> list[dict]:
    """Every FC 27 row, paginated.

    PostgREST caps a response (1000 by default), and the roster is several
    thousand — asking once and trusting the answer would silently process a
    third of the squad and report success, which is exactly the class of bug
    this whole exercise is meant to end.
    """
    out: list[dict] = []
    step = 1000
    offset = 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/sofifa_players",
            params={
                "select": "sofifa_id,name,club,image_url,positions,manual_positions,nationality,manual_nationality",
                "fifa_year": f"eq.{STAR_FIFA_YEAR}",
                "order": "sofifa_id.asc",
                "limit": str(step),
                "offset": str(offset),
            },
            headers=_headers(),
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()
        out.extend(batch)
        if len(batch) < step:
            break
        offset += step
    return out


def fetch_hosted_face_ids() -> set[str]:
    """Which sofifa_ids we ALREADY host a portrait for, read from Storage
    itself rather than inferred from image_url.

    Storage is the honest answer to "do we have the file": a row can point at
    a stale SoFIFA CDN link while the file sits in our bucket perfectly fine
    (that is precisely the state most of these rows are in), and re-scraping
    those would be wasted hours and a pile of redundant uploads.
    """
    have: set[str] = set()
    limit = 1000
    offset = 0
    while True:
        resp = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET}",
            json={
                "prefix": f"{STORAGE_PREFIX}/",
                "limit": limit,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            },
            headers={**_headers(), "Content-Type": "application/json"},
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        for obj in batch:
            name = obj.get("name") or ""
            if not name.endswith(".png"):
                continue
            stem = name[:-4]
            # The star game's portraits are `{id}.png`. Draft mode's archive
            # writes `{id}-{year}.png` into the same folder on purpose (the
            # same player can have a genuinely different photo per edition —
            # see upload_pl_draft_images.py), and one of those is NOT a face
            # for this roster, so it must not count as "already have it".
            if "-" in stem:
                continue
            have.add(stem)
        if len(batch) < limit:
            break
        offset += limit
    return have


def _blank(v) -> bool:
    return v is None or str(v).strip() == ""


# ── Writing ─────────────────────────────────────────────────────────────────


def upload_face(sofifa_id: str, data: bytes) -> str:
    """PUT the file and return its public URL. x-upsert is what makes a
    second run overwrite in place instead of erroring or duplicating."""
    path = f"{STORAGE_PREFIX}/{sofifa_id}.png"
    resp = requests.put(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        data=data,
        headers={
            **_headers(),
            "Content-Type": "image/png",
            "x-upsert": "true",
        },
        timeout=60,
    )
    resp.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


def patch_row(sofifa_id: str, fields: dict) -> None:
    if not fields:
        return
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/sofifa_players",
        params={"sofifa_id": f"eq.{sofifa_id}", "fifa_year": f"eq.{STAR_FIFA_YEAR}"},
        json=fields,
        headers={**_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
        timeout=30,
    )
    resp.raise_for_status()


def delete_face(sofifa_id: str) -> None:
    """Remove a portrait we should not have uploaded. Only ever called on a
    file this same run put there — see the placeholder guard below."""
    try:
        requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{STORAGE_PREFIX}/{sofifa_id}.png",
            headers=_headers(),
            timeout=30,
        )
    except Exception:
        pass


# ── The placeholder guard ───────────────────────────────────────────────────
#
# SoFIFA does not always 404 a player it has no photo for; it can serve a
# generic grey silhouette with a perfectly healthy 200. download_face's own
# checks (non-200, empty, tiny body) cannot tell that apart from a real face,
# so without this we would cheerfully upload the SAME placeholder image
# hundreds of times under hundreds of different names — filling the bucket
# with junk AND making the game show SoFIFA's placeholder where it would
# otherwise correctly fall through to our own silhouette. Exactly the "extra
# files that confuse everything" outcome to avoid.
#
# A real face is unique to one player. So: hash every image before uploading
# it, and the moment the same bytes turn up for a third different player,
# treat that hash as a placeholder from then on — stop uploading it, and undo
# the one or two that already went up before it was recognisable. Self-healing
# rather than something that needs a second clean-up pass.

PLACEHOLDER_AT = 3  # occurrences of one image before it is judged a placeholder


class FaceGuard:
    def __init__(self) -> None:
        self.seen: dict[str, list[str]] = {}   # hash -> ids uploaded with it
        self.placeholders: set[str] = set()    # hashes judged generic
        self.blocked = 0

    def check(self, data: bytes) -> tuple[bool, str, list[str]]:
        """(may_upload, digest, ids_to_undo)."""
        digest = hashlib.sha256(data).hexdigest()
        if digest in self.placeholders:
            self.blocked += 1
            return False, digest, []
        ids = self.seen.setdefault(digest, [])
        if len(ids) + 1 >= PLACEHOLDER_AT:
            # This is the third player with byte-identical art. It is not a
            # face; it is whatever SoFIFA shows when it hasn't got one.
            self.placeholders.add(digest)
            self.blocked += 1
            undo = list(ids)
            self.seen[digest] = []
            return False, digest, undo
        return True, digest, []

    def record(self, digest: str, sofifa_id: str) -> None:
        self.seen.setdefault(digest, []).append(sofifa_id)


# ── Reading one player's page ───────────────────────────────────────────────


def parse_player_page(html: str, sofifa_id: str) -> dict:
    """Face URL, positions and nationality off a single player's own page.

    Deliberately forgiving, in the same style as the list-page parsers in
    scrape_missing.py: SoFIFA's markup has shifted between editions more than
    once, so every field has more than one way of being found and a miss
    returns nothing rather than raising.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    out: dict = {}

    # ── Face ──
    for img in soup.select("img"):
        src = img.get("data-src") or img.get("src") or ""
        if "/players/" in src:
            out["face"] = upscale_face_url(_abs_cdn(src))
            break
    if "face" not in out:
        # Not in the markup: build it. SoFIFA splits the id into two 3-digit
        # directories and names the file after the edition.
        padded = sofifa_id.zfill(6)
        out["face"] = (
            f"https://cdn.sofifa.net/players/{padded[:3]}/{padded[3:6]}/"
            f"{str(SOURCE_SCRAPE_YEAR)[-2:]}_120.png"
        )

    # ── Positions ──
    codes: list[str] = []
    for span in soup.select("span.pos, span[class*='pos']"):
        txt = span.get_text(strip=True)
        if txt in POSITION_CODES and txt not in codes:
            codes.append(txt)
    if not codes:
        # Last resort: the header line usually reads "ST, LW" near the name.
        header = soup.select_one("h1") or soup
        for word in header.get_text(" ", strip=True).replace(",", " ").split():
            if word in POSITION_CODES and word not in codes:
                codes.append(word)
    if codes:
        out["positions"] = ",".join(codes)

    # ── Nationality ──
    # The country link is the reliable anchor — `/players?na=` on the player
    # page, whatever the flag element around it is doing this edition.
    nat_link = soup.select_one('a[href*="na="]')
    if nat_link:
        nat = (nat_link.get("title") or nat_link.get("aria-label") or nat_link.get_text(strip=True) or "").strip()
        if nat:
            out["nationality"] = nat
    if "nationality" not in out:
        flag = soup.select_one("img.flag") or soup.select_one("img[src*='flag']") or soup.select_one("img[data-src*='flag']")
        if flag:
            nat = (flag.get("title") or flag.get("alt") or "").strip()
            if not nat:
                parent = flag.find_parent("a")
                if parent:
                    nat = (parent.get("title") or parent.get("aria-label") or "").strip()
            if nat:
                out["nationality"] = nat

    return out


# ── State ───────────────────────────────────────────────────────────────────


def load_state(restart: bool) -> dict:
    if restart or not STATE_FILE.exists():
        return {"done": [], "no_face": []}
    try:
        state = json.loads(STATE_FILE.read_text())
        state.setdefault("done", [])
        state.setdefault("no_face", [])
        return state
    except Exception:
        return {"done": [], "no_face": []}


def save_state(state: dict) -> None:
    try:
        STATE_FILE.write_text(json.dumps(state))
    except Exception:
        pass  # progress-saving must never be the thing that kills a long run


# ── The run ─────────────────────────────────────────────────────────────────


async def run() -> None:
    dry_run = "--dry-run" in sys.argv
    faces_only = "--faces-only" in sys.argv
    data_only = "--data-only" in sys.argv
    restart = "--restart" in sys.argv
    retry_failed = "--retry-failed" in sys.argv
    limit = next((int(a.split("=", 1)[1]) for a in sys.argv[1:] if a.startswith("--limit=")), None)

    if faces_only and data_only:
        die("--faces-only and --data-only are opposites; pass neither to do both.")
    if not SUPABASE_URL or not SERVICE_KEY:
        die("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first — see the note at the top of this file.")

    print("=" * 66)
    print("  fc27_fill_assets.py — faces, positions and nationalities for FC 27")
    print("=" * 66)
    if dry_run:
        print("  DRY RUN — nothing will be downloaded, uploaded or written.\n")

    print("Reading the FC 27 roster from Supabase...")
    roster = fetch_roster()
    print(f"  {len(roster)} players on the FC 27 roster.")

    print("Asking Storage which portraits we already host...")
    hosted = fetch_hosted_face_ids()
    print(f"  {len(hosted)} portraits already in storage.\n")

    state = load_state(restart)
    done = set(state.get("done", []))
    no_face = set(state.get("no_face", []))
    if retry_failed:
        no_face = set()
        print("--retry-failed: players previously found to have no photo will be checked again.\n")
    if done and not restart:
        print(f"Resuming — {len(done)} player(s) already processed on a previous run.\n")

    # ── Work out who actually needs what ──
    work: list[dict] = []
    for row in roster:
        sid = str(row["sofifa_id"])
        if sid in done:
            continue
        needs_face = (not data_only) and sid not in hosted and sid not in no_face
        needs_pos = (not faces_only) and _blank(row.get("positions")) and _blank(row.get("manual_positions"))
        needs_nat = (not faces_only) and _blank(row.get("nationality")) and _blank(row.get("manual_nationality"))
        if needs_face or needs_pos or needs_nat:
            work.append({
                "sofifa_id": sid,
                "name": row.get("name") or "?",
                "club": row.get("club") or "?",
                "face": needs_face,
                "pos": needs_pos,
                "nat": needs_nat,
            })

    n_face = sum(1 for w in work if w["face"])
    n_pos = sum(1 for w in work if w["pos"])
    n_nat = sum(1 for w in work if w["nat"])
    print(f"Needs a face ....... {n_face}")
    print(f"Needs positions .... {n_pos}")
    print(f"Needs nationality .. {n_nat}")
    print(f"Players to visit ... {len(work)}   (each visited once, for everything he needs)\n")

    if not work:
        print("Nothing to do — every player already has a face, a position and a nationality. ✓")
        return

    if limit:
        work = work[:limit]
        print(f"--limit={limit}: only the first {len(work)} will be processed this run.\n")

    if dry_run:
        print("Sample of what would be fetched:")
        for w in work[:15]:
            wants = ", ".join(k for k in ("face", "pos", "nat") if w[k])
            print(f"    {w['name']:<28} {w['club']:<26} -> {wants}")
        if len(work) > 15:
            print(f"    ...and {len(work) - 15} more")
        print("\n(Dry run — nothing changed. Re-run without --dry-run to do it.)")
        return

    faces_dir = FACES_DIR / str(SOURCE_SCRAPE_YEAR)
    faces_dir.mkdir(parents=True, exist_ok=True)

    ok_face = ok_pos = ok_nat = 0
    failures: list[str] = []
    no_photo: list[str] = []   # SoFIFA genuinely has no face for these
    undone: list[str] = []     # placeholder uploads taken back out again
    guard = FaceGuard()
    consecutive_empty = 0

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

        # Land on the site once so Cloudflare settles and the real edition
        # codes can be read live (the hardcoded table has been wrong before).
        print("Opening SoFIFA (solve any Cloudflare check in the window if it appears)...")
        await page.goto(build_url(SOURCE_SCRAPE_YEAR), wait_until="commit")
        await wait_for(page, 'a[href*="/player/"]', "players list", timeout=120)
        await discover_versions(page)
        vc = code_for_year(SOURCE_SCRAPE_YEAR)
        print(f"  Ready. Edition code {vc}.\n")

        for i, w in enumerate(work, 1):
            sid = w["sofifa_id"]
            url = f"https://sofifa.com/player/{sid}/?r={vc}&set=true"
            try:
                await page.goto(url, wait_until="commit")
                await asyncio.sleep(MIN_DELAY + random.random() * (MAX_DELAY - MIN_DELAY))

                # A challenge mid-run is normal on a long session. Wait for a
                # human rather than burning through the rest of the list
                # recording thousands of bogus failures.
                if await _is_cf_challenge(page):
                    print("\n  ⚠ Cloudflare check — please solve it in the browser window. Waiting...")
                    for _ in range(120):
                        await asyncio.sleep(5)
                        if not await _is_cf_challenge(page):
                            break
                    print("  ...carrying on.\n")
                    await page.goto(url, wait_until="commit")
                    await asyncio.sleep(1.0)

                # A separate check from the one above — see _is_signin_page.
                # This is the one that actually bit on the first real run:
                # thousands of single-player visits in a row read differently
                # to SoFIFA than normal browsing and it quietly logs the
                # session out, with no Cloudflare challenge involved at all.
                if await _is_signin_page(page):
                    if not await _wait_for_signin(page, url):
                        print("\n✗ Still signed out after ten minutes with nobody there. Stopping here")
                        print("  rather than recording thousands of bogus failures. Progress is saved —")
                        print("  log in and run the exact same command again to pick up where this left off.")
                        return

                html = await page.content()
                parsed = parse_player_page(html, sid)

                # ── Circuit breaker ──
                #
                # A handful of genuinely photo-less or data-less players in a
                # row is normal. Many in a row, back to back, is not a
                # coincidence — it is this same "quietly logged out" failure
                # slipping past both checks above in some new way, and
                # grinding through the rest of a 3,000-player list recording
                # nothing is worse than stopping and saying so plainly.
                if not parsed.get("positions") and not parsed.get("nationality"):
                    consecutive_empty += 1
                else:
                    consecutive_empty = 0
                if consecutive_empty >= EMPTY_STREAK_LIMIT:
                    print(f"\n✗ {consecutive_empty} players in a row came back with nothing at all — that")
                    print("  is not normal, even for smaller leagues. Something is systematically wrong")
                    print("  (signed out in a way this didn't catch, blocked, or SoFIFA's page layout")
                    print("  has changed) rather than SoFIFA genuinely lacking this much data in a row.")
                    print("  Stopping here instead of burning through the rest of the list. Progress is")
                    print("  saved — check the browser window, then run the exact same command again.")
                    return

                patch: dict = {}
                # Whether everything this player was VISITED for actually got
                # resolved. A transient failure must not be recorded as done,
                # or a re-run would skip him forever — see the bookkeeping
                # note where `done` is written below.
                settled = True

                if w["face"]:
                    result = await download_face(page, parsed["face"], SOURCE_SCRAPE_YEAR, sid)
                    local = faces_dir / f"{sid}.png"
                    if result in ("ok", "skip") and local.exists():
                        data = local.read_bytes()
                        may_upload, digest, undo = guard.check(data)
                        for bad_id in undo:
                            # Recognised too late for these one or two: take
                            # them back out rather than leaving junk behind.
                            delete_face(bad_id)
                            patch_row(bad_id, {"image_url": None})
                            ok_face -= 1
                            undone.append(bad_id)
                            no_face.add(bad_id)
                        if may_upload:
                            new_url = upload_face(sid, data)
                            patch["image_url"] = new_url
                            guard.record(digest, sid)
                            ok_face += 1
                        else:
                            # SoFIFA's "no photo" art. Leave image_url alone so
                            # the game shows OUR silhouette, and remember that
                            # there is nothing here to come back for.
                            local.unlink(missing_ok=True)
                            no_photo.append(sid)
                            no_face.add(sid)
                    elif result.startswith("HTTP 404"):
                        # A definite "no such image" rather than a hiccup.
                        no_photo.append(sid)
                        no_face.add(sid)
                    else:
                        failures.append(f"{w['name']} ({sid}) face: {result}")
                        settled = False

                if w["pos"]:
                    if parsed.get("positions"):
                        patch["positions"] = parsed["positions"]
                        ok_pos += 1
                    else:
                        # The page loaded but had no position on it — that is
                        # a parse/no-data case, not a network one. Retrying it
                        # every run forever would be pointless, but silently
                        # calling it done would hide it, so it is reported.
                        failures.append(f"{w['name']} ({sid}): no position found on the page")
                if w["nat"]:
                    if parsed.get("nationality"):
                        patch["nationality"] = parsed["nationality"]
                        ok_nat += 1
                    else:
                        failures.append(f"{w['name']} ({sid}): no nationality found on the page")

                if patch:
                    patch_row(sid, patch)

                # ── Bookkeeping ──
                #
                # `done` means "do not visit this player again". It is only
                # written when nothing transient went wrong, so a crashed
                # request, a timeout or a blocked upload is retried on the
                # next run rather than being skipped for good. `no_face` is
                # the separate, narrower memory of "SoFIFA has no photo of
                # this man" — worth remembering so a re-run does not spend
                # hours re-checking hundreds of players it already knows have
                # nothing, and clearable with --retry-failed.
                if settled:
                    done.add(sid)
                state["done"] = sorted(done)
                state["no_face"] = sorted(no_face)
                save_state(state)

            except Exception as e:
                failures.append(f"{w['name']} ({sid}): {e}")

            if i % 25 == 0 or i == len(work):
                print(f"  ...{i}/{len(work)}   faces {ok_face}, positions {ok_pos}, nationalities {ok_nat}, failed {len(failures)}")

        await context.close()

    print("\n" + "=" * 66)
    print(f"  Faces uploaded ........ {ok_face}")
    print(f"  Positions filled ...... {ok_pos}")
    print(f"  Nationalities filled .. {ok_nat}")
    print(f"  No photo exists ....... {len(no_photo)}  (SoFIFA's placeholder — left on our silhouette)")
    print(f"  Failures .............. {len(failures)}")
    print("=" * 66)
    if undone:
        print(f"\n  ({len(undone)} placeholder upload(s) were recognised a moment late and removed again.)")
    if failures:
        print("\nFailures (these are usually players SoFIFA genuinely has no photo for):")
        for f in failures[:30]:
            print(f"    - {f}")
        if len(failures) > 30:
            print(f"    ...and {len(failures) - 30} more")
        print("\nRe-running the same command will retry only what is still missing.")
    else:
        print("\nAll done. Reload the game — the Lineups screens should be complete.")


if __name__ == "__main__":
    asyncio.run(run())
