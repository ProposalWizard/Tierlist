#!/usr/bin/env python3
"""
The whole recording on one page: report.html + report-files/.

    python3 scripts/screen-video/report.py .recordings/<name>/

breakdown.py calls this at the end of every run, so it is usually already there.
Each stretch of the video is one row: its sheet of pictures beside everything
said during it, every line stamped [mm:ss]. It is the proof the breakdown read
the whole video, and it publishes as an artifact as it is:

    Artifact publish  file_path = .recordings/<name>/report.html
                      files     = {"report-files/sheet_001.jpg": ".recordings/<name>/report-files/sheet_001.jpg", ...}
                      (every file under report-files/, stills/ included; with stills,
                      also capabilities = {"downloads": true} so Save works)

With --stills (breakdown.py), a Frames section follows the stretches: every kept
picture on its own, stamped with its time. Tapping one opens it big with
Copy image (to paste into an AI image tool) and Save.

Styled with its own tokens (Fraunces / Hanken Grotesk / JetBrains Mono,
amber on warm charcoal in dark, red on warm paper in light). Restyle CSS freely.
"""
import html
import json
import os
import shutil
import sys


def ts(sec: float) -> str:
    sec = max(0, sec)
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def ts_fine(sec: float) -> str:
    """00:07.3, to a tenth: ad mode keeps several pictures inside one second."""
    t = round(max(0, sec), 1)
    return f"{ts(t)}.{int(round(t * 10)) % 10}"


def _load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


CSS = """
:root{--bg:#F6F2EC;--card:#FFFDF9;--ink:#1F1B17;--ink2:#5A524A;--ink3:#7A7066;--line:#E4DCD1;
--accent:#C52525;--on-accent:#FFFFFF;--wash:#F7E3E0;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161412;--card:#1F1C19;--ink:#F1ECE4;
--ink2:#B3AA9F;--ink3:#8F867B;--line:#332E29;--accent:#F5A623;--on-accent:#161412;--wash:#2E2415;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#161412;--card:#1F1C19;--ink:#F1ECE4;--ink2:#B3AA9F;--ink3:#8F867B;--line:#332E29;
--accent:#F5A623;--on-accent:#161412;--wash:#2E2415;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:16px/1.55 "Hanken Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;
padding-inline:16px;padding-block:32px 72px}
.wrap{max-width:1080px;margin:0 auto;display:grid;gap:24px}
.eyebrow{font:600 12px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
h1{font:600 clamp(30px,5vw,44px)/1.08 Fraunces,Georgia,serif;letter-spacing:-.01em;margin:6px 0 8px;text-wrap:balance}
.meta{color:var(--ink2);margin:0;font-variant-numeric:tabular-nums}
.jump{display:flex;flex-wrap:wrap;gap:8px}
.jump a{font:500 13px "JetBrains Mono",monospace;color:var(--ink2);text-decoration:none;border:1px solid var(--line);
border-radius:8px;padding:4px 8px;background:var(--card);font-variant-numeric:tabular-nums}
.jump a:hover,.jump a:focus-visible{color:var(--accent);border-color:var(--accent);outline:none}
section{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:20px;align-items:start;
padding-top:24px;border-top:1px solid var(--line)}
@media (max-width:760px){section{grid-template-columns:1fr}}
.range{grid-column:1/-1;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.range b{font:600 15px "JetBrains Mono",monospace;color:var(--accent);background:var(--wash);border-radius:6px;padding:2px 8px;
font-variant-numeric:tabular-nums}
.range span{font-size:13px;color:var(--ink3)}
.sheet{display:block;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#101010}
.sheet img{display:block;width:100%;height:auto}
ol{list-style:none;margin:0;padding:0;display:grid;gap:10px;position:sticky;top:calc(env(safe-area-inset-top,0px) + 16px)}
@media (max-width:760px){ol{position:static}}
li{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;color:var(--ink)}
li time{font:500 13px/1.9 "JetBrains Mono",monospace;color:var(--ink3);font-variant-numeric:tabular-nums}
.quiet{color:var(--ink3);font-style:italic}
.frames{display:grid;gap:16px;padding-top:24px;border-top:1px solid var(--line)}
.frames h2{font:600 24px/1.2 Fraunces,Georgia,serif;margin:0}
.frames p{margin:0;color:var(--ink2);max-width:62ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--tile,160px),1fr));gap:12px 8px}
.grid.tall{--tile:104px}
.fr{display:grid;gap:4px;padding:0;margin:0;border:0;background:none;color:inherit;cursor:pointer;text-align:left;
-webkit-tap-highlight-color:transparent}
.fr img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid var(--line);background:#101010}
.fr time{font:500 12px "JetBrains Mono",monospace;color:var(--ink3);font-variant-numeric:tabular-nums}
.fr:hover img,.fr:focus-visible img{border-color:var(--accent)}
.fr:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
.lb{position:fixed;inset:0;z-index:50;background:rgba(10,9,8,.94);display:none;flex-direction:column;
align-items:center;justify-content:center;gap:12px;padding:16px}
.lb[data-open="1"]{display:flex}
.lb img{display:block;max-width:100%;max-height:calc(100dvh - 190px);object-fit:contain;border-radius:10px;
-webkit-touch-callout:default}
.lb .cap{margin:0;color:#D8D1C7;font:500 13px "JetBrains Mono",monospace;font-variant-numeric:tabular-nums}
.lb .bar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.lb button{font:600 14px "Hanken Grotesk",system-ui,sans-serif;border-radius:999px;padding:10px 18px;min-height:44px;
cursor:pointer;border:1px solid transparent;background:var(--accent);color:var(--on-accent)}
.lb button.ghost{background:transparent;color:#F1ECE4;border-color:rgba(241,236,228,.3)}
.lb button:focus-visible{outline:2px solid #F1ECE4;outline-offset:2px}
.lb button[disabled]{opacity:.55;cursor:default}
.lb .msg{margin:0;min-height:1.5em;max-width:44ch;text-align:center;color:#F1ECE4;font-size:14px}
details{border-top:1px solid var(--line);padding-top:20px}
summary{cursor:pointer;font:600 18px Fraunces,Georgia,serif}
summary:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
pre{white-space:pre-wrap;font:14px/1.6 "JetBrains Mono",monospace;color:var(--ink2);max-width:80ch}
"""

# The Frames lightbox. Copy turns the still into a PNG through a canvas (image
# tools and clipboards want PNG) and falls back to a plain instruction when the
# clipboard is blocked. Save goes through the artifact downloads capability, the
# brief-artifact way: a plain <a download> does nothing inside the viewer, so the
# button stays hidden until claude.use('downloads') answers.
JS = """
(function () {
  var lb = document.getElementById('lb'), img = document.getElementById('lbimg'),
      cap = document.getElementById('lbcap'), cp = document.getElementById('lbcp'),
      dl = document.getElementById('lbdl'), x = document.getElementById('lbx'),
      msg = document.getElementById('lbmsg'), tiles = [].slice.call(document.querySelectorAll('.fr')),
      at = -1, last = null, downloads = null;
  if (!lb || !tiles.length) return;
  var HELP = 'Copy is blocked here. Long-press the big picture (phone) or right-click it (computer) and choose Copy image.';

  if (window.claude && window.claude.use) {
    claude.use('downloads').then(function (d) { downloads = d; if (d) dl.hidden = false; }, function () {});
  }

  function show(i) {
    var t = tiles[i]; at = i;
    img.src = t.getAttribute('data-src');
    img.alt = 'Frame at ' + t.getAttribute('data-t');
    cap.textContent = t.getAttribute('data-t') + '  \\u00b7  ' + (i + 1) + ' of ' + tiles.length;
    msg.textContent = ''; cp.textContent = 'Copy image'; cp.disabled = false;
    dl.textContent = 'Save'; dl.disabled = false;
  }
  function open(i) {
    last = tiles[i]; show(i);
    lb.setAttribute('data-open', '1');
    document.body.style.overflow = 'hidden';
    cp.focus();
  }
  function close() {
    lb.removeAttribute('data-open');
    document.body.style.overflow = '';
    img.removeAttribute('src');
    if (last) last.focus();
  }

  function toPng(src) {
    function draw(source, w, h) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(source, 0, 0);
      return new Promise(function (ok, no) {
        c.toBlob(function (b) { b ? ok(b) : no(new Error('no png')); }, 'image/png');
      });
    }
    return fetch(src).then(function (r) { return r.blob(); })
      .then(function (b) { return createImageBitmap(b); })
      .then(function (bm) { return draw(bm, bm.width, bm.height); },
            function () { return draw(img, img.naturalWidth, img.naturalHeight); });
  }
  function blocked() { cp.textContent = 'Copy image'; cp.disabled = false; msg.textContent = HELP; }

  cp.addEventListener('click', function () {
    msg.textContent = '';
    if (!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)) { blocked(); return; }
    cp.disabled = true; cp.textContent = 'Copying';
    var png = toPng(img.src);
    png.catch(function () {});
    try {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]).then(function () {
        cp.textContent = 'Copied'; cp.disabled = false;
        msg.textContent = 'Copied. Paste it into your image tool.';
      }, blocked);
    } catch (e) { blocked(); }
  });

  dl.addEventListener('click', function () {
    if (!downloads) return;
    var src = img.src, name = tiles[at].getAttribute('data-name');
    dl.disabled = true; dl.textContent = 'Saving';
    fetch(src).then(function (r) { return r.blob(); })
      .then(function (b) { return downloads.save({ filename: name, data: b }); })
      .then(function () { dl.textContent = 'Saved'; })
      .catch(function (e) { dl.textContent = e && e.code === 'declined' ? 'Save' : 'Could not save'; })
      .then(function () { dl.disabled = false; });
  });

  tiles.forEach(function (t, i) { t.addEventListener('click', function () { open(i); }); });
  x.addEventListener('click', close);
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.hasAttribute('data-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && at < tiles.length - 1) show(at + 1);
    else if (e.key === 'ArrowLeft' && at > 0) show(at - 1);
  });
})();
"""


def _stills(out: str, frames: list, files_dir: str) -> list:
    """The frames that have a still on disk. Stills nothing points at are removed,
    so a published report-files/ never carries a stale picture."""
    sdir = os.path.join(files_dir, "stills")
    have = [f for f in frames if f.get("still") and os.path.exists(os.path.join(sdir, f["still"]))]
    if os.path.isdir(sdir):
        keep = {f["still"] for f in have}
        for n in os.listdir(sdir):
            if n not in keep:
                os.remove(os.path.join(sdir, n))
        if not keep:
            os.rmdir(sdir)
    return have


def _frames_section(stills: list) -> str:
    e = html.escape
    w, h = stills[0].get("still_size") or (16, 9)
    tiles = []
    for f in stills:
        t = ts_fine(f["t"])
        sw, sh = f.get("still_size") or (w, h)
        src = f"report-files/stills/{f['still']}"
        tiles.append(
            f'<button type="button" class="fr" data-src="{e(src)}" data-t="{t}" '
            f'data-name="frame-{t.replace(":", "-")}.jpg" aria-label="Open frame at {t}">'
            f'<img src="{e(src)}" width="{sw}" height="{sh}" alt="" loading="lazy" decoding="async">'
            f"<time>{t}</time></button>"
        )
    return (
        '<section class="frames" id="frames" aria-labelledby="frames-h"><h2 id="frames-h">Frames</h2>'
        f"<p>Every kept picture on its own, {len(stills)} in all. Tap one to open it big, then Copy image "
        "to paste it into an image tool as a reference, or Save it.</p>"
        f'<div class="grid{" tall" if h > w else ""}">{"".join(tiles)}</div></section>'
        '<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Frame">'
        '<p class="cap" id="lbcap"></p><img id="lbimg" alt="">'
        '<div class="bar"><button type="button" id="lbcp">Copy image</button>'
        '<button type="button" id="lbdl" hidden>Save</button>'
        '<button type="button" id="lbx" class="ghost">Close</button></div>'
        '<p class="msg" id="lbmsg" role="status" aria-live="polite"></p></div>'
        f"<script>{JS}</script>"
    )


def write_report(out: str) -> str:
    """Build report.html in a breakdown folder. Returns its path."""
    meta = _load(os.path.join(out, "meta.json"), {})
    lines = _load(os.path.join(out, "transcript.json"), [])
    sheets = meta.get("sheets") or []
    if not sheets:
        raise RuntimeError("no sheets in meta.json; run breakdown.py first")
    duration = float(meta.get("duration") or 0)
    frames = _load(os.path.join(out, "frames.json"), [])

    # Rebuild the sheets; keep report-files/stills/ (written by breakdown.py --stills).
    files_dir = os.path.join(out, "report-files")
    os.makedirs(files_dir, exist_ok=True)
    for n in os.listdir(files_dir):
        p = os.path.join(files_dir, n)
        if os.path.isdir(p) and n != "stills":
            shutil.rmtree(p)
        elif not os.path.isdir(p):
            os.remove(p)
    for sh in sheets:
        shutil.copyfile(os.path.join(out, "sheets", sh["file"]), os.path.join(files_dir, sh["file"]))

    name = meta.get("name") or os.path.basename(os.path.abspath(out))
    title = name.replace("-", " ").replace("_", " ").strip().title() or "Recording"
    mode = "ad" if meta.get("mode") == "ad" else "screen recording"
    e = html.escape

    stills = _stills(out, frames, files_dir)
    rows, jumps = [], []
    if stills:
        jumps.append(f'<a href="#frames">Frames ({len(stills)})</a>')
    for i, sh in enumerate(sheets):
        lo = sh["from"] if i else 0.0
        hi = sheets[i + 1]["from"] if i + 1 < len(sheets) else duration
        said = [l for l in lines if lo <= l["start"] < (hi if i + 1 < len(sheets) else hi + 1)]
        n = sum(1 for f in frames if lo <= f["t"] < (hi if i + 1 < len(sheets) else hi + 1))
        sid = f"s{i + 1}"
        jumps.append(f'<a href="#{sid}">{ts(lo)}</a>')
        items = "".join(f"<li><time>{ts(l['start'])}</time><span>{e(l['text'])}</span></li>" for l in said)
        rows.append(
            f'<section id="{sid}"><div class="range"><b>{ts(lo)} – {ts(hi)}</b>'
            f"<span>{n} pictures · {len(said)} lines</span></div>"
            f'<a class="sheet" href="report-files/{e(sh["file"])}"><img src="report-files/{e(sh["file"])}" '
            f'alt="Pictures from {ts(lo)} to {ts(hi)}, each stamped with its time" loading="lazy"></a>'
            + (f"<ol>{items}</ol>" if items else '<p class="quiet">Nothing said in this stretch.</p>')
            + "</section>"
        )

    full = "\n".join(f"[{ts(l['start'])}] {l['text']}" for l in lines)
    page = (
        '<meta charset="utf-8">\n'
        f"<title>{e(title)}</title>\n"
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600'
        '&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap">\n'
        f"<style>{CSS}</style>\n"
        '<div class="wrap"><header>'
        f'<div class="eyebrow">Video breakdown · {e(mode)}</div><h1>{e(title)}</h1>'
        f'<p class="meta">{ts(duration)} long · {len(frames)} pictures on {len(sheets)} sheets · '
        f"{len(lines)} lines of speech"
        + (f" · {len(stills)} frames to copy" if stills else "")
        + f" · source <code>{e(meta.get('video', ''))}</code></p></header>"
        f'<nav class="jump" aria-label="Jump to a stretch">{"".join(jumps)}</nav>'
        + "".join(rows)
        + (_frames_section(stills) if stills else "")
        + (f"<details><summary>Full transcript</summary><pre>{e(full)}</pre></details>" if lines else "")
        + "</div>\n"
    )
    path = os.path.join(out, "report.html")
    with open(path, "w") as f:
        f.write(page)
    return path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/screen-video/report.py .recordings/<name>/")
    print(write_report(os.path.abspath(sys.argv[1])))
