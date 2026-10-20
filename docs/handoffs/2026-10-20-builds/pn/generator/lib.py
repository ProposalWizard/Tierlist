# Shared renderer for the overnight patch-notes pages (Knowitball, 20 Oct 2026).
# Looks come from references/tuning-plan-standard.html (house style). Dark first, light tokens mirrored.
import html, os, shutil, json
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# docs/handoffs/2026-10-20-builds (this file lives in .../pn/generator). Paths fixed 20 Oct: they used to point at an old scratchpad.
BASE = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'src')
# Built pages go here. Set PN_OUT to write somewhere else (the scratchpad), so no built pages land in the repo by accident.
OUT = os.environ.get('PN_OUT') or HERE

CSS = """
  /* Layout: one column, stacked cards, stills under their text. Tokens first, then components. */
  :root{
    --bg:#0b100e;--card:#141d18;--card2:#192520;--line:#24332b;
    --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
    --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;--violet:#b18cff;
    --gbg:rgba(61,220,132,.14);--abg:rgba(245,185,66,.14);--rbg:rgba(255,107,107,.14);--bbg:rgba(111,184,255,.14);
    --pill:#3ddc84;--pillink:#06170e;--r:12px;
    color-scheme:dark;
  }
  @media (prefers-color-scheme: light){
    :root:not([data-theme="dark"]){
      --bg:#f4f7f5;--card:#ffffff;--card2:#eef3f0;--line:#dae4de;
      --ink:#0e1613;--ink2:#3f564c;--ink3:#5f766b;
      --green:#0b7a43;--amber:#8f6200;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
      --gbg:rgba(11,122,67,.11);--abg:rgba(143,98,0,.12);--rbg:rgba(198,40,40,.10);--bbg:rgba(21,101,192,.10);
      --pill:#0b7a43;--pillink:#ffffff;
      color-scheme:light;
    }
  }
  :root[data-theme="light"]{
    --bg:#f4f7f5;--card:#ffffff;--card2:#eef3f0;--line:#dae4de;
    --ink:#0e1613;--ink2:#3f564c;--ink3:#5f766b;
    --green:#0b7a43;--amber:#8f6200;--red:#c62828;--blue:#1565c0;--violet:#6a3fc0;
    --gbg:rgba(11,122,67,.11);--abg:rgba(143,98,0,.12);--rbg:rgba(198,40,40,.10);--bbg:rgba(21,101,192,.10);
    --pill:#0b7a43;--pillink:#ffffff;
    color-scheme:light;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;overflow-wrap:anywhere}
  .wrap{max-width:760px;margin:0 auto;padding-block:0 64px;
    padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  a{color:var(--blue)}
  header{padding:30px 0 4px}
  .ver{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.12em;background:var(--pill);color:var(--pillink);padding:4px 10px;border-radius:999px}
  h1{font-size:clamp(24px,6.6vw,34px);line-height:1.12;margin:12px 0 12px;letter-spacing:-.02em;text-wrap:balance}
  .status{display:flex;align-items:center;gap:8px;margin:0 0 2px;font-weight:700;font-size:14.5px}
  .status i{width:9px;height:9px;border-radius:50%;background:var(--amber);flex:none}
  .sub{color:var(--ink3);font-size:13px;margin:0 0 14px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 4px}
  .chip{display:inline-block;font-size:12.5px;font-weight:700;padding:6px 11px;border-radius:999px;background:var(--card);border:1px solid var(--line);color:var(--ink2);text-decoration:none}
  .chip.hot{color:var(--amber);border-color:var(--amber)}
  .back{display:inline-block;font-size:13px;font-weight:700;margin:0 0 4px}

  h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;margin:34px 0 12px;display:flex;align-items:center;gap:9px}
  h2 i{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
  h2.fix{color:var(--green)} h2.fix i{background:var(--green)}
  h2.add{color:var(--blue)} h2.add i{background:var(--blue)}
  h2.chg{color:var(--violet)} h2.chg i{background:var(--violet)}
  h2.bug{color:var(--amber)} h2.bug i{background:var(--amber)}
  h2.nxt{color:var(--ink3)} h2.nxt i{background:var(--ink3)}
  .snote{color:var(--ink3);font-size:13px;margin:-4px 0 12px}

  .ck{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:var(--r)}
  .ck li{padding:11px 14px;border-bottom:1px solid var(--line)}
  .ck li:last-child{border-bottom:0}
  .ck label{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;cursor:pointer}
  .ck input{width:18px;height:18px;margin:3px 0 0;accent-color:var(--green)}
  .ck .q{font-weight:700;display:block}
  .ck .a{display:block;color:var(--ink3);font-size:13.5px;margin-top:2px}

  .item{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:0 0 12px;min-width:0}
  .ih{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;margin:0 0 9px}
  .ih b{font-size:16px;line-height:1.3}
  .tag{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;white-space:nowrap}
  .t-seen{background:var(--gbg);color:var(--green)}
  .t-meas{background:var(--bbg);color:var(--blue)}
  .t-reas{background:var(--abg);color:var(--amber)}
  .t-no{background:var(--rbg);color:var(--red)}
  .row{margin:0 0 9px;min-width:0}
  .rl{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:0 0 2px}
  .rl.p{color:var(--red)} .rl.w{color:var(--amber)} .rl.f{color:var(--green)} .rl.s{color:var(--blue)}
  .row p{margin:0;color:var(--ink2);font-size:14.5px}
  .row p b,.row li b{color:var(--ink)}
  .row ul{margin:4px 0 0;padding-left:18px;color:var(--ink2);font-size:14.5px}
  .row li{margin-bottom:4px}
  .nr{color:var(--ink3);font-style:italic}
  .tile{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}
  .tile>b{display:block;font-size:15px}
  .tile>p{margin:3px 0 0;color:var(--ink2);font-size:14.5px}

  .bars{margin:8px 0 2px}
  .bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center;padding:5px 0;font-size:13px}
  .bar .bl{grid-column:1/-1;color:var(--ink2)}
  .track{position:relative;height:19px;background:var(--card2);border-radius:4px;overflow:hidden;min-width:0}
  .fill{position:absolute;left:0;height:8px;border-radius:3px}
  .fill.was{top:1px;background:var(--ink3);opacity:.55}
  .fill.now{bottom:1px;background:var(--green);opacity:.9}
  .track.solo{height:14px}
  .track.solo .fill.now{top:0;bottom:0;height:auto}
  .fill.now.warn{background:var(--amber)}
  .fill.now.bad{background:var(--red)}
  .fill.now.blue{background:var(--blue)}
  .vv{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap;font-size:12.5px}
  .vv s{color:var(--ink3);font-weight:400;text-decoration:line-through;opacity:.9}
  .bnote{color:var(--ink3);font-size:12.5px;margin:2px 0 0}

  figure{margin:12px 0 2px;min-width:0}
  figure img{width:100%;height:auto;display:block;border-radius:var(--r);border:1px solid var(--line);background:var(--card2)}
  figure figcaption{font-size:12.5px;color:var(--ink3);margin-top:7px;line-height:1.4}
  figure figcaption b{color:var(--ink2)}
  figure.ph{max-width:270px;width:100%;margin-left:auto;margin-right:auto}
  .figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px 14px;margin:10px 0 0}
  .figs.wide{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
  .figs figure{margin:0}
  .figs.pair{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .figs.pair figure.ph{max-width:none}

  details{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:0 14px;margin:10px 0 0}
  details[open]{padding-bottom:12px}
  summary{cursor:pointer;list-style:none;padding:11px 0;font-size:13px;font-weight:700;color:var(--ink3);display:flex;align-items:center;gap:7px}
  summary::-webkit-details-marker{display:none}
  summary::before{content:"\\25B8";display:inline-block;color:var(--ink3);transition:transform .15s}
  details[open]>summary::before{transform:rotate(90deg)}
  details p{margin:0 0 9px;color:var(--ink2);font-size:14px}
  details ul{margin:0 0 9px;padding-left:18px;color:var(--ink2);font-size:14px}
  details li{margin-bottom:6px}
  details .figs{margin-top:2px}

  .pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;vertical-align:1px}
  .p-red{background:var(--rbg);color:var(--red)} .p-amb{background:var(--abg);color:var(--amber)}
  .p-grn{background:var(--gbg);color:var(--green)} .p-blu{background:var(--bbg);color:var(--blue)}

  .sbox{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:2px 14px 12px}
  .sbox h3{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;margin:14px 0 4px}
  .sbox h3.g{color:var(--green)} .sbox h3.b{color:var(--blue)} .sbox h3.a{color:var(--amber)} .sbox h3.r{color:var(--red)}
  .sbox ul{margin:0;padding-left:18px;color:var(--ink2);font-size:14px}
  .sbox li{margin-bottom:4px}

  .okbox{border:1px solid var(--line);border-left:4px solid var(--amber);background:var(--card);border-radius:var(--r);padding:2px 14px 6px}
  .okbox ol{margin:0;padding:0;list-style:none;counter-reset:q}
  .okbox li{position:relative;padding:12px 0 12px 32px;border-bottom:1px solid var(--line);counter-increment:q}
  .okbox li:last-child{border-bottom:0}
  .okbox li::before{content:counter(q);position:absolute;left:0;top:12px;width:22px;height:22px;border-radius:50%;background:var(--amber);color:var(--bg);font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}
  .okbox .q{font-weight:700}
  .okbox .opts{margin:6px 0 0;display:flex;flex-wrap:wrap;gap:6px}
  .okbox .d{color:var(--ink2);font-size:14px;margin-top:4px}
  .okbox .who{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-right:6px}

  .vid{border:2px dashed var(--line);border-radius:var(--r);padding:12px 14px;background:var(--card)}
  .vid b{color:var(--amber)}
  .vid p{margin:4px 0 0;color:var(--ink2);font-size:14px}
  .vid ul{margin:8px 0 0;padding-left:18px;color:var(--ink2);font-size:14px}

  .cards{display:grid;gap:10px;margin:0}
  .bcard{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:13px 14px;min-width:0}
  .bcard .n{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 4px}
  .bcard .n b{font-size:17px}
  .bcard p{margin:0;color:var(--ink2);font-size:14.5px}
  .bcard .go{display:inline-block;margin-top:8px;font-size:13px;font-weight:800;color:var(--blue)}
  .bcard.soon{border-style:dashed;opacity:.85}

  /* --- how these patch notes work --- */
  .how{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--green);border-radius:var(--r);padding:12px 14px 10px;min-width:0}
  .how svg{display:block;width:100%;max-width:340px;height:auto;margin:2px auto 10px}
  .how ol{margin:0;padding-left:20px;color:var(--ink2);font-size:14.5px}
  .how li{margin:0 0 6px}
  .how li b{color:var(--ink)}
  .how .mini{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:1px 6px;border-radius:999px;vertical-align:1px}
  .how .btn{display:inline-block;font-size:12.5px;font-weight:800;background:var(--pill);color:var(--pillink);padding:2px 9px;border-radius:999px;vertical-align:1px}
  .how .where{margin:8px 0 0;font-size:13px;color:var(--ink3)}
  /* --- already decided --- */
  .donebox{border:1px solid var(--line);border-left:4px solid var(--green);background:var(--card);border-radius:var(--r);padding:2px 14px 6px}
  .donebox ul{margin:0;padding:0;list-style:none}
  .donebox li{padding:11px 0 11px 28px;border-bottom:1px solid var(--line);position:relative}
  .donebox li:last-child{border-bottom:0}
  .donebox li::before{content:"\\2713";position:absolute;left:2px;top:11px;width:20px;height:20px;border-radius:50%;background:var(--green);color:var(--pillink);font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}
  .donebox .q{font-weight:700}
  .donebox .d{color:var(--ink2);font-size:14px;margin-top:3px}
  .donebox .by{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--green);margin-right:6px}
  /* --- video --- */
  .clip{margin:12px 0 2px}
  .clip video{display:block;width:100%;max-width:100%;height:auto;border-radius:var(--r);border:1px solid var(--line);background:#000}
  .clip .look{font-size:13px;color:var(--ink2);margin:0 0 7px}
  .clip .look b{color:var(--ink)}
  .clip figcaption{font-size:12.5px;color:var(--ink3);margin-top:7px}
  .clip.ph{max-width:390px;margin-left:auto;margin-right:auto}
  /* --- tabs (index) --- */
  .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px;position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0}
  .tab{appearance:none;border:1px solid var(--line);background:var(--card);color:var(--ink2);font:inherit;font-size:13.5px;font-weight:800;padding:8px 13px;border-radius:999px;cursor:pointer;min-height:40px}
  .tab[aria-selected="true"]{background:var(--pill);color:var(--pillink);border-color:var(--pill)}
  .tab small{font-weight:700;opacity:.8;margin-left:4px}
  .js .panel[hidden]{display:none}
  .panel h3.grp{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin:18px 0 8px}
  .bcard .vtag{font-size:11px;font-weight:800;color:var(--ink3);letter-spacing:.04em}
  .qlist{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:2px 14px}
  .qlist ul{margin:0;padding:0;list-style:none}
  .qlist li{padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink2);font-size:14px}
  .qlist li:last-child{border-bottom:0}
  .qlist li b{color:var(--ink)}

  /* --- steps (vertical list) --- */
  .steps{list-style:none;margin:6px 0 0;padding:0;counter-reset:st}
  .steps li{position:relative;padding:9px 0 9px 36px;border-bottom:1px solid var(--line);counter-increment:st;color:var(--ink2);font-size:14.5px;min-width:0}
  .steps li:last-child{border-bottom:0}
  .steps li::before{content:counter(st);position:absolute;left:0;top:9px;width:24px;height:24px;border-radius:50%;background:var(--card2);border:1px solid var(--line);color:var(--ink);font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center}
  .steps li b{color:var(--ink)}
  .steps li.done::before{background:var(--green);border-color:var(--green);color:var(--pillink);content:"\\2713"}
  .steps li.next::before{background:var(--amber);border-color:var(--amber);color:var(--bg)}
  .mock{border:2px solid var(--red);border-radius:var(--r);background:var(--rbg);padding:12px 14px;margin:10px 0 2px}
  .mock b{display:block;color:var(--red);font-size:15px;letter-spacing:.02em}
  .mock p{margin:4px 0 0;color:var(--ink2);font-size:14px}
  .mock .mb{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .mock .mb span{font-size:13px;font-weight:800;padding:5px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink2)}
  .mock .mb span.go{background:var(--card2)}

  footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink3);font-size:12.5px}
"""

def esc(s): return html.escape(s, quote=True)

class Page:
    """One patch-notes page. `dirs` = folders to look for stills in (first hit wins).
    Default: the build's own folder under BASE."""
    def __init__(self, key, dirs=None):
        self.key = key
        self.dirs = dirs or [os.path.join(BASE, key), os.path.join(BASE, key, 'clips')]   # stills, then clips (20 Oct)
        self.used = []          # list of (published name, source path)
        self.clips = []         # list of (published name, source path)

    def _find(self, name):
        for d in self.dirs:
            p = os.path.join(d, name)
            if os.path.exists(p): return p
        raise FileNotFoundError(name + ' not in ' + ', '.join(self.dirs))

    # ---------- pieces ----------
    def fig(self, name, cap, kind='ph', as_name=None):
        src = self._find(name)
        pub = as_name or name
        w, h = Image.open(src).size
        if all(pub != u[0] for u in self.used): self.used.append((pub, src))
        plain = ' '.join(cap.replace('<b>', '').replace('</b>', '').split())
        cls = 'ph' if kind == 'ph' else 'wd'
        return ('<figure class="%s"><img src="img/%s" alt="%s" width="%d" height="%d" loading="lazy">'
                '<figcaption>%s</figcaption></figure>') % (cls, pub, esc(plain), w, h, cap)

    def video(self, name, poster, look, cap, phone=False):
        """A short clip: <video controls playsinline muted>, with a still as the poster. phone=True caps the width at 390 px on a wide screen."""
        src = self._find(name)
        psrc = self._find(poster)
        if all(poster != u[0] for u in self.used): self.used.append((poster, psrc))
        if all(name != c[0] for c in self.clips): self.clips.append((name, src))
        return ('<figure class="clip%s"><p class="look"><b>Look for:</b> %s</p>'
                '<video controls playsinline muted preload="metadata" poster="img/%s" src="clips/%s"></video>'
                '<figcaption>%s</figcaption></figure>') % (' ph' if phone else '', look, poster, name, cap)

    @staticmethod
    def figs(items, wide=False, pair=False):
        return '<div class="figs%s%s">%s</div>' % (' wide' if wide else '', ' pair' if pair else '', ''.join(items))

def bar(label, was, now, vmax, was_txt, now_txt, cls=''):
    wasw = '' if was is None else '<span class="fill was" style="width:%.1f%%"></span>' % (was / vmax * 100)
    vv = ('<s>%s</s> &rarr; %s' % (was_txt, now_txt)) if was_txt else now_txt
    return ('<div class="bar"><span class="bl">%s</span><span class="track%s">%s<span class="fill now %s" style="width:%.1f%%"></span></span>'
            '<span class="vv">%s</span></div>') % (label, ' solo' if was is None else '', wasw, cls, now / vmax * 100, vv)

def bars(*rows, note=None):
    n = '<p class="bnote">%s</p>' % note if note else ''
    return '<div class="bars">%s</div>%s' % (''.join(rows), n)

def tag(kind, text=None):
    m = {'seen': ('t-seen', 'seen'), 'meas': ('t-meas', 'measured'), 'reas': ('t-reas', 'reasoned'), 'no': ('t-no', 'not seen')}
    c, t = m[kind]
    return '<span class="tag %s">%s</span>' % (c, text or t)

ROWCLS = {'Problem': 'p', 'Why': 'w', 'Problem / Why': 'w', 'Fix': 'f', 'Status': 's'}
def row(label, body):
    if body.startswith('<ul') or body.startswith('<p'):
        inner = body
    elif '<ul' in body:
        i = body.index('<ul')
        inner = '<p>%s</p>%s' % (body[:i].strip(), body[i:])
    else:
        inner = '<p>%s</p>' % body
    return '<div class="row"><div class="rl %s">%s</div>%s</div>' % (ROWCLS.get(label, 'f'), label, inner)

def item(h, tags, rows, extra=''):
    return ('<div class="item"><div class="ih"><b>%s</b>%s</div>%s%s</div>'
            % (h, ''.join(tags), ''.join(row(l, b) for l, b in rows), extra))

def tile(h, line, figs_html=''):
    return '<div class="tile"><b>%s</b><p>%s</p>%s</div>' % (h, line, figs_html)

def section(cls, label, items, note=None):
    n = '<p class="snote">%s</p>' % note if note else ''
    return '<h2 class="%s"><i></i>%s</h2>%s%s' % (cls, label, n, ''.join(items))

def steps(rows):
    """rows: (kind, html) with kind in '', 'done', 'next'."""
    return '<ol class="steps">%s</ol>' % ''.join('<li%s>%s</li>' % (' class="%s"' % k if k else '', t) for k, t in rows)

def details(summary, inner):
    return '<details><summary>%s</summary>%s</details>' % (summary, inner)

NR = '<span class="nr">Not in the report.</span>'

# ---------- the "how these patch notes work" block ----------
HOW_SVG = """<svg viewBox="0 0 346 250" role="img" aria-label="A drawing of one patch-notes page: 1 Check these, 2 each change as Problem, Why, Fix with its picture, 3 the Seen, measured or reasoned tag, 4 Needs your OK, 5 the Read and understood button on the admin Patch notes page.">
<rect x="8" y="6" width="176" height="238" rx="10" style="fill:var(--card);stroke:var(--line);stroke-width:1.5"/>
<rect x="20" y="18" width="46" height="9" rx="4.5" style="fill:var(--pill)"/>
<rect x="20" y="33" width="136" height="6" rx="3" style="fill:var(--ink3)"/>
<rect x="20" y="44" width="98" height="6" rx="3" style="fill:var(--ink3)"/>
<rect x="20" y="60" width="52" height="5" rx="2.5" style="fill:var(--ink2)"/>
<rect x="20" y="71" width="8" height="8" rx="2" style="fill:none;stroke:var(--green);stroke-width:1.5"/><rect x="34" y="73" width="96" height="4" rx="2" style="fill:var(--line)"/>
<rect x="20" y="84" width="8" height="8" rx="2" style="fill:none;stroke:var(--green);stroke-width:1.5"/><rect x="34" y="86" width="78" height="4" rx="2" style="fill:var(--line)"/>
<rect x="20" y="97" width="8" height="8" rx="2" style="fill:none;stroke:var(--green);stroke-width:1.5"/><rect x="34" y="99" width="108" height="4" rx="2" style="fill:var(--line)"/>
<rect x="20" y="112" width="152" height="62" rx="6" style="fill:var(--card2);stroke:var(--line)"/>
<rect x="27" y="120" width="14" height="5" rx="2.5" style="fill:var(--red)"/><rect x="46" y="121" width="64" height="3.5" rx="1.7" style="fill:var(--line)"/>
<rect x="27" y="134" width="14" height="5" rx="2.5" style="fill:var(--amber)"/><rect x="46" y="135" width="52" height="3.5" rx="1.7" style="fill:var(--line)"/>
<rect x="27" y="148" width="14" height="5" rx="2.5" style="fill:var(--green)"/><rect x="46" y="149" width="64" height="3.5" rx="1.7" style="fill:var(--line)"/>
<rect x="120" y="118" width="44" height="50" rx="4" style="fill:var(--line)"/>
<path d="M124 160 l10 -14 l8 8 l7 -11 l11 17z" style="fill:var(--ink3);opacity:.6"/>
<rect x="20" y="181" width="34" height="9" rx="4.5" style="fill:var(--green);opacity:.85"/>
<rect x="58" y="181" width="40" height="9" rx="4.5" style="fill:var(--blue);opacity:.85"/>
<rect x="102" y="181" width="40" height="9" rx="4.5" style="fill:var(--amber);opacity:.85"/>
<rect x="20" y="198" width="152" height="18" rx="4" style="fill:var(--card2)"/><rect x="20" y="198" width="3" height="18" style="fill:var(--amber)"/><rect x="30" y="205" width="100" height="4" rx="2" style="fill:var(--ink3)"/>
<rect x="20" y="224" width="92" height="13" rx="6.5" style="fill:var(--pill)"/><rect x="34" y="229.5" width="64" height="3" rx="1.5" style="fill:var(--pillink);opacity:.8"/>
<g style="font:700 11px -apple-system,Segoe UI,Roboto,sans-serif;fill:var(--ink2)">
<circle cx="204" cy="82" r="9" style="fill:var(--pill)"/><text x="204" y="86" text-anchor="middle" style="fill:var(--pillink)">1</text><text x="220" y="80">Check these</text><text x="220" y="93">first</text>
<circle cx="204" cy="140" r="9" style="fill:var(--pill)"/><text x="204" y="144" text-anchor="middle" style="fill:var(--pillink)">2</text><text x="220" y="138">Problem, Why,</text><text x="220" y="151">Fix + picture</text>
<circle cx="204" cy="186" r="9" style="fill:var(--pill)"/><text x="204" y="190" text-anchor="middle" style="fill:var(--pillink)">3</text><text x="220" y="184">Seen, measured</text><text x="220" y="197">or reasoned</text>
<circle cx="204" cy="207" r="9" style="fill:var(--pill)"/><text x="204" y="211" text-anchor="middle" style="fill:var(--pillink)">4</text><text x="220" y="211">Needs your OK</text>
<circle cx="204" cy="231" r="9" style="fill:var(--pill)"/><text x="204" y="235" text-anchor="middle" style="fill:var(--pillink)">5</text><text x="220" y="235">Read and understood</text>
</g></svg>"""

def how_block(ver=None):
    where = ('This page is <b>v%s</b> in <b>Admin &rarr; Patch notes</b>.' % ver) if ver else 'Every page below is its own version in <b>Admin &rarr; Patch notes</b>.'
    return ('<h2 class="nxt" id="how"><i></i>HOW THESE PATCH NOTES WORK</h2><div class="how">' + HOW_SVG + '<ol>'
            '<li><b>One page per build.</b> Open the one you want.</li>'
            '<li><b>Check these</b> is the short list at the top. Look at each one in the game.</li>'
            '<li><b>Each change is Problem &rarr; Why &rarr; Fix</b>, with its picture right under it.</li>'
            '<li><b>The tag says how sure we are:</b> <span class="mini t-seen">seen</span> on a screen, <span class="mini t-meas">measured</span> as a number, <span class="mini t-reas">reasoned</span> from the code only, <span class="mini t-no">not seen</span>.</li>'
            '<li><b>Needs your OK</b> lists what waits on you. Then press <span class="btn">Read and understood</span> on the admin Patch notes page, so we know you read it.</li></ol>'
            '<p class="where">' + where + '</p></div>')

# ---------- page assembly ----------
def render_ok(spec):
    """Open questions (NEEDS YOUR OK) and decided ones (ALREADY DECIDED)."""
    open_ = [o for o in spec['ok'] if not o.get('done')]
    done = [o for o in spec['ok'] if o.get('done')]
    oks = ''
    for o in open_:
        opts = ''.join('<span class="pill %s">%s</span>' % (c, t) for t, c in o['opts'])
        who = '<span class="who">%s</span>' % o['who'] if o.get('who') else ''
        oks += '<li><div class="q">%s%s</div><div class="opts">%s</div><div class="d">%s</div></li>' % (who, o['q'], opts, o['d'])
    if open_:
        out = '<h2 class="bug" id="ok"><i></i>NEEDS YOUR OK</h2><div class="okbox"><ol>%s</ol></div>' % oks
    else:
        out = '<h2 class="bug" id="ok"><i></i>NEEDS YOUR OK</h2><p class="snote">Nothing is waiting on you on this page.</p>'
    if done:
        ds = ''.join('<li><div class="q">%s</div><div class="d"><span class="by">%s</span>%s</div></li>' % (o['q'], o.get('by', 'Decided'), o['done']) for o in done)
        out += '<h2 class="fix"><i></i>ALREADY DECIDED</h2><div class="donebox"><ul>%s</ul></div>' % ds
    return out, len(open_), len(done)

def render_page(p, spec, index_url):
    key = spec['key']
    oksec, nopen, ndone = render_ok(spec)
    back = ('<a class="back" href="%s" target="_blank" rel="noopener">&larr; All last-2-days notes</a>' % index_url) if index_url else ''
    chips = ('<a class="chip hot" href="#ok">%d need your OK &darr;</a>' % nopen) if nopen else '<a class="chip" href="#ok">Nothing waiting on you</a>'
    if ndone: chips += '<a class="chip" href="#ok">%d decided</a>' % ndone
    chips += '<a class="chip" href="#vid">Videos %s &darr;</a>' % (spec.get('videos_label') or ('coming' if spec['videos_coming'] else ('here' if spec.get('videos_here') else '(none planned)')))
    chips += '<a class="chip" href="#how">How this works</a>'
    checks = ''.join(
        '<li><label><input type="checkbox" data-k="c%d"><span><span class="q">%s</span><span class="a">%s</span></span></label></li>' % (i, q, a)
        for i, (q, a) in enumerate(spec['checks']))
    s = spec['seen']
    def lst(cls, title, items):
        if not items: return ''
        return '<h3 class="%s">%s</h3><ul>%s</ul>' % (cls, title, ''.join('<li>%s</li>' % x for x in items))
    seen = '<div class="sbox">%s%s%s%s</div>' % (
        lst('g', 'Seen on a screen', s.get('seen', [])), lst('b', 'Measured (numbers)', s.get('meas', [])),
        lst('a', 'Reasoned, not seen', s.get('reas', [])), lst('r', 'Not seen / not done', s.get('no', [])))
    vids = spec['videos']
    nums = spec.get('numbers', '')
    numsec = ('<h2 class="nxt"><i></i>THE NUMBERS</h2>' + details('The numbers, if you want them', nums)) if nums else ''
    status = spec.get('status', 'On the Harry branch, not live yet.')
    sub = spec['sub'] + (' In Admin &rarr; Patch notes this is <b>v%s</b>.' % spec['ver'] if spec.get('ver') else '')
    foot = spec.get('footer', '20 Oct 2026. Built overnight on the Harry branch. Nothing here is live. Every fact comes from the builders&rsquo; reports. Pictures are stills taken while checking the work.')
    body = f"""<title>{spec['title']}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{CSS}</style>
<div class="wrap">
<header>
  {back}<br>
  <span class="ver">{spec['pill']}</span>
  <h1>{spec['headline']}</h1>
  <p class="status"><i></i>{status}</p>
  <p class="sub">{sub}</p>
  <div class="chips">{chips}</div>
</header>

<h2 class="nxt"><i></i>CHECK THESE</h2>
<ul class="ck">{checks}</ul>

{how_block(spec.get('ver'))}

{''.join(spec['sections'])}

{numsec}

<h2 class="nxt" id="vid"><i></i>VIDEOS</h2>
<div class="vid">{vids}</div>

<h2 class="bug"><i></i>SEEN / NOT SEEN</h2>
{seen}

{oksec}

<footer>{foot}</footer>
</div>
<script>
(function(){{
  var K='kib-overnight-{key}-checks', s={{}};
  try{{ s=JSON.parse(localStorage.getItem(K)||'{{}}')||{{}}; }}catch(e){{ s={{}}; }}
  var boxes=document.querySelectorAll('.ck input');
  for(var i=0;i<boxes.length;i++){{(function(b){{
    var id=b.getAttribute('data-k'); if(s[id]) b.checked=true;
    b.addEventListener('change',function(){{ s[id]=b.checked; try{{ localStorage.setItem(K,JSON.stringify(s)); }}catch(e){{}} }});
  }})(boxes[i]);}}
}})();
</script>
"""
    return body, nopen, ndone

def write_page(p, spec, index_url):
    d = os.path.join(OUT, spec['key'])
    if os.path.isdir(os.path.join(d, 'img')): shutil.rmtree(os.path.join(d, 'img'))
    if os.path.isdir(os.path.join(d, 'clips')): shutil.rmtree(os.path.join(d, 'clips'))
    os.makedirs(os.path.join(d, 'img'), exist_ok=True)
    for pub, src in p.used:
        shutil.copy2(src, os.path.join(d, 'img', pub))
    if p.clips:
        os.makedirs(os.path.join(d, 'clips'), exist_ok=True)
        for pub, src in p.clips:
            shutil.copy2(src, os.path.join(d, 'clips', pub))
    html_, nopen, ndone = render_page(p, spec, index_url)
    with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_)
    return d, nopen, ndone
