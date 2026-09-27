#!/usr/bin/env python3
"""
Download a playtest recording from a share link into .playtests/<name>/.

    python3 scripts/playtest-video/fetch.py <link> [--name harry-0927]

Works with:
  - Google Drive   https://drive.google.com/file/d/<ID>/view?...   (and open?id= / uc?id=)
  - Dropbox        https://www.dropbox.com/...?dl=0                 (rewritten to dl=1)
  - a bare Drive file id (what the Drive connector's search returns)
  - any direct https link to an .mp4

The file has to be shared as "Anyone with the link". If it isn't, Drive hands
back a sign-in page instead of the video, and this says so rather than saving
a web page called video.mp4.

Uses curl, because curl is already set up for this container's network proxy.
"""
import argparse
import os
import re
import subprocess
import sys
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def direct_url(link: str) -> str:
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)", link)
    if m:
        return f"https://drive.usercontent.google.com/download?id={m.group(1)}&export=download&confirm=t"
    if re.fullmatch(r"[\w-]{25,}", link):  # a bare Drive file id
        return f"https://drive.usercontent.google.com/download?id={link}&export=download&confirm=t"
    if "dropbox.com" in link:
        link = re.sub(r"([?&])dl=0", r"\1dl=1", link)
        return link if "dl=1" in link else link + ("&" if "?" in link else "?") + "dl=1"
    return link


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("link")
    ap.add_argument("--name", default=f"playtest-{date.today().isoformat()}")
    a = ap.parse_args()

    out_dir = os.path.join(ROOT, ".playtests", a.name)
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, "video.mp4")
    url = direct_url(a.link)
    print(f"Downloading to {dest}")
    r = subprocess.run(["curl", "-L", "--fail", "--retry", "3", "-o", dest, url])
    if r.returncode != 0:
        sys.exit("Download failed. Is the link shared as 'Anyone with the link'?")

    with open(dest, "rb") as f:
        head = f.read(512)
    if b"<html" in head.lower() or b"<!doctype" in head.lower():
        os.remove(dest)
        sys.exit("Got a web page, not a video: the file is not shared publicly. "
                 "In Drive: Share -> General access -> Anyone with the link.")
    size = os.path.getsize(dest) / 1e6
    print(f"OK, {size:.0f} MB. Next: python3 scripts/playtest-video/breakdown.py {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    main()
