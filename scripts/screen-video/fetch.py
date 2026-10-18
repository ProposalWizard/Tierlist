#!/usr/bin/env python3
"""
Download a screen recording from a share link into .recordings/<name>/.

    python3 scripts/screen-video/fetch.py <link> [--name bug-checkout-0928]

Works with:
  - Google Drive   https://drive.google.com/file/d/<ID>/view?...   (and open?id= / uc?id=)
  - Dropbox        https://www.dropbox.com/...?dl=0                 (rewritten to dl=1)
  - a bare Drive file id (what a Google Drive connector's search returns)
  - any direct https link to a video file
  - Loom, TikTok, YouTube, Vimeo, Instagram, X share pages (through yt-dlp,
    which reads the page and finds the video)

The file has to be shared as "Anyone with the link". If it isn't, Drive hands
back a sign-in page instead of the video, and this says so rather than saving
a web page called video.mp4.

Uses curl, because curl already works with most proxies and sandboxes.
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


# Share pages that hold a video rather than being one. yt-dlp knows how to read them.
PAGE_HOSTS = ("loom.com", "tiktok.com", "youtube.com", "youtu.be", "vimeo.com", "instagram.com", "x.com", "twitter.com",
              "twitch.tv", "facebook.com", "fb.watch", "reddit.com")


def is_page_link(link: str) -> bool:
    host = re.sub(r"^https?://", "", link).split("/")[0].lower()
    return any(host == h or host.endswith("." + h) for h in PAGE_HOSTS)


def is_youtube(link: str) -> bool:
    host = re.sub(r"^https?://", "", link).split("/")[0].lower()
    return any(host == h or host.endswith("." + h) for h in ("youtube.com", "youtu.be"))


def youtube_cookie_file() -> tuple[str, bool] | None:
    """YouTube login cookies from the environment, as a private temp file for
    yt-dlp, or None. Keep them as environment secrets, so a
    cloud session can download YouTube too:
      YT_COOKIES_B64   the cookies.txt text, base64-encoded (the main name)
      YT_COOKIES       the cookies.txt text (Netscape format), or it base64-encoded
      YT_COOKIES_FILE  a path to that file
    The value is never printed or written into the repo; the temp file is 0600
    and deleted after the download. Returns (path, is_temp): the caller deletes a
    temp file, never a file the user pointed at."""
    path = os.environ.get("YT_COOKIES_FILE", "").strip()
    if path and os.path.isfile(path):
        return path, False
    raw = (os.environ.get("YT_COOKIES_B64", "") or os.environ.get("YT_COOKIES", "")).strip()
    if not raw:
        return None
    text = raw
    if "\t" not in raw and not raw.startswith("#"):
        try:
            import base64
            # `base64 cookies.txt` wraps at 76 characters: strip ALL whitespace first.
            text = base64.b64decode(re.sub(r"\s+", "", raw), validate=True).decode("utf-8")
        except Exception:
            text = raw
    import tempfile
    fd, tmp = tempfile.mkstemp(prefix="yt-cookies-", suffix=".txt")
    with os.fdopen(fd, "w") as f:
        f.write(text if text.endswith("\n") else text + "\n")
    os.chmod(tmp, 0o600)
    return tmp, True


def fetch_page(link: str, dest: str) -> int:
    """Download a share-page video to dest. Returns 0 on success.

    YouTube only offers the picture and the sound as separate files, so they are
    joined with the ffmpeg bundled in the `imageio-ffmpeg` package (no system
    install). YouTube also needs a JavaScript runtime (`deno`, installed by
    setup.sh) to read its page. Without the bundled ffmpeg, fall back to a file
    that already has both.
    """
    cmd = [sys.executable, "-m", "yt_dlp", "--no-playlist", "--no-progress", "-o", dest, "--force-overwrites"]
    try:
        import imageio_ffmpeg
        cmd += ["--ffmpeg-location", imageio_ffmpeg.get_ffmpeg_exe(),
                # At most 1080p: the breakdown doesn't need more.
                "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
                "--merge-output-format", "mp4"]
    except ImportError:
        cmd += ["-f", "best[ext=mp4]/best"]
    found = youtube_cookie_file() if is_youtube(link) else None
    cookies = found[0] if found else None
    temp_cookies = cookies if found and found[1] else None
    if cookies:
        cmd += ["--cookies", cookies]
        print("  using the YouTube login from the environment")
    try:
        r = subprocess.run(cmd + [link], capture_output=True, text=True)
    finally:
        if temp_cookies:
            try:
                os.remove(temp_cookies)
            except OSError:
                pass
    err = (r.stderr or "") + (r.stdout or "")
    if r.returncode != 0:
        if "No module named yt_dlp" in err:
            print("yt-dlp is missing. Run: bash scripts/screen-video/setup.sh", file=sys.stderr)
        elif "not a bot" in err or "Sign in to confirm" in err or (is_youtube(link) and "HTTP Error 403" in err):
            print("YouTube refused this machine (it blocks cloud servers: 'sign in to confirm "
                  "you're not a bot' / 403). " + ("The YouTube login from the environment was sent and still refused: "
                  "the cookies may have expired (re-export them). " if cookies else "No YouTube login (YT_COOKIES_B64) "
                  "is set in this environment. ") + "Or run this on your own computer, or drop the video "
                  "in a Drive folder shared by link.", file=sys.stderr)
        elif "Private video" in err or "login" in err.lower():
            print("That video needs a login (private or age-restricted). Use a public video, or download it yourself.",
                  file=sys.stderr)
        else:
            print(err.strip()[-800:], file=sys.stderr)
    return r.returncode


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("link")
    ap.add_argument("--name", default=f"recording-{date.today().isoformat()}")
    a = ap.parse_args()
    # The name becomes a folder under .recordings/: one plain word, never a path.
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,80}", a.name) or ".." in a.name:
        sys.exit("--name must be one plain word (letters, numbers, . _ -), e.g. checkout-bug.")

    out_dir = os.path.join(ROOT, ".recordings", a.name)
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, "video.mp4")
    print(f"Downloading to {dest}")
    if is_page_link(a.link):
        if fetch_page(a.link, dest) != 0 or not os.path.exists(dest):
            sys.exit("Download failed. Is the video public (or shared by link)? For Loom: Share -> anyone with the link.")
    else:
        r = subprocess.run(["curl", "-L", "--fail", "--retry", "3", "-o", dest, direct_url(a.link)])
        if r.returncode != 0:
            sys.exit("Download failed. Is the link shared as 'Anyone with the link'?")

    with open(dest, "rb") as f:
        head = f.read(512)
    if b"<html" in head.lower() or b"<!doctype" in head.lower():
        os.remove(dest)
        sys.exit("Got a web page, not a video: the file is not shared publicly. "
                 "In Drive: Share -> General access -> Anyone with the link.")
    size = os.path.getsize(dest) / 1e6
    print(f"OK, {size:.0f} MB. Next: python3 scripts/screen-video/breakdown.py {os.path.relpath(dest, ROOT)}")


if __name__ == "__main__":
    main()
