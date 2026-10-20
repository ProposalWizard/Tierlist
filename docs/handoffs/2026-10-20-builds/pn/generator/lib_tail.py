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
    chips += '<a class="chip" href="#vid">Videos %s &darr;</a>' % ('coming' if spec['videos_coming'] else ('here' if spec.get('videos_here') else '(none planned)'))
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
