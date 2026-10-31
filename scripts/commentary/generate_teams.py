#!/usr/bin/env python3
"""Records the COMMENTATOR TEAMS ("Different commentators", Leo, 31 Oct 2026)
for every line in lib/star/goalClip/commentators.ts. Read README.md first.

    nice -n 10 python3 scripts/commentary/generate_teams.py /home/user/models [--takes 4] [ids...]
    python3 scripts/commentary/generate_teams.py /home/user/models --who poet     # one commentator

Writes public/sfx/teams/<id>.mp3 (mono, 24 kHz, 64 kbps),
lib/star/goalClip/commentaryDurationsTeams.ts and
scripts/commentary/teams-takes.json (every take's scores). Takes are kept
in <models>/work/teams/takes/ (16-bit wav) so a remake picks from old ones too.

Same engine as the v2 voice (generate_v2.py): Chatterbox (MIT) on the CPU,
conditioned on a reference read by one of Kokoro's bundled synthetic voices
(Apache-2.0). Nobody real: no recording of a person, no prompt naming one.

Each take is heard back and scored (quality.py):
 1. WORDS: Whisper must hear every word. A take with a wrong word is only
    used when no take of that line got every word (then it is flagged).
 2. SQUEAL CAP: the pitch of the loudest 5 % of the voiced moments (p95)
    may not rise more than CAP semitones above the commentator's calm
    voice. Over it, the take is rejected (it would squeal).
 3. EXCITEMENT: the median pitch should rise into the commentator's window
    (the Live Wire a lot, the Deadpan hardly at all).
 4. CLEAN: DNSMOS (predicted listener score) breaks ties.
"""
import json, os, subprocess, sys, time
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from chatterbox_engine import Chatterbox, SR  # noqa: E402
from broadcast import broadcast  # noqa: E402
from quality import Quality  # noqa: E402
from generate_v2 import trim, write_mp3  # noqa: E402

# Who each commentator is: one of Kokoro's bundled voices (Apache-2.0) reads
# the reference at this speed (sets his or her pace), then Chatterbox speaks
# in that voice.
VOICES = {
    "anchor":  {"kokoro": "bm_george",   "speed": 0.92, "lang": "en-gb"},
    "poet":    {"kokoro": "bf_emma",     "speed": 0.88, "lang": "en-gb"},
    "deadpan": {"kokoro": "bf_isabella", "speed": 0.95, "lang": "en-gb"},
    "wire":    {"kokoro": "bm_fable",    "speed": 1.15, "lang": "en-gb"},
    "pro":     {"kokoro": "bm_daniel",   "speed": 0.88, "lang": "en-gb"},
    "analyst": {"kokoro": "bf_lily",     "speed": 1.05, "lang": "en-gb"},
    "mate":    {"kokoro": "am_puck",     "speed": 1.0,  "lang": "en-us"},
}
REF_TEXT = ("Good evening, and welcome to a full house here tonight. Both sides need the points, "
            "and you can feel it in the stands. They get us under way, and it's a lively start.")
CALM = "Look at the technique there. Really, really good."

# Delivery per commentator and kind of line.
#   ex: Chatterbox's emotion control; temp: sampling temperature;
#   heat: hot-mic amount (broadcast.py); lift: the median pitch rise wanted,
#   semitones above the calm voice (min, max).
S = lambda ex, lift, heat, temp=0.8: {"exaggeration": ex, "temp": temp, "heat": heat, "lift": lift}
STYLE = {
    "anchor":  {"call": S(1.05, (7, 14), 0.6), "score": S(0.7, (3, 9), 0.4), "late": S(1.2, (9, 16), 0.75)},
    "poet":    {"call": S(0.9, (5, 12), 0.5, 0.75), "score": S(0.55, (2, 8), 0.35, 0.75), "late": S(1.0, (8, 14), 0.65, 0.75)},
    "deadpan": {"call": S(0.4, (-2, 5), 0.2, 0.7), "score": S(0.35, (-2, 4), 0.15, 0.7), "late": S(0.5, (-1, 6), 0.25, 0.7)},
    "wire":    {"call": S(1.1, (10, 17), 0.9), "score": S(0.95, (8, 15), 0.8), "late": S(1.2, (11, 18), 1.0)},
    "pro":     {"co": S(0.4, (-2, 4), 0.15, 0.75)},
    "analyst": {"co": S(0.5, (-2, 5), 0.15, 0.75)},
    "mate":    {"co": S(0.6, (-1, 6), 0.2, 0.8)},
}
# The squeal cap: p95 pitch never more than this far above the calm voice.
CAP = 20.0

# How a line is SAID when that differs from the text (the game keeps the text).
SPOKEN = {
    "cl-wire-lr1": "From there?! Are you kidding me?!",
    "cl-wire-g4": "Are you serious?! What a finish!",
}


def kind_of(line_id, who):
    if line_id.startswith("cc-"):
        return "co"
    if "-late" in line_id:
        return "late"
    if "-s-" in line_id:
        return "score"
    return "call"


def make_refs(models, out):
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(models, "misc", "kokoro-v1.0.onnx"), os.path.join(models, "misc", "voices-v1.0.bin"))
    os.makedirs(out, exist_ok=True)
    for name, v in VOICES.items():
        path = os.path.join(out, name + ".wav")
        if not os.path.exists(path):
            x, sr = k.create(REF_TEXT, voice=v["kokoro"], speed=v["speed"], lang=v["lang"])
            sf.write(path, x, sr)


import re  # noqa: E402
from quality import wer as strict_wer  # noqa: E402

# Little words a recogniser drops or swaps on a shout ("he's scored" heard as
# "he scored", "and" at the start lost). They don't change what is said, so
# the word check ignores them; every other word must be heard.
_SMALL = {"is", "are", "has", "have", "a", "the", "and", "oh", "s", "re", "ve", "ll", "d", "that"}


# Same word, other spelling (the recogniser writes American English) or a
# word that sounds exactly the same.
_ALIAS = {"practice": "practise", "sores": "soars", "defense": "defence", "equalizer": "equaliser",
          "his": "he", "at": "had"}


def loose(s):
    s = re.sub(r"'(s|re|ve|ll|d)\b", " ", s.lower().replace("’", "'"))
    s = " ".join(_ALIAS.get(w, w) for w in s.split())
    return " ".join(w for w in re.sub(r"[^a-z0-9 ]+", " ", s).split() if w not in _SMALL)


def word_miss(text, heard):
    return round(strict_wer(loose(text), loose(heard)), 3) if loose(text) else 0.0


def semis(f, base):
    return 12 * np.log2(max(f, 1) / max(base, 1))


def judge(sc, base, window, text):
    """Adds the word check, lift (median rise), peak (p95 rise) and squeal to a take's scores.
    `wer_strict` is every word; `wer` (used to choose) ignores the little words (loose())."""
    sc["wer_strict"] = sc["wer"]
    sc["wer"] = word_miss(text, sc["heard"])
    sc["lift"] = round(semis(sc["f0"], base), 1) if sc["f0"] else -99.0
    sc["peak"] = round(semis(sc.get("p95", 0), base), 1) if sc.get("p95") else -99.0
    sc["squeal"] = bool(sc["peak"] > CAP)
    lo, hi = window
    sc["miss"] = round(max(0.0, lo - sc["lift"], sc["lift"] - hi), 1) if sc["f0"] else 10.0
    return sc


def cost(t):
    s = t["score"]
    slow = max(0.0, s["dur"] / max(1, len(t["text"].split())) - 0.65)
    return 8 * s["wer"] + 0.4 * s["miss"] + (6 if s["squeal"] else 0) - (s["mos"] + 0.3 * s["sig"]) + 2 * slow


def pick(takes):
    """Words first (every word right, if any take managed it), no squeal, then the rest."""
    right = [t for t in takes if t["score"]["wer"] == 0]
    pool = right or takes
    calm = [t for t in pool if not t["score"]["squeal"]]
    return min(calm or pool, key=cost)


def weak_of(bs):
    return [w for w, bad in (("words", bs["wer"] > 0), ("squeal", bs["squeal"]), ("lift", bs["miss"] > 3),
                             ("noisy", bs["mos"] < 3.0)) if bad]


def rejudge(models):
    """--rejudge: score every kept take's words again with today's loose()
    (no new takes), choose again, and rewrite the mp3s whose choice changed."""
    report_path = os.path.join(HERE, "teams-takes.json")
    report = json.load(open(report_path))
    lines = {l["id"]: l for l in json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-team-lines.mts"], cwd=ROOT))}
    take_dir = os.path.join(models, "work", "teams", "takes")
    for lid, r in report.items():
        if lid.startswith("_"):
            continue
        if lid not in lines:
            continue
        takes = []
        for t in r["takes"]:
            t["wer"] = word_miss(r["spoken"], t["heard"])
            takes.append({"seed": t["seed"], "text": r["spoken"], "score": t})
        best = pick(takes)
        if best["seed"] != r["seed"]:
            w = sf.read(os.path.join(take_dir, f"{lid}-{best['seed']}.wav"), dtype="float32")[0]
            y = broadcast(w, SR, r["heat"])
            write_mp3(os.path.join(ROOT, "public", "sfx", "teams", lid + ".mp3"), y, SR)
            r["seed"], r["dur"] = best["seed"], round(len(y) / SR, 2)
            print("re-chose", lid, best["seed"], flush=True)
        r["weak"] = weak_of(best["score"])
    json.dump(report, open(report_path, "w"), indent=1, default=float)
    write_durations(report)


def write_durations(report):
    out_dir = os.path.join(ROOT, "public", "sfx", "teams")
    files = set(os.listdir(out_dir))
    durs = {k: v["dur"] for k, v in report.items() if not k.startswith("_") and k + ".mp3" in files}
    with open(os.path.join(ROOT, "lib/star/goalClip/commentaryDurationsTeams.ts"), "w") as f:
        f.write("// Made by scripts/commentary/generate_teams.py. Seconds each commentator-team line lasts\n")
        f.write("// (public/sfx/teams/<id>.mp3). Read through commentaryVoice.ts.\n")
        f.write("export const COMMENTARY_SECONDS_TEAMS: Record<string, number> = {\n")
        for kk in sorted(durs):
            f.write(f'  "{kk}": {durs[kk]},\n')
        f.write("};\n")


def main():
    args = sys.argv[1:]
    models = args.pop(0)
    if "--rejudge" in args:
        return rejudge(models)
    takes_n = 3
    who_only = None
    if "--takes" in args:
        i = args.index("--takes"); takes_n = int(args[i + 1]); del args[i:i + 2]
    calmer = "--calmer" in args
    if calmer:
        args.remove("--calmer")
    if "--who" in args:
        i = args.index("--who"); who_only = args[i + 1]; del args[i:i + 2]
    only = set(args)
    lines = json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-team-lines.mts"], cwd=ROOT))
    # Round robin (one line of each commentator in turn), so a run stopped
    # early leaves every commentator with lines, not some with none.
    by = {}
    for ln in lines:
        by.setdefault(ln["who"], []).append(ln)
    lines = [ln for i in range(max(len(v) for v in by.values())) for v in by.values() if i < len(v) for ln in [v[i]]]
    work = os.path.join(models, "work", "teams")
    make_refs(models, os.path.join(work, "refs"))
    eng = Chatterbox(os.path.join(models, "chatterbox"), threads=3, lm_dir="onnx_q4")
    q = Quality(models)
    take_dir = os.path.join(work, "takes"); os.makedirs(take_dir, exist_ok=True)
    out_dir = os.path.join(ROOT, "public", "sfx", "teams"); os.makedirs(out_dir, exist_ok=True)
    report_path = os.path.join(HERE, "teams-takes.json")
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    voices, base = {}, report.get("_resting", {})

    def voice(who):
        if who not in voices:
            voices[who] = eng.voice(os.path.join(work, "refs", who + ".wav"))
            if who not in base:
                base[who] = q.score(eng.say(CALM, voices[who], exaggeration=0.45, seed=1), SR, CALM, fmax=900)["f0"]
                report["_resting"] = base
                print("resting pitch", who, base[who], flush=True)
        return voices[who]

    t_all = time.time()
    for ln in lines:
        lid, who = ln["id"], ln["who"]
        if only and lid not in only:
            continue
        if who_only and who != who_only:
            continue
        if not only and lid in report and os.path.exists(os.path.join(out_dir, lid + ".mp3")):
            continue
        kind = kind_of(lid, who)
        st = dict(STYLE[who][kind])
        if calmer:  # a remake of a line that squealed: a little less emotion
            st["exaggeration"] = round(st["exaggeration"] * 0.85, 2)
        text = SPOKEN.get(lid, ln["text"])
        v = voice(who)
        t0 = time.time()
        takes = []
        seed0 = 1
        for old in (report.get(lid, {}).get("takes", []) if only else []):
            f = os.path.join(take_dir, f"{lid}-{old['seed']}.wav")
            if os.path.exists(f):
                takes.append({"seed": old["seed"], "text": text, "wav": sf.read(f, dtype="float32")[0],
                              "score": {k: v2 for k, v2 in old.items() if k != "seed"}})
                seed0 = max(seed0, old["seed"] + 1)
        n = takes_n if kind != "co" else max(2, takes_n - 1)
        for seed in range(seed0, seed0 + n):
            w = trim(eng.say(text, v, exaggeration=st["exaggeration"], temperature=st["temp"], seed=seed), SR)
            sc = judge(q.score(w, SR, text, fmax=900), base[who], st["lift"], text)
            sf.write(os.path.join(take_dir, f"{lid}-{seed}.wav"), w, SR, subtype="PCM_16")
            takes.append({"seed": seed, "text": text, "wav": w, "score": sc})
            if sc["wer"] == 0 and sc["miss"] <= 3 and not sc["squeal"] and sc["mos"] >= 3.2:
                break  # every word right, near the right lift, no squeal, clean enough: keep it
        best = pick(takes)
        y = broadcast(best["wav"], SR, st["heat"])
        write_mp3(os.path.join(out_dir, lid + ".mp3"), y, SR)
        bs = best["score"]
        weak = weak_of(bs)
        report[lid] = {"who": who, "kind": kind, "spoken": text, **st, "seed": best["seed"], "resting_f0": base[who],
                       "dur": round(len(y) / SR, 2), "weak": weak,
                       "takes": [{k: v2 for k, v2 in t["score"].items()} | {"seed": t["seed"]} for t in takes]}
        json.dump(report, open(report_path, "w"), indent=1, default=float)
        print(lid, kind, f"{time.time() - t0:.0f}s", len(takes), "takes", weak or "ok",
              {k: bs[k] for k in ("wer", "heard", "mos", "lift", "peak")}, f"[{(time.time() - t_all) / 60:.0f} min]", flush=True)

    write_durations(report)


if __name__ == "__main__":
    main()
