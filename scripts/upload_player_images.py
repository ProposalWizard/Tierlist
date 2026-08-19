"""
Give the star career game its own copies of the current Premier League
roster's photos, so team sheets stop depending on SoFIFA's CDN — which now
requires a signed-in session to serve an image at all, and blocks a plain
hotlinked request even from a real browser tab.

WHAT THIS DOES
  1. Asks Supabase which players are actually in play right now: every row
     in sofifa_players at fifa_year = STAR_FIFA_YEAR (2027) — the current PL
     roster the star career game's team sheets read from. Roughly 506
     players across 20 clubs (see fc27_clone_premier_league.sql).
  2. For each one, looks for an already-downloaded face image on disk, at
     sofifa_data/faces/2026/{sofifa_id}.png — FC 26 is the source year the
     2027 rows were cloned from, one year older, same sofifa_id.
  3. Uploads whatever it finds to Supabase Storage, in the existing public
     tierlist-images bucket, under player-portraits/{sofifa_id}.png.
  4. Rewrites image_url on the matching fifa_year=2027 row to point at that
     storage URL instead of SoFIFA's CDN.

Deliberately scoped to just the current season's ~506 rows. The Draft
mode's whole historical archive (FIFA 07 through FC 26, tens of thousands
of rows) is untouched — see upload_pl_draft_images.py for that, one
Premier League edition at a time. That is a different, much bigger
dataset with a different fragility story, and self-hosting all of it is not what this
bug needs. Re-run this once a season, whenever the roster is refreshed —
it is not something that needs to run on every deploy.

BEFORE RUNNING THIS
  You need the face images sitting on disk first. If you don't already have
  sofifa_data/faces/2026/, run the existing scraper for just the Premier
  League (this uses your already-authenticated browser profile — the same
  one that gets past SoFIFA's Cloudflare/sign-in wall today):

      python scrape_missing.py --year=2026 --league=13 --download-faces

SETUP
  pip install requests

  Set these as environment variables (the same values the app itself
  uses — see .env.local or the Vercel project settings). Use the SERVICE
  ROLE key, not the anon key: this writes directly and bypasses row-level
  security, so keep it out of anything you commit, paste, or share.

      SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co
      SUPABASE_SERVICE_ROLE_KEY=...

RUN
  python upload_player_images.py             # uploads and patches the DB
  python upload_player_images.py --dry-run   # reports what it would do; changes nothing
"""

import os
import sys
from pathlib import Path

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

STAR_FIFA_YEAR = 2027       # must match STAR_FIFA_YEAR in lib/star/edition.ts
SOURCE_SCRAPE_YEAR = 2026   # the FC 26 data the 2027 rows were cloned from
BUCKET = "tierlist-images"
STORAGE_PREFIX = "player-portraits"

FACES_DIR = Path.home() / "Desktop" / "sofifa_data" / "faces" / str(SOURCE_SCRAPE_YEAR)
if not FACES_DIR.exists():
    # Some Windows setups redirect Desktop into OneDrive — same fallback
    # scrape_missing.py already uses for its own output directory.
    alt = Path.home() / "OneDrive" / "Desktop" / "sofifa_data" / "faces" / str(SOURCE_SCRAPE_YEAR)
    if alt.exists():
        FACES_DIR = alt


def die(msg: str) -> None:
    print(f"\n✗ {msg}")
    sys.exit(1)


def fetch_current_roster() -> list[dict]:
    """Every player currently in play, read straight from the DB — not
    assumed from the FC 26 scrape, in case the clone script's club-name
    matching dropped or added anyone along the way."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/sofifa_players",
        params={
            "select": "sofifa_id,name,club",
            "fifa_year": f"eq.{STAR_FIFA_YEAR}",
        },
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def upload_image(sofifa_id: str, data: bytes) -> str:
    """PUT the file to Storage and return its public URL. x-upsert makes
    this safe to re-run — a second pass overwrites rather than conflicts."""
    path = f"{STORAGE_PREFIX}/{sofifa_id}.png"
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


def patch_image_url(sofifa_id: str, url: str) -> None:
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/sofifa_players",
        params={"sofifa_id": f"eq.{sofifa_id}", "fifa_year": f"eq.{STAR_FIFA_YEAR}"},
        json={"image_url": url},
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        timeout=30,
    )
    resp.raise_for_status()


def main() -> None:
    if not SUPABASE_URL or not SERVICE_KEY:
        die("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables first — see the SETUP note at the top of this file.")
    if not FACES_DIR.exists():
        die(
            f"No local face images found at:\n  {FACES_DIR}\n\n"
            f"Run this first (uses your already-authenticated browser profile):\n"
            f"  python scrape_missing.py --year={SOURCE_SCRAPE_YEAR} --league=13 --download-faces"
        )

    dry_run = "--dry-run" in sys.argv
    print(f"{'DRY RUN — ' if dry_run else ''}Reading the current roster from Supabase (fifa_year={STAR_FIFA_YEAR})...")

    roster = fetch_current_roster()
    print(f"  {len(roster)} players currently in play.\n")

    uploaded = 0
    missing_locally: list[str] = []
    failed: list[str] = []

    for i, player in enumerate(roster, 1):
        sid = str(player["sofifa_id"])
        name = player.get("name") or "?"
        club = player.get("club") or "?"
        local_file = FACES_DIR / f"{sid}.png"

        if not local_file.exists():
            missing_locally.append(f"{name} ({club}) — {sid}")
            continue

        if dry_run:
            uploaded += 1
        else:
            try:
                data = local_file.read_bytes()
                new_url = upload_image(sid, data)
                patch_image_url(sid, new_url)
                uploaded += 1
            except Exception as e:
                failed.append(f"{name} ({club}) — {sid}: {e}")

        if i % 50 == 0:
            print(f"  ...{i}/{len(roster)} processed")

    print(f"\n{'Would upload' if dry_run else 'Uploaded'}: {uploaded}/{len(roster)}")

    if missing_locally:
        print(f"\n⚠ {len(missing_locally)} player(s) with no local file — left pointing at SoFIFA, unchanged:")
        for m in missing_locally[:20]:
            print(f"    - {m}")
        if len(missing_locally) > 20:
            print(f"    ...and {len(missing_locally) - 20} more")
        print(
            f"  If this list looks too long, double check that\n"
            f"    {FACES_DIR}\n"
            f"  actually holds these players' images — re-run the scrape command above if not."
        )

    if failed:
        print(f"\n✗ {len(failed)} upload(s) failed:")
        for f in failed[:20]:
            print(f"    - {f}")

    if dry_run:
        print("\n(Dry run — nothing was uploaded or changed. Re-run without --dry-run to apply.)")
    else:
        print("\nDone. Reload the game — these players should show their own photos on the team sheet now.")


if __name__ == "__main__":
    main()
