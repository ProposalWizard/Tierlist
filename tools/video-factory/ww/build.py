"""Who would win? from a match.json (tools/video-factory/ww). The approved Man United v Roma v4 format.
  python3 build.py examples/utd-v-roma-v4.json [--no-vo] [--out FILE.mp4] [--workers 3] [--stills 1.0,20.5,...]
Steps: fill the json's defaults -> voiceover (voice D, best of up to 3 seeds, humanise, faster_whisper word times)
-> timeline (segments stretch to fit the voice) -> frames (template/edit.html in headless Chromium)
-> mix (v4 music and effects, music ducked about 6 dB under the voice) -> 1080x1920 MP4. See README.md."""
import argparse, copy, difflib, json, os, re, shutil, subprocess, sys
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SFX = os.path.join(ROOT, "public/sfx")
MUSIC = os.path.join(ROOT, "public/star/music")
HUMANISE = os.path.join(ROOT, "scripts/marketing/voice/humanise.sh")
QWEN_PY = os.environ.get("QWEN_PY", "/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/tts2/bin/python")
PRONOUNCE = os.path.join(HERE, "..", "pronounce.json")  # the factory's shared dictionary, used when present
SR, FPS = 44100, 30
LAST_LINE = "Follow for more, and play Road to Ballon d'Or."

def log(*a): print(*a, flush=True)

# ---------------------------------------------------------------- defaults
DUR = {"grid": 3.6, "title": 2.5, "homeSheet": 4.1, "atoms": 1.3, "awaySheet": 2.6, "versus": 3.0, "globe": 6.4,
       "ratings": 4.4, "kickoff": 1.2, "late": 1.1, "fulltime": 6.0, "potm": 6.4, "end": 3.4}
ALIAS = {"sheetU": "homeSheet", "sheetB": "awaySheet", "sheetHome": "homeSheet", "sheetAway": "awaySheet", "result": "fulltime", "ballon": "potm", "endcard": "end"}
COUNTRY = {"eng": "ENGLAND", "ita": "ITALY", "esp": "SPAIN", "ger": "GERMANY", "fra": "FRANCE", "ned": "NETHERLANDS", "por": "PORTUGAL", "sco": "SCOTLAND",
           "wal": "WALES", "bel": "BELGIUM", "aut": "AUSTRIA", "irl": "IRELAND", "tur": "TURKEY", "gre": "GREECE", "sui": "SWITZERLAND", "ukr": "UKRAINE",
           "rus": "RUSSIA", "den": "DENMARK", "swe": "SWEDEN", "nor": "NORWAY", "arg": "ARGENTINA", "bra": "BRAZIL", "col": "COLOMBIA"}

def hex2rgb(h): h = h.lstrip("#"); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def rgb2hex(c): return "#" + "".join(f"{max(0, min(255, int(round(v)))):02x}" for v in c)
def scale(h, k): return rgb2hex([v * k for v in hex2rgb(h)])
def mixc(h, other, k): a, b = hex2rgb(h), hex2rgb(other); return rgb2hex([x + (y - x) * k for x, y in zip(a, b)])
def lum(h): r, g, b = [v / 255 for v in hex2rgb(h)]; return 0.2126 * r + 0.7152 * g + 0.0722 * b

def resolve_path(base, p):
    if not p or p.startswith("/") or re.match(r"^[a-z]+:", p): return p
    return os.path.normpath(os.path.join(base, p))

def norm_club(c, side, base):
    c = copy.deepcopy(c)
    if c.get("season") and c["season"] not in c["name"]: c["name"] = f'{c["name"]} {c["season"]}'
    c.setdefault("full", c["name"])
    if c.get("season") and c["season"] not in c["full"]: c["full"] = f'{c["full"]} {c["season"]}'
    if "versus" not in c:
        w = c["name"].split(" ", 1); c["versus"] = [w[0], w[1] if len(w) > 1 else ""]
    k = c["kit"]; k.setdefault("trim", "#ffffff"); k.setdefault("collar", k["trim"])
    k.setdefault("shorts", "#ffffff"); k.setdefault("socks", k["shirt"]); k.setdefault("number", k["trim"])
    k.setdefault("gk", {"shirt": "#2bb673", "trim": "#0b3d2a", "collar": "#0b3d2a"})
    main = k["shirt"]; fg = k["trim"] if abs(lum(k["trim"]) - lum(main)) > 0.3 else ("#111111" if lum(main) > 0.6 else "#ffffff")
    col = c.setdefault("colors", {})
    col.setdefault("ring", main if lum(main) < 0.8 else k["trim"])
    col.setdefault("pillBg", main); col.setdefault("pillFg", fg)
    col.setdefault("headerBg", main); col.setdefault("headerFg", fg)
    col.setdefault("headerSub", "rgba(255,255,255,.85)" if lum(col["headerBg"]) < 0.6 else col["headerFg"])
    col.setdefault("headerStripes", [])
    col.setdefault("versusBg", scale(col["ring"], 0.55))
    col.setdefault("accent", mixc(col["ring"], "#ffffff", 0.35))
    col.setdefault("bar", col["ring"])
    col.setdefault("confetti", [k["trim"], main, col["ring"], "#111111"])
    col.setdefault("ribbon", [main if lum(main) < 0.8 else k["trim"], col["ring"] if col["ring"] != main else k["trim"]])
    initials = "".join(w[0] for w in re.sub(r"[^A-Za-zÀ-ÿ ]", "", c["name"]).split()[:3]).upper() or "FC"
    cr = c.setdefault("crest", {}); cr.setdefault("a", main); cr.setdefault("b", k["trim"]); cr.setdefault("c", scale(main, 0.35))
    cr.setdefault("t", initials); cr.setdefault("tc", k["trim"]); cr.setdefault("ts", 40 if len(cr["t"]) <= 2 else 30)
    country = c.get("country") or COUNTRY.get(c.get("nation", ""), "")
    c.setdefault("formation", "4-2-3-1")
    c.setdefault("sheetLabel", f'{c.get("kitLabel", "HOME KIT" if side == "home" else "AWAY KIT")} · {c["formation"]}')
    c.setdefault("versusInfo", f'{country} · {c["season"] if c.get("season") else c.get("founded", "")}'.strip(" ·"))
    city = c["city"]; city.setdefault("label", city.get("name", "").upper()); city.setdefault("sub", country)
    for key in ("badge", "flagImg"):
        if c.get(key): c[key] = resolve_path(base, c[key])
    assert len(c["grid"]) == 11, f"{side}: grid needs 11 players (keeper last), has {len(c['grid'])}"
    for pid in c["grid"]: assert pid in c["slots"], f"{side}: no slot for {pid}"
    return c

def segment_id(x): return ALIAS.get(x, x)

def normalise(m, base):
    m = copy.deepcopy(m)
    m["home"] = norm_club(m["home"], "home", base); m["away"] = norm_club(m["away"], "away", base)
    H, A = m["home"], m["away"]
    for pid, p in m["players"].items():
        p.setdefault("name", pid.upper()); p.setdefault("full", p["name"].title()); p.setdefault("skin", "light")
        p.setdefault("hair", ["crop", "#1d1512"]); p.setdefault("beard", "none")
        if p.get("photo"): p["photo"] = resolve_path(base, p["photo"])
    for pid in H["grid"] + A["grid"] + [x for x in (H.get("manager"), A.get("manager")) if x]: assert pid in m["players"], f"player {pid} missing from players"
    m.setdefault("title", "WHO WOULD WIN?")
    comp = m.setdefault("competition", {}); comp.setdefault("title", ["", ""]); comp.setdefault("tagline", "22 PLAYERS · 1 WINNER")
    comp.setdefault("versus", comp["title"][0]); comp.setdefault("short", comp["title"][0])
    m.setdefault("atomsLine", "AND THEIR OPPONENTS"); m.setdefault("kickoffText", "KICK OFF!")
    v = m["venue"]; v.setdefault("place", "")
    near = lambda a, b: abs(a[0] - b[0]) < 0.3 and abs(a[1] - b[1]) < 0.3
    hl, al, vl = [H["city"]["lat"], H["city"]["lon"]], [A["city"]["lat"], A["city"]["lon"]], [v["lat"], v["lon"]]
    gl = m.setdefault("globe", {})
    gl.setdefault("neutral", not near(vl, hl) and not near(vl, al))
    pts = [hl, al] + ([vl] if gl["neutral"] else [])
    gl.setdefault("start", [round(sum(p[0] for p in pts) / len(pts), 2), round(sum(p[1] for p in pts) / len(pts), 2)])
    gl.setdefault("homeSide", -1 if hl[1] <= al[1] else 1); gl.setdefault("venueSide", 1)
    v.setdefault("cityLabel", v.get("city", v["name"]).upper()); v.setdefault("citySub", v.get("country", ""))
    rt = m.setdefault("ratings", {}); rt.setdefault("label", "PREVIEW"); rt.setdefault("starLabel", "STAR MAN"); rt.setdefault("rows", [])
    for s in ("home", "away"):
        sm = rt.get("starMen", {}).get(s)
        if sm: sm.setdefault("label", m["players"][sm["id"]]["name"])
    # footage
    m["footageRoot"] = resolve_path(base, m.get("footageRoot", "footage"))
    if m.get("calm"): m["calm"].setdefault("frames", len([f for f in os.listdir(os.path.join(m["footageRoot"], m["calm"]["dir"])) if f[0] != "."]))
    # events: goals and misses in order, with running score
    side_of = lambda pid: "home" if pid in H["grid"] or pid in H.get("extra", []) else "away"
    score = [0, 0]; nev = len(m["events"]); evs = []
    for i, e in enumerate(m["events"]):
        e = dict(e); e.setdefault("id", f"e{i + 1}"); e.setdefault("type", "goal"); e.setdefault("side", side_of(e["scorer"]))
        e["scoreBefore"] = list(score)
        if e["type"] == "goal": score[0 if e["side"] == "home" else 1] += 1
        e["scoreAfter"] = list(score)
        foot = e.get("footage")
        if foot:
            e.setdefault("goalAt", foot.get("goalAt"))
        assert e.get("goalAt") is not None, f'event {e["id"]}: goalAt (seconds into the clip when the ball goes in, or over/wide) is needed'
        nm = m["players"][e["scorer"]]["name"]
        e.setdefault("caption", f"{nm} SCORES!" if e["type"] == "goal" else f"{nm} MISSES!")
        e.setdefault("captionColor", "#ffffff"); e.setdefault("popupWord", "GOAL")
        if e.get("popup") == "drawn": e["popup"] = None
        home_ground = not gl["neutral"] and near(vl, hl)
        crowd_default = "cheer" if (e["side"] == "home" or gl["neutral"] or not home_ground) else "groan"
        if e["type"] == "miss": crowd_default = "groan"
        e.setdefault("crowd", crowd_default)
        if e["type"] == "goal": d = max(3.2, e["goalAt"] + 1.6) if nev <= 5 else max(2.6, e["goalAt"] + 1.3)
        else: d = e["goalAt"] + 1.25
        e.setdefault("dur", round(d, 2))
        evs.append(e)
    m["events"] = evs; m["score"] = score
    ft = m.setdefault("fullTime", {}); ft.setdefault("pill", "FULL TIME"); ft.setdefault("sub", comp["short"])
    ft.setdefault("line", f'{H["name"]} {score[0]} - {score[1]} {A["name"]}')
    pm = m.setdefault("potm", {}); pm.setdefault("title", "PLAYER OF THE MATCH"); top1 = pm["top3"][0]
    pm.setdefault("name", m["players"][top1]["full"].upper())
    win = "home" if score[0] > score[1] else "away" if score[1] > score[0] else side_of(top1)
    ft.setdefault("side", win); grid = m[ft["side"]]["grid"]
    ft.setdefault("front", top1 if top1 in grid else grid[0])
    ft.setdefault("mates", [x for x in grid[:10] if x != ft["front"]][:6])
    pm.setdefault("ribbon", m[side_of(top1)]["colors"]["ribbon"])
    m.setdefault("music", "09-last-attack.mp3")
    return m

# ---------------------------------------------------------------- timeline
def base_segments(m):
    d = {segment_id(k): v for k, v in m.get("durations", {}).items()}
    segs = [{"id": k, "type": k, "dur": d.get(k, DUR[k])} for k in ("grid", "title", "homeSheet", "atoms", "awaySheet", "versus", "globe", "ratings", "kickoff")]
    nlate = 0
    for e in m["events"]:
        if e.get("lateCard"):
            lid = "late" if nlate == 0 else f"late{nlate + 1}"; nlate += 1
            segs.append({"id": lid, "type": "late", "dur": d.get(lid, DUR["late"]), "ev": e})
        segs.append({"id": e["id"], "type": e["type"], "dur": d.get(e["id"], e["dur"]), "ev": e})
    segs += [{"id": k, "type": k, "dur": d.get(k, DUR[k])} for k in ("fulltime", "potm", "end")]
    return segs

def starts(segs):
    t, out = 0.0, {}
    for s in segs: out[s["id"]] = t; t += s["dur"]
    return out, t

# ---------------------------------------------------------------- audio helpers
_cache = {}
def load(p, sr=SR):
    key = (p, sr)
    if key not in _cache:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True).stdout
        _cache[key] = np.frombuffer(raw, dtype=np.float32).copy()
    return _cache[key].copy()

# ---------------------------------------------------------------- voiceover
NUM = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"}
def toks(s): return [w for w in re.sub(r"[^a-z0-9' ]", " ", s.lower().replace("-", " ").replace("’", "'")).split() if w]
def sim(a, b):
    """How well the heard words match the line's text (names skipped: the transcriber spells them its own way)."""
    names = set()
    for w in a.split():  # every capitalised word (a sentence start costs one ordinary word, no more)
        if w[:1].isupper(): names.update(toks(w))
    names |= {"d", "or", "ballon"}
    A = [w for w in toks(a) if not w.isdigit() and w not in NUM and w not in names]; B = [w for w in toks(b) if not w.isdigit() and w not in NUM and w not in names]
    if not A: return 1.0
    # recall of the line's ordinary words: misheard names in the transcript cost nothing, missing or changed words do
    return sum(b.size for b in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks()) / len(A)

_whisper = None
def transcribe(path):
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None: _whisper = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = _whisper.transcribe(load(path, 16000), word_timestamps=True, language="en")
    words = [{"w": w.word.strip(), "t0": w.start, "t1": w.end} for s in segs for w in s.words]
    return " ".join(w["w"] for w in words), words

def align(script, words):
    """The script's words, each timed from the transcriber's words (unmatched ones interpolated)."""
    sw = script.split(); sn = [re.sub(r"[^a-z0-9]", "", w.lower()) for w in sw]
    wn = [re.sub(r"[^a-z0-9]", "", w["w"].lower()) for w in words]
    t0 = [None] * len(sw)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sn, wn, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1): t0[i1 + k] = words[j1 + k]["t0"]
        elif tag == "replace" and j2 > j1:
            for k in range(i2 - i1): t0[i1 + k] = words[j1 + min(j2 - j1 - 1, int(k * (j2 - j1) / (i2 - i1)))]["t0"]
    end = words[-1]["t1"] if words else 1.0
    known = [i for i, v in enumerate(t0) if v is not None]
    if not known: return [{"w": w, "t0": end * i / len(sw)} for i, w in enumerate(sw)]
    for i in range(len(sw)):
        if t0[i] is None:
            prev = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
            a = t0[prev] if prev is not None else 0.0; b = t0[nxt] if nxt is not None else end
            pa = prev if prev is not None else -1; nb = nxt if nxt is not None else len(sw)
            t0[i] = a + (b - a) * (i - pa) / (nb - pa)
    for i in range(1, len(t0)): t0[i] = max(t0[i], t0[i - 1] + 0.05)
    return [{"w": w, "t0": t} for w, t in zip(sw, t0)]

def spoken(line, dic):
    if line.get("say"): return line["say"]
    s = line["text"]
    for k, v in dic.items(): s = re.sub(r"(?<![\w])" + re.escape(k) + r"(?![\w])", v, s)
    return s

def make_voice(m, work):
    lines = [dict(l) for l in m["vo"]]
    bad = [l["text"] for l in lines if re.search(r"link in bio|knowitball\s*(dot|\.)\s*co|\.co\.uk|website", (l.get("say") or l["text"]), re.I)]
    assert not bad, f"the voice never reads the website or 'link in bio': {bad}"
    if lines[-1]["text"].strip() != LAST_LINE:
        lines.append({"seg": "end", "offset": 0.3, "text": LAST_LINE}); log("added the last line:", LAST_LINE)
    dic = json.load(open(PRONOUNCE)) if os.path.exists(PRONOUNCE) else {}
    for key in ("names", "words"):  # {"names": {"Soulé": "Soo-LAY"}} or {"names": {"Soulé": {"say": "Soo-LAY", ...}}}
        if isinstance(dic, dict) and isinstance(dic.get(key), dict): dic = dic[key]
    def say_of(v):
        if isinstance(v, str): return v
        if isinstance(v, dict): return v.get("say") or v.get("respell") or v.get("spoken")
    dic = {k: say_of(v) for k, v in dic.items() if say_of(v)} if isinstance(dic, dict) else {}
    vdir = os.path.join(work, "voice"); os.makedirs(vdir, exist_ok=True)
    best = {}
    for rnd, seed in enumerate([3, 11, 21]):
        todo = [i for i in range(len(lines)) if best.get(i, (0,))[0] < 0.86]
        if not todo: break
        reqs = [[os.path.join(vdir, f"l{i:02d}-s{seed}.wav"), spoken(lines[i], dic), seed] for i in todo]
        json.dump(reqs, open(os.path.join(vdir, "req.json"), "w"))
        subprocess.run([QWEN_PY, "-I", os.path.join(HERE, "voice.py"), os.path.join(vdir, "req.json")], check=True)
        for i in todo:
            p = os.path.join(vdir, f"l{i:02d}-s{seed}.wav"); heard, words = transcribe(p); s = sim(lines[i]["text"], heard)
            if s > best.get(i, (-1,))[0]: best[i] = (s, p, words, heard)
        log(f"voice round {rnd + 1}: " + ", ".join(f"{i}:{best[i][0]:.2f}" for i in sorted(best)))
    out = []
    for i, l in enumerate(lines):
        s, raw, words, heard = best[i]
        fin = os.path.join(vdir, f"l{i:02d}.wav"); subprocess.run([HUMANISE, raw, fin], check=True)
        # trim the room tone after the last word so the next line can follow closely
        x = load(fin); lastw = (words[-1]["t1"] if words else len(x) / SR) + 0.25
        x = x[: int(min(len(x) / SR, lastw) * SR)]; f = int(0.03 * SR); x[-f:] *= np.linspace(1, 0, f)
        sf.write(fin, x, SR)
        hf, hwords = transcribe(fin)
        out.append({**l, "seg": segment_id(l["seg"]), "file": fin, "len": len(x) / SR, "match": round(s, 2), "heard": hf, "words": align(l["text"], hwords)})
    return out

def place_voice(segs, lines, gap=0.25, tail=0.15):
    """Each line starts at its segment + offset (or after the previous line); a segment stretches when its line runs past its end."""
    order = {s["id"]: i for i, s in enumerate(segs)}
    for l in lines: assert l["seg"] in order, f'vo line seg "{l["seg"]}" is not a segment: {list(order)}'
    lines.sort(key=lambda l: (order[l["seg"]], l.get("offset", 0)))
    for _ in range(200):
        t0, _total = starts(segs); prev = -1.0; changed = False
        for l in lines:
            s = segs[order[l["seg"]]]; st = max(t0[s["id"]] + l.get("offset", 0.0), prev + gap); en = st + l["len"]
            if not l.get("spill") and en + tail > t0[s["id"]] + s["dur"] + 1e-6:
                s["dur"] = round(en + tail - t0[s["id"]] + 0.005, 3); s["stretched"] = True; changed = True; break
            l["start"] = round(st, 3); prev = en
        if not changed: return
    raise SystemExit("voice placement did not settle")

def caption_chunks(lines):
    caps = []
    for l in lines:
        at = l["start"]; timed = l["words"]; cur = []
        for j, w in enumerate(timed):
            cur.append({"w": re.sub(r"[\"“”]", "", w["w"]).upper(), "t0": round(at + w["t0"], 3)})
            nxt = timed[j + 1] if j + 1 < len(timed) else None
            if len(cur) >= 3 or re.search(r"[.,?!:;]$", w["w"]) or not nxt:
                t1 = at + (nxt["t0"] if nxt else l["len"] - 0.1)
                caps.append({"t0": round(cur[0]["t0"] - 0.03, 3), "t1": round(t1, 3), "words": cur}); cur = []
    return caps

# ---------------------------------------------------------------- mix (v4's levels)
def mix(m, segs, total, lines, path):
    t0, _ = starts(segs); at = lambda sid, dt=0.0: t0[sid] + dt
    N = int(total * SR) + SR
    music = np.zeros(N); fx = np.zeros(N); voice = np.zeros(N)
    def put(buf, x, t, v=1.0):
        i = int(t * SR); x = x[:max(0, N - i)]; buf[i:i + len(x)] += x * v
    def fade(x, a, b):
        n = len(x); fa, fb = min(n, int(a * SR)), min(n, int(b * SR))
        if fa: x[:fa] *= np.linspace(0, 1, fa)
        if fb: x[n - fb:] *= np.linspace(1, 0, fb)
        return x
    mu = load(os.path.join(MUSIC, m["music"]))
    need = int(at("fulltime", 0.3) * SR)
    if len(mu) < need: mu = np.concatenate([mu] * (need // len(mu) + 1))
    mu = mu[:need]; env = np.ones(len(mu)); env[int(t0["kickoff"] * SR):] = 0.55
    put(music, fade(mu * env, 0.05, 1.2), 0, 0.55 * 0.63)  # v4: music beds about 4 dB quieter than v2
    tr = load(os.path.join(SFX, "cut-music-trophy.mp3"))[:int((total - t0["fulltime"]) * SR)]; put(music, fade(tr, 0.4, 1.5), t0["fulltime"], 0.6 * 0.63)
    crowd = load(os.path.join(SFX, "match-crowd.mp3")); n = int((t0["fulltime"] - t0["kickoff"]) * SR); put(fx, fade(np.resize(crowd, n), 0.5, 1.0), t0["kickoff"], 0.35)
    S = lambda nm: load(os.path.join(SFX, nm + ".mp3"))
    tap, tick = S("ui-tap-arcade"), S("star-tick")
    H, A = m["home"], m["away"]
    for i in range(len(H["grid"])): put(fx, tap, 0.3 + i * 0.1, .18)
    for i in range(len(A["grid"])): put(fx, tap, 0.35 + i * 0.1, .14)
    if H.get("manager"): put(fx, tap, 1.65, .2)
    if A.get("manager"): put(fx, tap, 1.7, .2)
    for i in range(len(A["grid"])): put(fx, tap, at("atoms", i * 0.04), .12)
    ev = [("achievement-pop", at("versus", .25), .4), ("achievement-pop", at("versus", .6), .4), ("kick-hard", at("versus", 1.0), .6),
          ("ui-confirm", at("globe", .6), .4), ("ui-confirm", at("globe", 1.0), .4), ("ui-confirm-arcade", at("globe", 3.5), .5),
          ("crowd-cheer-small", at("ratings", 3.2), .3), ("whistle-start", t0["kickoff"], .7)]
    if m["globe"]["neutral"]: ev.append(("ui-confirm", at("globe", 1.4), .4))
    for s in segs:
        e = s.get("ev")
        if s["type"] == "late":
            for tt in np.arange(t0[s["id"]], t0[s["id"]] + s["dur"], 0.5): put(fx, tick, tt, .35)
        if s["type"] not in ("goal", "miss"): continue
        g = e["goalAt"]
        if e.get("sfx") is not None: lst = e["sfx"]
        elif s["type"] == "goal":
            crowd_nm = "crowd-groan" if e["crowd"] == "groan" else "crowd-cheer-stadium"
            lst = [["kick-soft", max(0.1, g - 0.8), .6], ["kick-hard", max(0.15, g - 0.23), .7], ["goal-net", g, .8], [crowd_nm, g + 0.05, .5], ["ui-confirm", g + 0.02, .4]]
        else:
            shot = e.get("shotAt", g - 0.57)
            lst = [["kick-soft", 0.2, .6], ["kick-hard", shot, .8], ["crowd-groan", shot + 0.15, 1.0], ["crowd-groan", shot + 0.45, .7]]
        for nm, dt, v in lst: ev.append((nm, at(s["id"], dt), v))
    ev += [("whistle-full", t0["fulltime"], .6), ("crowd-cheer-stadium", at("fulltime", 1.6), .7), ("achievement-pop", at("fulltime", 1.6), .5),
           ("star-tick", at("potm", .6), .4), ("star-tick", at("potm", 1.4), .4), ("level-up", at("potm", 2.2), .5), ("achievement-pop", at("potm", 3.5), .6),
           ("crowd-cheer-stadium", at("potm", 3.5), .5), ("ui-confirm", at("end", .2), .4)]
    for nm, tt, v in ev: put(fx, S(nm), tt, v)
    for d in [.45, 1.0, 1.55, 2.3]: put(fx, tick, at("ratings", d), .3)
    if lines:
        for l in lines:
            x = load(l["file"]); x = x / max(1e-6, np.abs(x).max()) * 0.9; put(voice, x, l["start"], m.get("voiceGain", 1.0))
        # duck: about -6 dB on the music under the voice (and -3 dB on the crowd/effects), 0.12 s down, 0.35 s back up
        act = np.zeros(N)
        for l in lines: act[max(0, int((l["start"] - 0.1) * SR)):int((l["start"] + l["len"]) * SR)] = 1.0
        hop = SR // 100; a = act[::hop]; sm = np.zeros_like(a); y = 0.0
        for i, v in enumerate(a):
            y += (v - y) * (0.08 if v > y else 0.03); sm[i] = y
        d = np.interp(np.arange(N), np.arange(len(sm)) * hop, sm)
        music *= 1 - 0.5 * d; fx *= 1 - 0.29 * d
    out = (music + fx + voice)[:int(total * SR)]
    out /= max(1, np.abs(out).max() / 0.95)
    sf.write(path, np.stack([out, out], 1), SR)

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("match"); ap.add_argument("--no-vo", action="store_true"); ap.add_argument("--out")
    ap.add_argument("--workers", type=int, default=3); ap.add_argument("--stills", help="comma-separated seconds: render only these frames to <work>/frames")
    ap.add_argument("--keep-frames", action="store_true"); ap.add_argument("--plan-only", action="store_true", help="write the timeline and stop")
    a = ap.parse_args()
    src = os.path.abspath(a.match); base = os.path.dirname(src); raw = json.load(open(src))
    vid = raw.get("id") or os.path.splitext(os.path.basename(src))[0]
    work = os.path.join(base, "work", vid + ("-novo" if a.no_vo else "")); os.makedirs(work, exist_ok=True)
    m = normalise(raw, base)
    segs = base_segments(m)
    lines = []
    if m.get("vo") and not a.no_vo:
        lines = make_voice(m, work); place_voice(segs, lines)
        for l in lines: log(f'  vo {l["start"]:6.2f}s +{l["len"]:.2f}s [{l["seg"]}] match {l["match"]}: {l["text"]}  (heard: {l["heard"]})')
    t0, total = starts(segs)
    tl = {"segs": [{"id": s["id"], "type": s["type"], "dur": s["dur"], **({"ev": s["ev"]} if "ev" in s else {})} for s in segs],
          "caps": caption_chunks(lines) if lines else [], "total": round(total, 3)}
    json.dump(m, open(os.path.join(work, "match.resolved.json"), "w"), ensure_ascii=False)
    json.dump(tl, open(os.path.join(work, "timeline.json"), "w"), ensure_ascii=False)
    json.dump({"segments": [[s["id"], round(t0[s["id"]], 2), s["dur"], bool(s.get("stretched"))] for s in segs],
               "vo": [{k: l[k] for k in ("seg", "start", "len", "text", "match", "heard")} for l in lines]}, open(os.path.join(work, "plan.json"), "w"), indent=1, ensure_ascii=False)
    log("segments:", " ".join(f'{s["id"]}@{t0[s["id"]]:.2f}' + ("*" if s.get("stretched") else "") for s in segs), f"total {total:.2f}s")
    if a.plan_only: return
    frames = os.path.join(work, "frames"); shutil.rmtree(frames, ignore_errors=True)
    nfr = int(round(total * FPS))
    if a.stills:
        lst = sorted({min(nfr - 1, int(round(float(x) * FPS))) for x in a.stills.split(",")}); lf = os.path.join(work, "stills.json"); json.dump(lst, open(lf, "w"))
        subprocess.run(["node", os.path.join(HERE, "render.mjs"), work, "0", "0", lf], check=True); log("stills in", frames); return
    k = max(1, a.workers); parts = [(i * nfr // k, (i + 1) * nfr // k - 1) for i in range(k)]
    procs = [subprocess.Popen(["node", os.path.join(HERE, "render.mjs"), work, str(s0), str(s1)]) for s0, s1 in parts]
    bad = [p.wait() for p in procs]
    if any(bad): raise SystemExit(f"render failed {bad}")
    wav = os.path.join(work, "mix.wav"); mix(m, segs, total, lines, wav)
    out = os.path.abspath(a.out) if a.out else os.path.join(base, "out", f"{vid}{'' if lines else '-novo'}.mp4"); os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(frames, "f%05d.jpg"), "-i", wav,
                    "-vf", "scale=1080:1920:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out], check=True)
    if not a.keep_frames: shutil.rmtree(frames, ignore_errors=True)
    log("done", out, f"{total:.2f}s")

if __name__ == "__main__":
    main()
