"""
Give Draft mode (PL Draft / American Draft / Draft Challenge) self-hosted
photos for one Premier League season at a time, instead of the SoFIFA CDN
URLs that scrape_missing.py wrote down — SoFIFA now requires a signed-in
session to serve an image at all, and blocks a plain hotlinked request even
from a real browser tab, so every card in Draft mode without a self-hosted
photo shows a silhouette.

This is the same fix upload_player_images.py already did for the star career
game's current 506-player roster (fifa_year=2027) — but Draft mode picks its
club/season pairs from the WHOLE archive (every English Premier League season
back to FIFA 07, ~20 editions), not just the current one. That script is
deliberately scoped to just 2027; this one does the rest, ONE EDITION AT A
TIME, because each edition needs its own scrape-then-upload pass:

    python scrape_missing.py --year=2019 --league=13 --download-faces
    python upload_pl_draft_images.py --year=2019

"Premier League" here means the same thing PL Draft's own club list means —
see app/api/draft/clubs/route.ts. SoFIFA calls it "Premier League",
"English Premier League" or "Barclays Premier League" depending on the
edition, and gives Russia's and Ukraine's top divisions the exact same name
("Premier League") — so the club-name denylist below is copied from that
route rather than re-derived, to keep the two definitions from drifting apart.

SETUP
  pip install requests

  Set these as environment variables (the same values the app itself
  uses — see .env.local or the Vercel project settings). Use the SERVICE
  ROLE key, not the anon key: this writes directly and bypasses row-level
  security, so keep it out of anything you commit, paste, or share.

      SUPABASE_URL=https://cagkgfketucousksgtbk.supabase.co
      SUPABASE_SERVICE_ROLE_KEY=...

RUN
  python upload_pl_draft_images.py --year=2019             # uploads and patches the DB
  python upload_pl_draft_images.py --year=2019 --dry-run   # reports what it would do; changes nothing
"""

import os
import sys
from pathlib import Path

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

BUCKET = "tierlist-images"
STORAGE_PREFIX = "player-portraits"
PAGE_SIZE = 1000

# Same three name patterns app/api/draft/clubs/route.ts matches on.
PL_LEAGUE_PATTERNS = ["Premier League", "English Premier League", "Barclays Premier League"]

# Same denylist as PL_FILTER's non-English catch in app/api/draft/clubs/route.ts —
# Russian and Ukrainian top divisions share SoFIFA's "Premier League" name.
NON_ENGLISH_PL_CLUBS = {
    c.lower()
    for c in [
        "Dynamo Kyiv", "Shakhtar Donetsk",
        "Akhmat Grozny", "Alaniya", "Arsenal Tula", "FC Amkar Perm",
        "FC Anzhi Makhachkala", "FC Dynamo Moscow", "FC Khimki", "FC Krasnodar",
        "FC Kuban Krasnodar", "FC Lokomotiv", "FC Moscow", "FC Orenburg",
        "FC Rostov", "FC Tom Tomsk", "FC Tosno", "FC Ufa", "FC Ural Yekaterinburg",
        "FC Volga Nizhny Novgorod", "Mordovia Saransk", "PFC CSKA",
        "PFC Krylia Sovetov Samara", "Rubin Kazan", "SKA Khabarovsk",
        "Saturn Ramenskoye", "Spartak Moscow", "Spartak Nalchik", "Torpedo Moscow",
        "FC Sibir Novosibirsk",
        "Zenit",
    ]
}


def die(msg: str) -> None:
    print(f"\n✗ {msg}")
    sys.exit(1)


def parse_year() -> int:
    year_arg = next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--year=")), None)
    if not year_arg:
        die("Pass the edition to fix, e.g. --year=2019 (must match the --year you scraped with).")
    try:
        return int(year_arg)
    except ValueError:
        die(f"--year must be a number, got: {year_arg!r}")


def faces_dir(year: int) -> Path:
    d = Path.home() / "Desktop" / "sofifa_data" / "faces" / str(year)
    if not d.exists():
        alt = Path.home() / "OneDrive" / "Desktop" / "sofifa_data" / "faces" / str(year)
        if alt.exists():
            return alt
    return d


def is_english_pl_club(club: str) -> bool:
    return club.strip().lower() not in NON_ENGLISH_PL_CLUBS


def fetch_pl_roster(year: int) -> list[dict]:
    """Every Premier League player in this one edition, read straight from the
    DB — paginated, since a single season can be a few hundred rows and
    PostgREST caps a response without saying so."""
    or_filter = ",".join(f"league.ilike.{p}%" for p in PL_LEAGUE_PATTERNS)
    roster: list[dict] = []
    offset = 0
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/sofifa_players",
            params={
                "select": "sofifa_id,name,club",
                "fifa_year": f"eq.{year}",
                "or": f"({or_filter})",
                "order": "id.asc",
                "offset": str(offset),
                "limit": str(PAGE_SIZE),
            },
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        page = resp.json()
        roster.extend(p for p in page if is_english_pl_club(p.get("club") or ""))
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return roster


def upload_image(sofifa_id: str, year: int, data: bytes) -> str:
    """PUT the file to Storage and return its public URL. x-upsert makes
    this safe to re-run — a second pass for the SAME edition overwrites
    rather than conflicts. The filename carries the edition on purpose: the
    same real player can have a genuinely different photo in 2007 than in
    2020, so every (sofifa_id, fifa_year) version gets its own file rather
    than sharing one that whichever edition uploads last would silently
    overwrite for every other edition."""
    path = f"{STORAGE_PREFIX}/{sofifa_id}-{year}.png"
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


def patch_image_url(sofifa_id: str, year: int, url: str) -> None:
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/sofifa_players",
        params={"sofifa_id": f"eq.{sofifa_id}", "fifa_year": f"eq.{year}"},
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

    year = parse_year()
    dir_ = faces_dir(year)
    if not dir_.exists():
        die(
            f"No local face images found at:\n  {dir_}\n\n"
            f"Run this first (uses your already-authenticated browser profile):\n"
            f"  python scrape_missing.py --year={year} --league=13 --download-faces"
        )

    dry_run = "--dry-run" in sys.argv
    print(f"{'DRY RUN — ' if dry_run else ''}Reading {year} Premier League players from Supabase...")

    roster = fetch_pl_roster(year)
    print(f"  {len(roster)} players found for {year}.\n")
    if not roster:
        die(f"No Premier League rows at fifa_year={year} — check the year, or that scrape_missing.py imported this edition.")

    uploaded = 0
    missing_locally: list[str] = []
    missing_ids: list[str] = []
    failed: list[str] = []

    for i, player in enumerate(roster, 1):
        sid = str(player["sofifa_id"])
        name = player.get("name") or "?"
        club = player.get("club") or "?"
        local_file = dir_ / f"{sid}.png"

        if not local_file.exists():
            missing_locally.append(f"{name} ({club}) — {sid}")
            missing_ids.append(sid)
            continue

        if dry_run:
            uploaded += 1
        else:
            try:
                data = local_file.read_bytes()
                new_url = upload_image(sid, year, data)
                patch_image_url(sid, year, new_url)
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
        # Same cause as in upload_player_images.py: the scrape sweeps whoever
        # SoFIFA lists in the Premier League NOW, so anyone who left the
        # league mid-edition is in our data but not in that sweep. Fetch those
        # by id instead.
        id_file = dir_.parent / f"missing_ids_{year}.txt"
        try:
            id_file.write_text("\n".join(missing_ids))
            print(f"\n  Wrote the {len(missing_ids)} missing id(s) to:\n    {id_file}")
            print(f"  Fetch just those faces, then re-run this script:")
            print(f"    python scrape_missing.py --year={year} --faces-for-ids=\"{id_file}\"")
        except Exception as e:
            print(f"  (Could not write the missing-id list: {e})")

    if failed:
        print(f"\n✗ {len(failed)} upload(s) failed:")
        for f in failed[:20]:
            print(f"    - {f}")

    if dry_run:
        print("\n(Dry run — nothing was uploaded or changed. Re-run without --dry-run to apply.)")
    else:
        print(f"\nDone with {year}. Move on to the next edition:")
        print(f"  python scrape_missing.py --year=<NEXT_YEAR> --league=13 --download-faces")
        print(f"  python upload_pl_draft_images.py --year=<NEXT_YEAR>")


if __name__ == "__main__":
    main()
