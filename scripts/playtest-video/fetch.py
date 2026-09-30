#!/usr/bin/env python3
"""
Download a playtest recording from a share link into .playtests/<name>/.

    python3 scripts/playtest-video/fetch.py <link> [--name harry-0927]

Works with:
  - Google Drive   https://drive.google.com/file/d/<ID>/view?...   (and open?id= / uc?id=)
  - Dropbox        https://www.dropbox.com/...?dl=0                 (rewritten to dl=1)
  - a bare Drive file id (what the Drive connector's search returns)
  - any direct https link to an .mp4
  - YouTube, TikTok, Instagram, X and ~1,000 other sites, via yt-dlp
    (installed by setup.sh). YouTube refuses cloud servers ("sign in to
    confirm you're not a bot"): run it from Claude Code on your own computer
    (the desktop app or the terminal, in a LOCAL session), or download the
    video yourself and use the Drive/Dropbox route.

The file has to be shared as "Anyone with the link". If it isn't, Drive hands
back a sign-in page instead of the video, and this says so rather than saving
a web page called video.mp4.

A link to a .zip made by Breakdown-on-Mac.command is unpacked instead: it is
already a finished breakdown.

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


VIDEO_SITES = re.compile(r"(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|x\.com|twitter\.com|vimeo\.com|twitch\.tv|facebook\.com|fb\.watch|reddit\.com)", re.I)


def fetch_with_ytdlp(link: str, dest: str) -> None:
    """A page on a video site, not a file: let yt-dlp find the video.
    At most 1080p (breakdown.py doesn't need more). YouTube serves picture and
    sound as separate streams, so they are joined with the ffmpeg that the
    imageio-ffmpeg package bundles (no system install needed)."""
    cmd = [sys.executable, "-m", "yt_dlp", "--no-playlist", "--force-overwrites",
           "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
           "--merge-output-format", "mp4", "-o", dest, link]
    try:
        import imageio_ffmpeg
        cmd[3:3] = ["--ffmpeg-location", imageio_ffmpeg.get_ffmpeg_exe()]
    except ImportError:
        pass
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0 or not os.path.exists(dest):
        if "No module named yt_dlp" in out:
            sys.exit("yt-dlp is missing. Run setup.sh first.")
        if "not a bot" in out or "Sign in to confirm" in out or ("youtu" in link and "403" in out):
            sys.exit("YouTube refused this computer (it blocks cloud servers). Run this from Claude Code on "
                     "your own computer (a LOCAL session in the desktop app or terminal), or download the "
                     "video yourself and share it via Drive/Dropbox.")
        if "Private video" in out or "login" in out.lower():
            sys.exit("That video needs a login (private or age-restricted). Use a public video, or download it yourself.")
        sys.exit("Couldn't get the video:\n" + out.strip()[-600:])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("link")
    ap.add_argument("--name", default=f"playtest-{date.today().isoformat()}")
    a = ap.parse_args()

    out_dir = os.path.join(ROOT, ".playtests", a.name)
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, "video.mp4")
    print(f"Downloading to {dest}")
    if VIDEO_SITES.search(a.link):
        fetch_with_ytdlp(a.link, dest)
    else:
        url = direct_url(a.link)
        r = subprocess.run(["curl", "-L", "--fail", "--retry", "3", "-o", dest, url])
        if r.returncode != 0:
            sys.exit("Download failed. Is the link shared as 'Anyone with the link'?")

    with open(dest, "rb") as f:
        head = f.read(512)
    if b"<html" in head.lower() or b"<!doctype" in head.lower():
        os.remove(dest)
        sys.exit("Got a web page, not a video: the file is not shared publicly. "
                 "In Drive: Share -> General access -> Anyone with the link.")
    if head[:4] == b"PK\x03\x04":
        # A finished breakdown made on the Mac (Breakdown-on-Mac.command): a zip
        # of index.md, sheets, frames and the transcript. Unpack it; there is
        # nothing left to break down.
        import zipfile
        with zipfile.ZipFile(dest) as z:
            z.extractall(out_dir)
        os.remove(dest)
        print(f"Unpacked the Mac breakdown into {os.path.relpath(out_dir, ROOT)}/ . Read index.md there.")
        return
    size = os.path.getsize(dest) / 1e6
    print(f"OK, {size:.0f} MB. Next: python3 scripts/playtest-video/breakdown.py {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    main()
