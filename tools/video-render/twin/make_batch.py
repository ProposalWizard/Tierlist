# Make a batch of Stat Twins videos from pick_batch.py's list (Mikey, 10 Nov 2026).
#   TWIN_DATA=<dir> python3 make_batch.py scripts PICK.json OUTDIR          -> an episode file + script for each (no voice, free)
#   TWIN_DATA=<dir> python3 make_batch.py videos  PICK.json OUTDIR [jobs=3] -> voice, timings, render, 3 at a time
# Voice: Hugo (ElevenLabs). If ElevenLabs refuses (no credits left), that video and every later one is voiced offline
# with Kokoro (KOKORO_DIR, voice TWIN_FALLBACK_VOICE, default bm_fable), never half and half inside one video.
import json, os, re, sys, subprocess, shutil, threading, unicodedata
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__)); MODE, PICK, OUT = sys.argv[1], sys.argv[2], os.path.abspath(sys.argv[3]); JOBS = int(sys.argv[4]) if len(sys.argv) > 4 else 3
ALL5 = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]
TIER3 = {"Erling Haaland", "Harry Kane", "Kylian Mbappé", "Mohamed Salah", "Lionel Messi", "Cristiano Ronaldo", "Robert Lewandowski", "Karim Benzema", "Neymar", "Kevin De Bruyne",
         "Bukayo Saka", "Cole Palmer", "Vinícius Júnior", "Jude Bellingham", "Lamine Yamal", "Phil Foden", "Bruno Fernandes", "Heung-Min Son", "Declan Rice", "Rodri", "Virgil van Dijk",
         "Trent Alexander-Arnold", "Alisson Becker", "Luka Modrić", "Marcus Rashford", "Ousmane Dembélé", "Alexander Isak", "Florian Wirtz", "Jamal Musiala", "Martin Ødegaard"}
NEVER = {"Diogo Jota"}   # not for a light "You'd think...?" line (he died in July 2025)
def slug(r): return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFD", r['player']).encode("ascii", "ignore").decode().lower()).strip("-") + "-" + r['season'][2:].replace("/", "")
picks = json.load(open(PICK))['picked']; os.makedirs(OUT, exist_ok=True)
def run(cmd, log, env=None):
    with open(log, "a") as f: return subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT, cwd=HERE, env={**os.environ, **(env or {})}).returncode
if MODE == "scripts":
    for n, r in enumerate(picks, 1):
        sl = slug(r); d = os.path.join(OUT, sl); os.makedirs(d, exist_ok=True)
        ep = {"player": r['player'], "season": r['season'], "group": r['group'], "leagues": ["Premier League"] if r['pl'] else ALL5, "top": r.get('top', 7),
              "surprise": [n for n in r['surprise'] if n in TIER3] + [n for n in reversed(r['surprise']) if n not in TIER3 and n not in NEVER],   # the biggest name first, then the furthest away
              "surpriseAnyPlace": True, "surpriseMin": 10, "series": "STAT TWINS", "stories": {}, "spoken": {}}
        if r.get('short'): ep['short'] = r['short']
        if r.get('award'): ep['prefix'] = r['award']; ep['award'] = {"at": r['award'].upper().split()[0], "label": r['award'].upper().replace(" WINNER", "")}
        ep.update(r.get('ep', {}))
        json.dump(ep, open(os.path.join(d, "episode.json"), "w"), indent=1, ensure_ascii=False)
        log = os.path.join(d, "make.log"); open(log, "w").close()
        rc = run([sys.executable, "make_episode.py", os.path.join(d, "episode.json"), d], log)
        txt = open(log).read(); lines = [l for l in txt.split("\n") if l.startswith("  [")]
        print(f"\n=== {n}. {sl}  ({'PL only' if r['pl'] else 'all 5 leagues'}, {r['group']}){'  FAILED' if rc else ''}")
        print("\n".join(lines) if lines else txt[-600:], flush=True)
    sys.exit(0)
# ---- videos
state = {"fallback": os.path.exists(os.path.join(OUT, "FALLBACK"))}; lock = threading.Lock(); KD = os.environ.get("KOKORO_DIR", ""); FV = os.environ.get("TWIN_FALLBACK_VOICE", "bm_fable")
def kokoro(d, log):
    for f in os.listdir(os.path.join(d, "vo")) if os.path.isdir(os.path.join(d, "vo")) else []: os.remove(os.path.join(d, "vo", f))
    json.dump({"provider": "kokoro", "kokoroVoice": FV, "kokoroSpeed": 1.2}, open(os.path.join(d, "voice.json"), "w"))
    return run([sys.executable, "tts.py", d, KD], log)
def one(r):
    sl = slug(r); d = os.path.join(OUT, sl); log = os.path.join(d, "video.log"); mp4 = os.path.join(d, "out.mp4")
    if os.path.exists(os.path.join(d, "DONE")): return sl, "already done"
    open(log, "w").close(); voice = "Hugo"
    with lock: fb = state["fallback"]
    if fb or run([sys.executable, "tts.py", d, "-"], log):
        with lock:
            if not state["fallback"]: state["fallback"] = True; open(os.path.join(OUT, "FALLBACK"), "w").write(sl); print("ElevenLabs refused at", sl, "-> offline voice from here", flush=True)
        if not KD or kokoro(d, log): return sl, "VOICE FAILED"
        voice = "Kokoro " + FV
    if run([sys.executable, "timeline.py", d], log): return sl, "TIMELINE FAILED"
    if run(["node", "render.cjs", d], log, {"TWIN_CRF": os.environ.get("TWIN_CRF", "23")}) or not os.path.exists(mp4): return sl, "RENDER FAILED"
    bad = [l for l in open(log).read().split("\n") if "CUE NOT FOUND" in l or l.startswith("ERR") or "PAGE ERRORS" in l]
    open(os.path.join(d, "DONE"), "w").write(voice); return sl, f"ok ({voice})" + (f" · {len(bad)} warnings: {bad[:2]}" if bad else "")
with ThreadPoolExecutor(JOBS) as ex:
    for sl, res in ex.map(one, picks): print(sl, "->", res, flush=True)
