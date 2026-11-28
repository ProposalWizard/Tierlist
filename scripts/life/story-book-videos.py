"""THE STORY BOOK'S VIDEOS: one short film per story, made ONLY from the story's real in-game
screenshots (scripts/life/story-book-shots.mjs). No voice, no generated pictures.

Each film: a title card, then the story as it played on screen (the first answer each time, and for
big stories where the other first answers lead), each screenshot slowly panning (a Ken Burns move)
with the story's own words as a caption under it, then a card for every ending the story has, then
the story in the phone's list. Music: the game's own track "Lobby" (public/star/music, played with
CC0 samples), quiet. 720 x 1560, H.264 CRF 32, 20 frames a second.

Run:  python3 scripts/life/story-book-videos.py <shots folder> <page folder> [--sizes big,medium,small] [--jobs 3] [--only slug,slug]
Writes <page>/video/<slug>.mp4 and <page>/videos.json (slug -> seconds, KB). Needs ffmpeg.
"""
import json, os, re, subprocess, sys, shutil, tempfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC, PAGE = sys.argv[1], sys.argv[2]
def arg(k, d):
    return sys.argv[sys.argv.index("--" + k) + 1] if "--" + k in sys.argv else d
SIZES = set(arg("sizes", "big,medium,unspecified").split(","))
JOBS = int(arg("jobs", "3"))
ONLY = set(filter(None, arg("only", "").split(",")))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = os.path.join(ROOT, "public/star/music/08-lobby.mp3")
W, H, FPS = 720, 1560, 20
SW, SH = 560, 1212           # the screenshot on the frame
CAP_Y = 1262                 # the caption band
FONT = "/usr/share/fonts/opentype/inter/"
F_B = lambda n: ImageFont.truetype(FONT + "Inter-Bold.otf", n)
F_S = lambda n: ImageFont.truetype(FONT + "Inter-SemiBold.otf", n)
F_D = lambda n: ImageFont.truetype(FONT + "InterDisplay-Black.otf", n)
GOLD, WHITE, GREY = (245, 197, 66), (242, 246, 243), (170, 184, 176)
MK = re.compile("[^]*")
def plain(s):
    return re.sub("[-]", "", MK.sub("", s or "")).strip()

data = json.load(open(os.path.join(PAGE, "data.json")))
os.makedirs(os.path.join(PAGE, "video"), exist_ok=True)


def wrap(d, text, font, width, max_lines):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and " ".join(lines) != " ".join(words):
        lines[-1] = lines[-1].rstrip(".,;:") + "…"
    return lines


def background(shot_path):
    im = Image.open(shot_path).convert("RGB").resize((W, H))
    im = im.filter(ImageFilter.GaussianBlur(28))
    return Image.blend(im, Image.new("RGB", (W, H), (4, 7, 6)), 0.62)


def caption_card(bg, kicker, line, sub=""):
    """The still part of a slide: the blurred picture behind, the words in the band at the bottom."""
    im = bg.copy()
    d = ImageDraw.Draw(im)
    d.rectangle((0, CAP_Y - 18, W, H), fill=(6, 10, 8))
    y = CAP_Y
    if kicker:
        d.text((44, y), kicker.upper(), font=F_B(24), fill=GOLD)
        y += 40
    for ln in wrap(d, line, F_S(34), W - 88, 5 if not sub else 4):
        d.text((44, y), ln, font=F_S(34), fill=WHITE)
        y += 46
    if sub:
        for ln in wrap(d, sub, F_S(26), W - 88, 2):
            d.text((44, y + 4), ln, font=F_S(26), fill=GREY)
            y += 36
    return im


def text_card(bg, kicker, title, body, foot=""):
    im = bg.copy()
    d = ImageDraw.Draw(im)
    y = 420
    d.text((60, y), kicker.upper(), font=F_B(28), fill=GOLD)
    y += 60
    for ln in wrap(d, title, F_D(68), W - 120, 4):
        d.text((60, y), ln, font=F_D(68), fill=WHITE)
        y += 80
    y += 30
    for ln in wrap(d, body, F_S(36), W - 120, 10):
        d.text((60, y), ln, font=F_S(36), fill=WHITE)
        y += 50
    if foot:
        y += 30
        for ln in wrap(d, foot, F_S(28), W - 120, 4):
            d.text((60, y), ln, font=F_S(28), fill=GREY)
            y += 40
    return im


QUOTE = re.compile(r"[\"“]([^\"”]{12,260})[\"”]")
def speech(text, skip=()):
    for m in QUOTE.finditer(text or ""):
        q = m.group(1).strip()
        if not any(q in s or s in q for s in skip if s):
            return f"“{q}”"
    return ""


def result_line(text):
    bad = re.compile(r"(will remember that|WHAT HAPPENS NEXT|CONTINUE|bond [+−-]|respect [+−-]|THE STORY ENDS|BEAT \d|ROUND \d|^◆)", re.I)
    lines = [l.strip() for l in (text or "").split("\n") if len(l.strip()) >= 30 and not bad.search(l)]
    return max(lines, key=len) if lines else ""


def build(story, rec, out):
    tmp = tempfile.mkdtemp(prefix="sbv-", dir=os.environ.get("SBV_TMP") or None)
    try:
        raw = os.path.join(SRC, "raw", rec["slug"])
        beats = {b["id"]: b for b in story["beats"]}
        shots = [s for s in rec["shots"]]
        play = [s for s in shots if s["kind"] != "phone"]
        phone = [s for s in shots if s["kind"] == "phone"]
        n_ends = min(6, len(story["ends"]))
        per = max(2.4, min(6.0, (170 - 5 - 4.2 * n_ends - 4) / max(1, len(play))))
        slides = []   # (kind, png, seconds, shot jpg or None)
        first = os.path.join(raw, shots[0]["file"])
        bg0 = background(first)
        meta = f"{story['size']} story · {len(story['beats'])} beats · {len(story['ends'])} endings"
        p = os.path.join(tmp, "s000.png")
        text_card(bg0, "The Story Book · Knowitball", plain(story["title"]), plain(story["premise"]), meta + ". Real screenshots of the game.").save(p)
        slides.append(("card", p, 5.0, None))
        last_chose = ""
        for i, s in enumerate(play):
            b = beats.get(s.get("beat") or "", {})
            label = (f"Beat {b['n']} · " if b.get("n") else "Side beat · ") + plain(b.get("title", "")) if b else ""
            k = s["kind"]
            if k == "open":
                kick, line, sub = label, speech(s.get("text"), [s.get("chose") or ""]) or result_line(s.get("text")), ""
            elif k in ("screen", "invite"):
                kick, line, sub = f"You: {last_chose}" if last_chose else label, speech(s.get("text"), [last_chose, s.get("chose") or ""]) or result_line(s.get("text")), ""
            elif k == "outcome":
                kick, line, sub = "What happens", result_line(s.get("text")), f"You chose: {last_chose}" if last_chose else ""
            elif k == "alt-outcome":
                kick, line, sub = "Or, another answer", result_line(s.get("text")), f"If you say: {s.get('alt')}"
            elif k == "game-setup":
                kick, line, sub = "A game, on the real match engine", f"{label}: the game's set-up", ""
            elif k == "game-play":
                kick, line, sub = "Playing it", "The ball is yours to strike: drag back and let go.", ""
            else:
                kick, line, sub = label, result_line(s.get("text")), ""
            if s.get("chose"):
                last_chose = s["chose"]
            if k in ("open",):
                last_chose = s.get("chose") or ""
            p = os.path.join(tmp, f"s{i + 1:03d}.png")
            caption_card(background(os.path.join(raw, s["file"])), kick, line or label, sub).save(p)
            slides.append(("shot", p, per if k not in ("game-play", "game-setup") else min(per, 4.0), os.path.join(raw, s["file"])))
        for j, e in enumerate(story["ends"][:n_ends]):
            p = os.path.join(tmp, f"e{j:03d}.png")
            how = "; ".join(list(dict.fromkeys(f"{r['where']} {r['how']}" for r in e["reachedBy"]))[:2])
            text_card(bg0, f"Ending {j + 1} of {len(story['ends'])}", plain(e["title"]), plain(e["text"]), ("Reached at " + how) if how else "").save(p)
            slides.append(("card", p, 4.2, None))
        if phone:
            p = os.path.join(tmp, "z.png")
            caption_card(background(os.path.join(raw, phone[0]["file"])), "On your phone", "The story in your phone's Stories list.", "").save(p)
            slides.append(("shot", p, 3.6, os.path.join(raw, phone[0]["file"])))
        # Each slide to a short clip, then joined.
        parts = []
        for k, (kind, png, sec, shot) in enumerate(slides):
            seg = os.path.join(tmp, f"v{k:03d}.mp4")
            nf = int(round(sec * FPS))
            enc = ["-c:v", "libx264", "-preset", "faster", "-crf", "32", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]
            if kind == "card":
                cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", f"{sec:.2f}", "-i", png,
                       "-vf", f"fps={FPS},fade=t=in:st=0:d=0.4", *enc, seg]
            else:
                down = k % 2 == 0
                # A slow Ken Burns pan: the screenshot a little larger than its window, drifting down (or up).
                y = f"(ih-oh)*t/{sec:.2f}" if down else f"(ih-oh)*(1-t/{sec:.2f})"
                x = f"(iw-ow)*(0.5+0.35*sin(t/{sec:.2f}*3.14))" if down else "(iw-ow)/2"
                cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", f"{sec:.2f}", "-i", png, "-loop", "1", "-t", f"{sec:.2f}", "-i", shot,
                       "-filter_complex",
                       f"[1]scale={SW * 108 // 100}:{SH * 108 // 100},fps={FPS},crop={SW}:{SH}:x='{x}':y='{y}'[s];"
                       f"[0]fps={FPS}[b];[b][s]overlay=(W-w)/2:28:shortest=1,fade=t=in:st=0:d=0.3",
                       "-frames:v", str(nf), *enc, seg]
            subprocess.run(cmd, check=True)
            parts.append(seg)
        lst = os.path.join(tmp, "list.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
        silent = os.path.join(tmp, "silent.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent], check=True)
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", silent], capture_output=True, text=True).stdout.strip())
        if os.path.exists(MUSIC):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-stream_loop", "-1", "-i", MUSIC,
                            "-filter_complex", f"[1:a]volume=0.32,afade=t=in:d=1.5,afade=t=out:st={max(0, dur - 2.5):.2f}:d=2.5[a]",
                            "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "40k", "-ac", "1", "-t", f"{dur:.2f}",
                            "-movflags", "+faststart", out], check=True)
        else:
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-c", "copy", "-movflags", "+faststart", out], check=True)
        return round(dur), round(os.path.getsize(out) / 1024)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


todo = []
for s in data["stories"]:
    jf = os.path.join(SRC, "stories", s["slug"] + ".json")
    if not os.path.exists(jf) or (ONLY and s["slug"] not in ONLY) or (not ONLY and s["size"] not in SIZES):
        continue
    rec = json.load(open(jf))
    if not rec["shots"]:
        continue
    todo.append((s, rec))

vj = os.path.join(PAGE, "videos.json")
done = json.load(open(vj)) if os.path.exists(vj) else {}
todo = [t for t in todo if t[0]["slug"] not in done or not os.path.exists(os.path.join(PAGE, "video", t[0]["slug"] + ".mp4"))]
print(f"{len(todo)} videos to make")

def one(t):
    s, rec = t
    out = os.path.join(PAGE, "video", s["slug"] + ".mp4")
    try:
        sec, kb = build(s, rec, out)
        print(f"{s['slug']}: {sec}s, {kb} KB", flush=True)
        return s["slug"], {"file": f"video/{s['slug']}.mp4", "seconds": sec, "kb": kb}
    except Exception as e:
        print(f"{s['slug']}: FAILED {e}", flush=True)
        return s["slug"], None

with ThreadPoolExecutor(JOBS) as ex:
    for slug, v in ex.map(one, todo):
        if v:
            done[slug] = v
            json.dump(done, open(vj, "w"), indent=1)
print(f"{len(done)} videos, {sum(v['kb'] for v in done.values()) / 1024:.1f} MB")
