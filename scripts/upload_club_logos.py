"""
Self-host club_logos.logo_url in Supabase Storage instead of hotlinking
SoFIFA's CDN, which now hard-blocks a plain/anonymous request (confirmed:
a direct curl to a stored logo_url returns 403, and a fresh browser hitting
cdn.sofifa.net is bounced to Cloudflare, then sofifa.com itself redirects
an unauthenticated visit to its sign-in page).

This is the same lockout already fixed for player faces (see
upload_player_images.py / upload_pl_draft_images.py) — club_logos was never
migrated. The table itself is fine: 916 rows, a working public-read RLS
policy. `ClubBadge.tsx` fetches the row, sets <img src> to the SoFIFA URL,
the image fails to load, `onError` fires, and it silently falls back to the
plain kit-and-initials circle — which is why this looked like "nothing shows"
with no error anywhere.

HOW THE DOWNLOAD WORKS
  Same technique as scrape_missing.py's download_face: a plain fetch() to
  another origin is blocked by CORS (SoFIFA's CDN doesn't opt in), and a
  direct request carries no referer and gets a flat 403. An <img> tag
  loading the same URL from an already-cleared SoFIFA page is NOT subject to
  CORS and carries a real referer — that's genuinely how the badge shows up
  on SoFIFA's own team pages. It still won't hand the bytes to page script,
  but Playwright's own network listener sees the response regardless (CORS
  restricts what PAGE JAVASCRIPT can read, not what the browser — and so
  Playwright — can see). Reuses the same persistent, already-authenticated
  browser profile scrape_missing.py uses.

HOW THE UPLOAD WORKS
  Needs SUPABASE_SERVICE_ROLE_KEY (see upload_player_images.py) — storage.objects
  only grants INSERT to 'authenticated', and club_logos itself only grants
  public SELECT, so a script has no writable path with the anon key alone.
  The very first run of this script (911 of 916 rows) used a temporary
  storage policy the user explicitly approved for that one session instead
  (`temp_anon_upload_club_logos`, dropped again immediately after); that
  policy no longer exists, so treat SUPABASE_SERVICE_ROLE_KEY as the only
  supported path from here on. Uploads use PUT + x-upsert (safe to re-run —
  a second pass overwrites rather than 409s), and the DB patch happens in
  this same script now (see patch_logo_url), not as a separate manual SQL
  step.

SETUP
  pip install requests

  Set these as environment variables (see .env.local or Vercel):
      SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co
      SUPABASE_SERVICE_ROLE_KEY=...

RUN
  python upload_club_logos.py             # downloads, uploads, patches the DB
  python upload_club_logos.py --limit=5   # smoke-test a handful first
  python upload_club_logos.py --dry-run   # reports what it would do; changes nothing
"""

import asyncio
import json
import os
import random
import re
import sys
import unicodedata
from pathlib import Path

import requests
from playwright.async_api import async_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scrape_missing  # noqa: E402
from scrape_missing import BASE_URL, PROFILE_DIR, stealth_async, wait_for  # noqa: E402

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cagkgfketucousksgtbk.supabase.co").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "tierlist-images"
STORAGE_PREFIX = "club-logos"

OUT_DIR = scrape_missing.OUTPUT_DIR / "club_logos"
OUT_DIR.mkdir(parents=True, exist_ok=True)
RESULT_FILE = OUT_DIR.parent / "club_logo_urls.json"


def normalize_club_key(club: str) -> str:
    """Mirror lib/star/clubLogos.ts's normalizeClubKey exactly — this is the
    key both sides need to agree on, so a badge fetched here under one
    spelling is still found by the app under whatever spelling it re-reads
    club_logos.club as."""
    s = club.lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # strip accents
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z0-9]", "", s)
    return s


def fetch_rows() -> list[dict]:
    """club_logos has public-read RLS, but this uses the service key too —
    one key for the whole script, and it needs to be set anyway for the
    write side below."""
    out, offset, page_size = [], 0, 1000
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/club_logos",
            params={"select": "club,logo_url", "offset": offset, "limit": page_size},
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json()
        out.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return out


async def download_one(page, club: str, url: str) -> str:
    """Returns "ok", "skip" (already have it), or an error string."""
    key = normalize_club_key(club)
    dest = OUT_DIR / f"{key}.png"
    if dest.exists():
        return "skip"

    fetch_url = f"{url}{'&' if '?' in url else '?'}_cb={random.randint(0, 999_999_999)}"
    captured = {}

    def on_response(response):
        if response.url == fetch_url:
            captured["response"] = response

    page.on("response", on_response)
    try:
        loaded = await page.evaluate(
            """(u) => new Promise((resolve) => {
                const img = document.createElement("img");
                img.onload = () => { resolve(true); img.remove(); };
                img.onerror = () => { resolve(false); img.remove(); };
                img.src = u;
                document.body.appendChild(img);
            })""",
            fetch_url,
        )
        resp = captured.get("response")
        if not resp:
            return "img loaded but no matching response was captured"
        if not resp.ok:
            return f"HTTP {resp.status}"
        body = await resp.body()
        if not body or len(body) < 100:
            return f"empty/tiny body ({len(body) if body else 0} bytes)"
        if not loaded:
            return f"img.onerror despite a response ({len(body)} bytes, HTTP {resp.status})"
        dest.write_bytes(body)
        return "ok"
    except Exception as e:
        return f"error: {e}"
    finally:
        page.remove_listener("response", on_response)


def upload_to_storage(key: str, data: bytes) -> str:
    """PUT + x-upsert: the service role bypasses RLS entirely, so unlike the
    very first (anon, temp-policy) run, there's no reason to avoid upsert —
    x-upsert makes this safe to re-run, a second pass overwrites rather than
    409ing on a key that's already there."""
    path = f"{STORAGE_PREFIX}/{key}.png"
    resp = requests.put(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        data=data,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "image/png",
            "x-upsert": "true",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


def patch_logo_url(club: str, url: str) -> None:
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/club_logos",
        params={"club": f"eq.{club}"},
        json={"logo_url": url},
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        timeout=30,
    )
    resp.raise_for_status()


async def main() -> None:
    if not SERVICE_KEY:
        print("\n✗ Set SUPABASE_SERVICE_ROLE_KEY as an environment variable first — see the SETUP note at the top of this file.")
        sys.exit(1)

    limit = None
    dry_run = "--dry-run" in sys.argv
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            limit = int(arg.split("=", 1)[1])

    print(f"{'DRY RUN — ' if dry_run else ''}Reading club_logos from Supabase...")
    rows = fetch_rows()
    print(f"  {len(rows)} rows.")
    # Already self-hosted (a previous run, or this row was fine to begin
    # with) — skip outright so a re-run only touches what's still on
    # SoFIFA's CDN, not all 916 rows every time.
    rows = [r for r in rows if r.get("logo_url") and BUCKET not in r["logo_url"]]
    print(f"  {len(rows)} still pointing at SoFIFA.")
    if limit:
        rows = rows[:limit]
        print(f"  (--limit applied: processing {len(rows)})")

    results: dict[str, str] = {}
    if RESULT_FILE.exists():
        try:
            results = json.loads(RESULT_FILE.read_text(encoding="utf-8"))
        except Exception:
            results = {}

    async with async_playwright() as pw:
        context = await pw.chromium.launch_persistent_context(
            str(PROFILE_DIR),
            headless=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
            locale="en-GB",
            timezone_id="Europe/London",
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else await context.new_page()
        if stealth_async:
            await stealth_async(page)

        print("Opening SoFIFA to confirm clearance...")
        await page.goto(BASE_URL, wait_until="commit")
        ok = await wait_for(page, 'a[href*="/player/"]', "players page", timeout=45)
        if not ok:
            title = await page.title()
            print(f"  ! Could not confirm a cleared SoFIFA page (title: {title!r}).")
            print("  This profile's session may have lapsed — it likely needs a visible,")
            print("  interactive run (headless=False) to sign in / solve a challenge once.")
            await context.close()
            sys.exit(1)
        print("  cleared.\n")

        downloaded = uploaded = skipped = 0
        failed: list[str] = []

        for i, row in enumerate(rows, 1):
            club, url = row.get("club"), row.get("logo_url")
            if not club or not url:
                continue
            key = normalize_club_key(club)
            local = OUT_DIR / f"{key}.png"

            if not local.exists():
                status = await download_one(page, club, url)
                if status == "ok":
                    downloaded += 1
                elif status == "skip":
                    skipped += 1
                else:
                    failed.append(f"{club}: {status}")
                    if i % 25 == 0:
                        print(f"  ...{i}/{len(rows)}")
                    continue
                await asyncio.sleep(random.uniform(0.15, 0.35))

            if dry_run:
                uploaded += 1
            elif key not in results:
                try:
                    data = local.read_bytes()
                    url = upload_to_storage(key, data)
                    patch_logo_url(club, url)
                    results[key] = url
                    uploaded += 1
                except Exception as e:
                    failed.append(f"{club}: upload/patch failed — {e}")
            elif True:
                # Already uploaded (results cache has it) but the DB row
                # itself might still point at SoFIFA — happens if a prior
                # run's storage upload succeeded but the process died before
                # the DB patch. Patch it now rather than silently leaving
                # the row broken.
                try:
                    patch_logo_url(club, results[key])
                except Exception as e:
                    failed.append(f"{club}: DB patch failed — {e}")

            if i % 25 == 0:
                print(f"  ...{i}/{len(rows)} ({uploaded} uploaded so far)")
                RESULT_FILE.write_text(json.dumps(results, indent=2, sort_keys=True), encoding="utf-8")

        await context.close()

    RESULT_FILE.write_text(json.dumps(results, indent=2, sort_keys=True), encoding="utf-8")
    print(f"\n{'Would upload' if dry_run else 'Downloaded'}: {downloaded}, uploaded: {uploaded}, already done: {skipped}")
    print(f"Wrote {RESULT_FILE}")
    if dry_run:
        print("\n(Dry run — nothing was uploaded, patched, or changed. Re-run without --dry-run to apply.)")
    else:
        print("Reload the game — club badges should show for real now.")
    if failed:
        print(f"\n{len(failed)} failed:")
        for f in failed[:30]:
            print(f"  - {f}")
        if len(failed) > 30:
            print(f"  ...and {len(failed) - 30} more")


if __name__ == "__main__":
    asyncio.run(main())
