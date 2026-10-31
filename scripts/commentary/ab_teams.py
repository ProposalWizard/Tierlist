#!/usr/bin/env python3
"""The A/B listening page for the commentator teams (Leo, 31 Oct 2026).

    python3 scripts/commentary/ab_teams.py docs/handoffs/2026-10-31-leo/commentators

1. Every team (and today's v2 voice, for comparison) on the same three goals:
   a normal goal, a screamer from distance, a late winner. The plans are
   planAudio's own (ab-team-plans.mts); the mix copies mixAudio in
   lib/star/goalClip/audio.ts: the pink-noise crowd through a 900 Hz band
   with its loudness line, the kicks/net/roar from public/sfx, the pitch
   ducked to 0.55 while someone talks, the commentary box (90 Hz low cut,
   x1.2), a limiter. Mono, 48 kHz, 96 kbps.
2. Each commentator's 5 best lines (best scores in teams-takes.json),
   copied as they are.
Writes audio/*.mp3 and data.json next to index.html (index.html reads data.json
inlined at build time: it is written by this script too).
"""
import json, os, shutil, subprocess, sys
import numpy as np, librosa
from scipy.signal import butter, sosfilt, lfilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from generate_v2 import write_mp3  # noqa: E402

SR = 48000
SFX = os.path.join(ROOT, "public", "sfx")


def load(path):
    x, _ = librosa.load(path, sr=SR, mono=True)
    return x.astype(np.float32)


def crowd_noise(n):
    """audio.ts crowdNoise, channel 0: the same LCG, the same three filters, the same swell."""
    seed, w = 12345, np.empty(SR * 4)
    for i in range(len(w)):
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        w[i] = seed / 0x3fffffff - 1
    b0 = lfilter([0.099046], [1, -0.99765], w)
    b1 = lfilter([0.2965164], [1, -0.963], w)
    b2 = lfilter([1.0526913], [1, -0.57], w)
    t = np.arange(len(w)) / SR
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * 0.5 * t) * np.sin(2 * np.pi * 0.25 * t)
    d = (b0 + b1 + b2 + w * 0.1848) * 0.11 * swell
    f = int(SR * 0.05); k = np.arange(f) / f
    d[:f] *= k; d[-f:] *= k[::-1]
    return np.tile(d, n // len(d) + 1)[:n]


def bandpass900(x):
    return sosfilt(butter(1, [900 / 2.2, 900 * 2.2], "band", fs=SR, output="sos"), x)


def place(mix, x, at, gain, rate=1.0):
    if rate != 1.0:  # playbackRate < 1: slower and deeper
        idx = np.arange(0, len(x) - 1, rate)
        x = np.interp(idx, np.arange(len(x)), x)
    i = int(max(0, at) * SR); j = min(len(mix), i + len(x))
    if j > i:
        mix[i:j] += x[: j - i] * gain


def limiter(x, thr_db=-10, ratio=6, att=0.005, rel=0.2):
    env = np.abs(x); ga, gr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    e = np.empty_like(env); v = 0.0
    for i, s in enumerate(env):
        v = ga * v + (1 - ga) * s if s > v else gr * v + (1 - gr) * s
        e[i] = v
    db = 20 * np.log10(np.maximum(e, 1e-6)); over = np.maximum(0, db - thr_db)
    return x * 10 ** (-(over - over / ratio) / 20)


def mix_plan(plan):
    voice = plan.get("voice", "v1")
    folder = {"teams": "teams", "v2": "v2"}.get(voice, "")
    n = int(plan["duration"] * SR)
    t = np.arange(n) / SR
    bed = plan["bed"]
    lvl = np.interp(t, [b["at"] for b in bed], [b["gain"] for b in bed]) if bed else np.zeros(n)
    pitch = bandpass900(crowd_noise(n)) * lvl
    box = np.zeros(n)
    duck = np.ones(n)
    for c in plan["cues"]:
        s = c["sound"]
        comm = s.startswith("cl-") or s.startswith("cc-")
        x = load(os.path.join(SFX, folder, s + ".mp3") if comm else os.path.join(SFX, s + ".mp3"))
        if comm:
            place(box, x, c["at"], c["gain"])
            duck[int(c["at"] * SR): int((c["at"] + len(x) / SR) * SR)] = 0.55
        else:
            place(pitch, x, c["at"], c["gain"], c["rate"])
    k = int(0.15 * SR)
    duck = np.convolve(duck, np.ones(k) / k, mode="same")
    box = sosfilt(butter(2, 90 if voice != "v1" else 140, "high", fs=SR, output="sos"), box) * 1.2
    y = limiter(pitch * duck + box)
    return (y / max(1.0, np.abs(y).max() / 0.97)).astype(np.float32)


def best_lines(report, who, k=5):
    rows = [(lid, r) for lid, r in report.items() if not lid.startswith("_") and r["who"] == who]
    def score(r):
        b = next(t for t in r["takes"] if t["seed"] == r["seed"])
        return (b["wer"] > 0, b.get("squeal", False), b.get("miss", 0) > 3, -b["mos"])
    rows.sort(key=lambda kv: score(kv[1]))
    return [lid for lid, _ in rows[:k]]


def main():
    out = sys.argv[1]
    aud = os.path.join(out, "audio"); os.makedirs(aud, exist_ok=True)
    plans = json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/ab-team-plans.mts"], cwd=ROOT))
    lines = {l["id"]: l for l in json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-team-lines.mts"], cwd=ROOT))}
    report = json.load(open(os.path.join(HERE, "teams-takes.json")))
    data = {"goals": {}, "best": {}}
    for key, plan in plans.items():
        name = key.replace("/", "-")
        write_mp3_rate(os.path.join(aud, f"goal-{name}.mp3"), mix_plan(plan))
        said = [c["sound"] for c in plan["cues"] if c["sound"][:3] in ("cl-", "cc-")]
        data["goals"][key] = {"file": f"audio/goal-{name}.mp3", "lines": said, "finish": plan["finish"]}
        print(key, flush=True)
    for who in ("anchor", "poet", "deadpan", "wire", "pro", "analyst", "mate"):
        ids = best_lines(report, who)
        for lid in ids:
            shutil.copy(os.path.join(SFX, "teams", lid + ".mp3"), os.path.join(aud, lid + ".mp3"))
        data["best"][who] = [{"id": lid, "text": lines[lid]["text"], "file": f"audio/{lid}.mp3"} for lid in ids]
    texts = {**{l: lines[l]["text"] for l in lines}}
    v2 = {l["id"]: l["text"] for l in json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-lines.mts"], cwd=ROOT))}
    data["text"] = {**v2, **texts}
    vp = os.path.join(HERE, "teams-voices.json")
    data["voices"] = json.load(open(vp)) if os.path.exists(vp) else None
    data["weak"] = {k: {"why": v["weak"], "text": texts.get(k, ""), "heard": next(t for t in v["takes"] if t["seed"] == v["seed"])["heard"]}
                    for k, v in report.items() if not k.startswith("_") and v.get("weak")}
    open(os.path.join(out, "index.html"), "w").write(page(data))


TEAMS = [("matchday", "Matchday", "The Anchor", "The Old Pro", "anchor", "pro"),
         ("bignight", "Big Night", "The Poet", "The Analyst", "poet", "analyst"),
         ("lateshow", "Late Show", "The Deadpan", "The Old Pro", "deadpan", "pro"),
         ("fantv", "Fan TV", "The Live Wire", "The Mate", "wire", "mate")]
NAMES = {"anchor": "The Anchor", "poet": "The Poet", "deadpan": "The Deadpan", "wire": "The Live Wire",
         "pro": "The Old Pro", "analyst": "The Analyst", "mate": "The Mate"}
SOUNDS = {"anchor": "deep older British man, measured", "poet": "British woman, slower, lyrical",
          "deadpan": "British woman, level and dry", "wire": "younger British man, fast and loud",
          "pro": "slow calm British man, ex-player", "analyst": "crisp British woman, tactics",
          "mate": "relaxed American-accented man, jokey"}
GOALS = [("screamer", "Screamer from distance"), ("late", "Late winner (90')"), ("normal", "Normal goal (opener)")]


def page(d):
    import html
    e = html.escape
    def said(ids):
        return "".join(f"<li>{e(d['text'].get(i, i))}</li>" for i in ids)
    rows = []
    for g, gname in GOALS:
        cells = []
        for tid, tname, lead, co, _, _ in TEAMS + [("v2", "Today (v2 voice)", "one lead", "one co", "", "")]:
            x = d["goals"][f"{tid}/{g}"]
            cells.append(f"<div class='cell'><div class='who'>{e(tname)}</div><audio controls preload='none' src='{x['file']}'></audio>"
                         f"<ol>{said(x['lines'])}</ol></div>")
        rows.append(f"<section><h2>{e(gname)}</h2><div class='grid'>{''.join(cells)}</div></section>")
    best = []
    for who, lines in d["best"].items():
        items = "".join(f"<li><audio controls preload='none' src='{l['file']}'></audio><span>{e(l['text'])}</span></li>" for l in lines)
        best.append(f"<div class='voice'><h3>{e(NAMES[who])}</h3><p class='muted'>{e(SOUNDS[who])}</p><ul>{items}</ul></div>")
    meas = ""
    if d.get("voices"):
        c, s = d["voices"]["commentators"], d["voices"]["similar"]
        whos = list(c)
        lift = {w: ("" if c[w]["call_lift"] is None else f"{c[w]['call_lift']:+.1f}") for w in whos}
        trs = "".join(f"<tr><th>{e(NAMES[w])}</th><td>{c[w]['pitch_hz']:.0f}</td><td>{lift[w]}</td>"
                      f"<td>{c[w]['words_per_s']}</td><td>{round(100 * c[w]['all_words'])}%</td><td>{c[w]['mos']}</td><td>{len(c[w]['weak'])}</td></tr>" for w in whos)
        sim = "".join(f"<tr><th>{e(NAMES[a])}</th>" + "".join(f"<td class='{'hi' if a != b and s[a][b] > 0.8 else ''}'>{s[a][b]:.2f}</td>" for b in whos) + "</tr>" for a in whos)
        meas = (f"<section><h2>What the measurements say</h2><div class='scroll'><table><tr><th></th><th>Pitch (Hz)</th><th>Goal-call rise (semitones)</th><th>Words / s</th><th>Every word heard</th><th>Clean (DNSMOS, 1-5)</th><th>Weak lines</th></tr>{trs}</table></div>"
                f"<p class='muted'>How alike two voices are (speaker fingerprint, 1.00 = the same voice; above 0.80 is marked).</p>"
                f"<div class='scroll'><table><tr><th></th>{''.join(f'<th>{e(NAMES[w])}</th>' for w in whos)}</tr>{sim}</table></div></section>")
    weak = "".join(f"<li><code>{e(k)}</code> {e(v['text'])} <span class='muted'>({', '.join(v['why'])}; heard: “{e(v['heard'])}”)</span></li>" for k, v in sorted(d["weak"].items()))
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Commentator Teams A/B</title>
<style>
:root {{ --bg:#f6f7f4; --fg:#1b2420; --muted:#5d6a63; --line:#d5dbd6; --card:#ffffff; --accent:#1f7a4d; --warn:#9a5b00; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#111714; --fg:#e4ebe6; --muted:#9aa9a0; --line:#2b3530; --card:#18201c; --accent:#5fd39a; --warn:#f0b35a; color-scheme: dark; }} }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; margin:0; padding:24px max(16px, env(safe-area-inset-left)); }}
main {{ max-width:1100px; margin:0 auto; display:grid; gap:28px; }}
h1 {{ font-size:28px; margin:0; }} h2 {{ font-size:19px; margin:0 0 10px; }} h3 {{ margin:0; font-size:16px; }}
.muted {{ color:var(--muted); }} .first {{ border-left:4px solid var(--accent); padding:10px 14px; background:var(--card); }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }}
.cell, .voice {{ background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px; min-width:0; }}
.who {{ font-weight:600; margin-bottom:6px; }} audio {{ width:100%; height:36px; }}
ol, ul {{ margin:6px 0 0; padding-left:18px; font-size:13px; color:var(--muted); }}
.voices {{ display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; }}
.voice ul {{ list-style:none; padding:0; display:grid; gap:6px; }} .voice li span {{ color:var(--fg); }}
.scroll {{ overflow-x:auto; }} table {{ border-collapse:collapse; font-variant-numeric:tabular-nums; font-size:13px; }}
th, td {{ border-bottom:1px solid var(--line); padding:4px 8px; text-align:right; }} th:first-child {{ text-align:left; }}
td.hi {{ color:var(--warn); font-weight:700; }} code {{ font-size:12px; }}
</style></head><body><main>
<header><h1>Commentator teams: A/B</h1><p class="muted">Leo, 31 Oct 2026. Four commentary teams, each with its own voices and its own lines, behind Settings → Updates → Leo's update → “Different commentators”. Every clip below is the game's real sound plan for that goal, mixed the way the goal video mixes it (crowd, kick, net, roar, the call, the replay).</p></header>
<div class="first"><b>Listen to this first:</b> the <b>Screamer from distance</b> row, left to right (Matchday, Big Night, Late Show, Fan TV, then today's voice). It shows the four styles best in one go. Then the <b>Late winner</b> row: the biggest calls, where a squeal would show. Headphones help.</div>
<div class="first"><b>The truth:</b> these were made and checked by a script that cannot hear. Each line was generated up to 3 times; Whisper had to hear the words, a pitch cap rejected squeals, and DNSMOS scored cleanness. The numbers are below. Whether the voices sound human is for your ears.</div>
{''.join(rows)}
<section><h2>Each voice: its 5 best lines</h2><div class="voices">{''.join(best)}</div></section>
{meas}
<section><h2>Lines the checks still doubt</h2><ul>{weak or '<li>None.</li>'}</ul></section>
</main></body></html>"""


def write_mp3_rate(path, x):
    import av
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=SR); s.bit_rate = 96000; s.layout = "mono"
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 4096):
        fr = av.AudioFrame.from_ndarray(pcm[i:i + 4096].reshape(1, -1), format="s16", layout="mono"); fr.sample_rate = SR; fr.pts = i
        for p in s.encode(fr):
            o.mux(p)
    for p in s.encode(None):
        o.mux(p)
    o.close()


if __name__ == "__main__":
    main()
