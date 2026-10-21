"""Download SoccerTrack v2 from its public Google Drive mirror and shrink every
half as it lands (download -> soccertrack_compact.py -> delete the 2.7 GB file),
so the disk never holds more than one half. Safe to re-run: halves already
shrunk are skipped. Google Drive sometimes refuses a big file for a day ("had
many accesses"); re-run later and it carries on.

Usage: python3 -I scripts/realmoments/soccertrack_download.py STV2_DIR
  needs: pip install gdown ijson numpy  (a venv is fine; run its python with -I)
Then: extract_soccertrack.py STV2_DIR and ../opendata/reduce_soccertrack.py STV2_DIR.
"""
import os, subprocess, sys, time

import gdown

STV2 = sys.argv[1]
FOLDER = "https://drive.google.com/drive/folders/1N2Qx2qkFgRtpbHitl2Vh6sLVYGgqkWwn"
COMPACT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "soccertrack_compact.py")


def get(fid, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for _ in range(3):
        try:
            gdown.download(id=fid, output=out, quiet=True)
            if os.path.exists(out):
                return True
        except Exception as e:  # noqa: BLE001  (gdown raises plain exceptions)
            print("retry", os.path.basename(out), str(e).splitlines()[0], flush=True)
            time.sleep(10)
    return False


def main():
    files = [(f.path, f.id) for f in gdown.download_folder(url=FOLDER, skip_download=True, quiet=True)]
    small = [(p, i) for p, i in files if p.startswith(("ball/", "bas/")) or p.endswith(("_player_nodes.csv", "_12_class_events.json"))]
    for p, i in small:
        out = os.path.join(STV2, p)
        if not (os.path.exists(out) and os.path.getsize(out) > 0):
            get(i, out)
    for p, i in sorted((p, i) for p, i in files if p.startswith("gsr/") and p.endswith(".json")):
        m, half = os.path.basename(p)[:-5].split("_")
        if os.path.exists(os.path.join(STV2, "compact", f"{m}_{half}.json.gz")):
            print("have", m, half, flush=True)
            continue
        out = os.path.join(STV2, "gsr", f"{m}_{half}.json")
        if not get(i, out):
            print("FAILED download", p, "(re-run later)", flush=True)
            continue
        r = subprocess.run([sys.executable, "-I", COMPACT, STV2, m, half], capture_output=True, text=True)
        print(r.stdout.strip(), r.stderr.strip()[-300:], flush=True)
        if r.returncode == 0:
            os.remove(out)
    print("done", flush=True)


if __name__ == "__main__":
    main()
