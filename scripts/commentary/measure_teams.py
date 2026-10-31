#!/usr/bin/env python3
"""How different the seven commentators really sound, in numbers (a script
cannot listen). Writes scripts/commentary/teams-voices.json.

    nice -n 10 python3 scripts/commentary/measure_teams.py /home/user/models

Per commentator, over his or her chosen recordings (public/sfx/teams/):
- pitch: median voice pitch (Hz) and how far a goal call rises (semitones);
- pace: words per second;
- words: share of lines where Whisper heard every word (little words aside);
- clean: median DNSMOS;
- who: a speaker fingerprint (Chatterbox's own speaker encoder, the x-vector
  of each file, averaged). `similar` is the cosine between two commentators'
  fingerprints: 1 = the same voice. Below ~0.8 is usually a clearly
  different speaker for this kind of embedding.
"""
import json, os, sys
import numpy as np, librosa

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from chatterbox_engine import Chatterbox, SR  # noqa: E402

WHO = ["anchor", "poet", "deadpan", "wire", "pro", "analyst", "mate"]


def main():
    models = sys.argv[1]
    report = json.load(open(os.path.join(HERE, "teams-takes.json")))
    eng = Chatterbox(os.path.join(models, "chatterbox"), threads=3, lm_dir="onnx_q4")
    out, fp = {}, {}
    for who in WHO:
        rows = {k: v for k, v in report.items() if not k.startswith("_") and v["who"] == who}
        best = [next(t for t in v["takes"] if t["seed"] == v["seed"]) for v in rows.values()]
        calls = [b for (k, v), b in zip(rows.items(), best) if v["kind"] in ("call", "late")]
        vecs = []
        for k in rows:
            x, _ = librosa.load(os.path.join(ROOT, "public", "sfx", "teams", k + ".mp3"), sr=SR)
            xv = eng.enc.run(None, {"audio_values": x[np.newaxis, :].astype(np.float32)})[2]
            vecs.append(np.asarray(xv).reshape(-1))
        v = np.mean(vecs, axis=0); fp[who] = v / np.linalg.norm(v)
        out[who] = {
            "lines": len(rows),
            "pitch_hz": float(np.median([b["f0"] for b in best if b["f0"]])),
            "resting_hz": report["_resting"][who],
            "call_lift": float(np.median([b["lift"] for b in calls])) if calls else None,
            "words_per_s": round(float(np.median([b["rate"] for b in best])), 2),
            "all_words": round(float(np.mean([b["wer"] == 0 for b in best])), 2),
            "mos": round(float(np.median([b["mos"] for b in best])), 2),
            "weak": sorted(k for k, v in rows.items() if v.get("weak")),
        }
        print(who, out[who], flush=True)
    sim = {a: {b: round(float(fp[a] @ fp[b]), 3) for b in WHO} for a in WHO}
    json.dump({"commentators": out, "similar": sim}, open(os.path.join(HERE, "teams-voices.json"), "w"), indent=1)
    for a in WHO:
        print(a.ljust(8), " ".join(f"{sim[a][b]:.2f}" for b in WHO))


if __name__ == "__main__":
    main()
