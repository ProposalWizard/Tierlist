#!/usr/bin/env python3
"""Records the NEW commentary voice ("v2") for every line in
lib/star/goalClip/commentary.ts. Read scripts/commentary/README.md first.

    python3 scripts/commentary/generate_v2.py /home/user/models [--takes 5] [--seed0 1] [ids...]

Every take is kept (dry) in <models>/work/v2/takes/, so remaking a line with
new seeds (--seed0 6) picks from the old takes AND the new ones.

Writes public/sfx/v2/<id>.mp3 (mono, 24 kHz, 64 kbps) and
lib/star/goalClip/commentaryDurationsV2.ts, plus scripts/commentary/v2-takes.json
(what each take scored). The old files in public/sfx/ are never touched.

How a line is made:
 1. Chatterbox (MIT) speaks the line, conditioned on an ORIGINAL voice: a
    reference read by Kokoro's own bundled voices (Apache-2.0), no real
    person. Emotion per kind of line ("exaggeration"): goal calls high, late
    calls higher, score lines middle, the co-commentator calm.
 2. Several takes per line (different seeds). Each is heard back by a speech
    recogniser and scored (quality.py); the take with every word right and
    the best predicted naturalness wins.
 3. broadcast.py gives it the commentary-box sound (low cut, presence,
    compression, a little room, "hot mic" on the big calls).
"""
import json, os, subprocess, sys, time
import numpy as np, av, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from chatterbox_engine import Chatterbox, SR  # noqa: E402
from broadcast import broadcast  # noqa: E402
from quality import Quality  # noqa: E402

# Reference voices: made by make_refs() from Kokoro's bundled voices.
LEAD_REF = "lead"
CO_REF = "co"

# How each kind of line is delivered.
#   exaggeration: Chatterbox's emotion control (0.25 flat .. 2 wild)
#   temp: sampling temperature; heat: how hot the mic is (broadcast.py)
#   lift: how far the voice should RISE above his calm speaking pitch, in
#         semitones (min, max). A TV goal call climbs about an octave; past
#         ~20 it turns into a squeal. The take nearest the window wins.
STYLE = {
    "call":  {"exaggeration": 1.1,  "temp": 0.8,  "heat": 0.75, "lift": (10, 17)},
    "late":  {"exaggeration": 1.3,  "temp": 0.8,  "heat": 0.9,  "lift": (13, 20)},
    "score": {"exaggeration": 0.8,  "temp": 0.8,  "heat": 0.5,  "lift": (5, 12)},
    "co":    {"exaggeration": 0.45, "temp": 0.75, "heat": 0.15, "lift": (-2, 4)},
}

# How a commentator would SAY it (the game's text stays as written in
# commentary.ts). Held words, breaths and pauses come from the punctuation.
SPOKEN = {
    "cl-g1": "And it's in! What a finish!",
    "cl-g3": "Back of the net!",
    "cl-g8": "Bang! Into the net!",
    "cl-lr1": "Oh, from all of thirty yards! Unbelievable!",
    "cl-lr4": "Oh, that is a rocket! Top corner!",
    "cl-ta1": "From that angle? Oh, that's ridiculous!",
    "cl-cb2": "The cut-back... the finish... the goal!",
    "cl-late-1": "Late, late... he's won it!",
    "cl-s-op2": "First blood!",
    "cc-g7": "I'd have scored that. In my dreams, anyway.",
}


def kind_of(line_id):
    if line_id.startswith("cc-"):
        return "co"
    if line_id.startswith("cl-late-"):
        return "late"
    if line_id.startswith("cl-s-"):
        return "score"
    return "call"


REF_TEXT = {
    # Read calmly: the reference sets WHO is speaking; the emotion comes from
    # exaggeration. Both are Kokoro's own voices, blended, so the result is
    # nobody real.
    "lead": ("Good evening, and welcome to a full house here tonight. Both sides need the points, "
             "and you can feel it in the stands. They get us under way, and it's a lively start."),
    "co": ("Well, I think the shape has been really good. They've pressed high, they've won it back quickly, "
           "and if they keep doing that, the chances will come."),
}
REF_VOICE = {"lead": [("bm_lewis", 1.0)], "co": [("bm_daniel", 1.0)]}
# A calm line each voice reads first: his resting pitch, which "lift" is measured from.
CALM = "Look at the technique there. Really, really good."


def make_refs(models, out):
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(models, "misc", "kokoro-v1.0.onnx"), os.path.join(models, "misc", "voices-v1.0.bin"))
    os.makedirs(out, exist_ok=True)
    for name, mix in REF_VOICE.items():
        path = os.path.join(out, name + ".wav")
        if os.path.exists(path):
            continue
        style = sum(k.get_voice_style(v) * w for v, w in mix)
        x, sr = k.create(REF_TEXT[name], voice=style, speed=1.0, lang="en-gb")
        sf.write(path, x, sr)


def trim(x, sr):
    a = np.abs(x)
    idx = np.where(a > 0.03 * a.max())[0]
    if len(idx) == 0:
        return x
    y = x[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.15 * sr)].copy()
    f = int(0.01 * sr)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y


def write_mp3(path, x, sr):
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=sr); s.bit_rate = 64000; s.layout = "mono"
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 4096):
        fr = av.AudioFrame.from_ndarray(pcm[i:i + 4096].reshape(1, -1), format="s16", layout="mono"); fr.sample_rate = sr; fr.pts = i
        for p in s.encode(fr):
            o.mux(p)
    for p in s.encode(None):
        o.mux(p)
    o.close()


def lift_of(score, base):
    return 12 * np.log2(max(score["f0"], 1) / max(base, 1))


def miss(lift, window):
    lo, hi = window
    return max(0.0, lo - lift, lift - hi)


def pick(takes, base, window):
    """Words right, the right amount of excitement, natural. One word heard wrong
    (often the recogniser, on a shout) costs about as much as being 3 semitones
    outside the window: a squeal is worse than a slightly odd word."""
    def key(t):
        s = t["score"]
        slow = max(0.0, s["dur"] / max(1, len(t["text"].split())) - 0.6)  # long gaps / mumbling
        return 8 * s["wer"] + 0.4 * miss(lift_of(s, base), window) - (s["mos"] + 0.3 * s["sig"]) + 2 * slow
    return min(takes, key=key)


def main():
    args = sys.argv[1:]
    models = args.pop(0)
    takes_n, seed0 = 5, 1
    if "--takes" in args:
        i = args.index("--takes"); takes_n = int(args[i + 1]); del args[i:i + 2]
    if "--seed0" in args:
        i = args.index("--seed0"); seed0 = int(args[i + 1]); del args[i:i + 2]
    only = set(args)
    lines = json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-lines.mts"], cwd=ROOT))
    work = os.path.join(models, "work", "v2")
    make_refs(models, os.path.join(work, "refs"))
    eng = Chatterbox(os.path.join(models, "chatterbox"), lm_dir="onnx_q4")
    q = Quality(models)
    voices = {n: eng.voice(os.path.join(work, "refs", n + ".wav")) for n in ("lead", "co")}
    base = {n: q.score(eng.say(CALM, voices[n], exaggeration=0.45, seed=1), SR, CALM)["f0"] for n in voices}
    print("resting pitch", base, flush=True)
    take_dir = os.path.join(work, "takes")
    os.makedirs(take_dir, exist_ok=True)
    out_dir = os.path.join(ROOT, "public", "sfx", "v2")
    os.makedirs(out_dir, exist_ok=True)
    report_path = os.path.join(HERE, "v2-takes.json")
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    for ln in lines:
        lid = ln["id"]
        if only and lid not in only:
            continue
        if not only and lid in report and os.path.exists(os.path.join(out_dir, lid + ".mp3")):
            continue  # already made (run again with ids to remake one)
        kind = kind_of(lid)
        st = STYLE[kind]
        text = SPOKEN.get(lid, ln["text"])
        takes = []
        t0 = time.time()
        who = "co" if kind == "co" else "lead"
        for old in (report.get(lid, {}).get("takes", []) if only else []):
            f = os.path.join(take_dir, f"{lid}-{old['seed']}.wav")
            if os.path.exists(f) and old["seed"] < seed0:
                sc = {k: v for k, v in old.items() if k != "seed"}
                takes.append({"seed": old["seed"], "text": text, "wav": sf.read(f, dtype="float32")[0], "score": sc})
        for seed in range(seed0, seed0 + takes_n):
            w = eng.say(text, voices[who], exaggeration=st["exaggeration"], temperature=st["temp"], seed=seed)
            w = trim(w, SR)
            sc = q.score(w, SR, text)
            sc["lift"] = round(lift_of(sc, base[who]), 1)
            sf.write(os.path.join(take_dir, f"{lid}-{seed}.wav"), w, SR)
            takes.append({"seed": seed, "text": text, "wav": w, "score": sc})
            if sc["wer"] == 0 and miss(sc["lift"], st["lift"]) == 0 and sc["mos"] >= 3.4:
                break  # every word right, excited enough, clean: keep it
        best = pick(takes, base[who], st["lift"])
        y = broadcast(best["wav"], SR, st["heat"])
        write_mp3(os.path.join(out_dir, lid + ".mp3"), y, SR)
        report[lid] = {"spoken": text, "kind": kind, **st, "seed": best["seed"], "resting_f0": base[who], "dur": round(len(y) / SR, 2),
                       "takes": [{k: v for k, v in t["score"].items()} | {"seed": t["seed"]} for t in takes]}
        json.dump(report, open(report_path, "w"), indent=1, default=float)
        print(lid, kind, f"{time.time() - t0:.0f}s", best["score"], flush=True)

    durs = {k: v["dur"] for k, v in report.items() if os.path.exists(os.path.join(out_dir, k + ".mp3"))}
    with open(os.path.join(ROOT, "lib/star/goalClip/commentaryDurationsV2.ts"), "w") as f:
        f.write("// Made by scripts/commentary/generate_v2.py. Seconds each NEW-voice commentary line lasts\n")
        f.write("// (public/sfx/v2/<id>.mp3). Read through commentaryVoice.ts.\n")
        f.write("export const COMMENTARY_SECONDS_V2: Record<string, number> = {\n")
        for kk in sorted(durs):
            f.write(f'  "{kk}": {durs[kk]},\n')
        f.write("};\n")


if __name__ == "__main__":
    main()
