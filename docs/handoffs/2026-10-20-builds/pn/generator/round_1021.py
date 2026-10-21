"""Patch notes 0.95h to 0.102h (21 Oct 2026): everything after v0.94 that had no notes yet, plus the Inbox round.

Usage: python3 -I round_1021.py
  Writes  : patch-notes/pages/<ver>/index.html + img/ + clips/  (the kept pages, same look as 0.94)
            lib/patchNotesData.ts                               (one entry per version, newest first; re-running replaces them)
            lib/patchNotePages.ts                               (one line per version)
            patch-notes/pages/0.75/index.html                   (one card per version on the index, under "Built overnight")
  Then add the keys to build_site.py's PAGES (done by hand, once).
The words follow the house format: every item is Problem -> Why -> Fix, tagged seen / measured / reasoned.
"""
import html, json, os, re, shutil, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
B = os.path.join(REPO, 'docs', 'handoffs', '2026-10-20-builds')
R = os.path.join(REPO, 'docs', 'research')
PG = os.path.join(REPO, 'patch-notes', 'pages')
NOTES_URL = 'https://claude.ai/artifact/Jjqh5F2Qjym1GMBwhA2dSN'   # the patch-notes artifact (cards open #key)

E = lambda s: html.escape(s, quote=True)
TAGS = {'seen': ('t-seen', 'seen'), 'meas': ('t-meas', 'measured'), 'reas': ('t-reas', 'reasoned'), 'no': ('t-no', 'not seen')}


def strip(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()


def bar_html(label, was, now, was_t, now_t, cls=''):
    top = max(abs(was), abs(now)) * 1.08 or 1
    w = lambda v: '%.1f%%' % (max(0, v) / top * 100)
    return ('<div class="bar"><span class="bl">%s</span><span class="track"><span class="fill was" style="width:%s"></span>'
            '<span class="fill now %s" style="width:%s"></span></span><span class="vv"><s>%s</s> &rarr; %s</span></div>'
            % (E(label), w(was), cls, w(now), E(was_t), E(now_t)))


def fig_html(f, ver):
    src, cap, kind = f
    cls = ' class="ph"' if kind == 'ph' else ''
    name = os.path.basename(src).rsplit('.', 1)[0] + '.jpg'
    return ('<figure%s><img src="img/%s" alt="%s" loading="lazy"><figcaption><b>Look at:</b> %s</figcaption></figure>'
            % (cls, name, E(strip(cap)), cap))


def item_html(it, ver):
    tags = ''.join('<span class="tag %s">%s</span>' % TAGS[t] for t in it.get('tags', []))
    rows = ''.join('<div class="row"><div class="rl %s">%s</div><p>%s</p></div>' % (c, l, it[k])
                   for k, c, l in (('problem', 'p', 'Problem'), ('why', 'w', 'Why'), ('fix', 'f', 'Fix')) if it.get(k))
    bars = ''.join(bar_html(*b) for b in it.get('bars', []))
    bars = '<div class="bars">%s</div>' % bars if bars else ''
    figs = it.get('figs', [])
    fh = ''
    if figs:
        phones = all(f[2] == 'ph' for f in figs)
        fh = '<div class="figs%s">%s</div>' % (' pair' if phones and len(figs) == 2 else (' wide' if not phones else ''), ''.join(fig_html(f, ver) for f in figs))
    clip = ''
    if it.get('clip'):
        mp4, poster, look = it['clip']
        clip = ('<figure class="clip"><p class="look"><b>Look for:</b> %s</p><video controls playsinline muted preload="metadata" poster="img/%s" src="clips/%s"></video></figure>'
                % (look, os.path.basename(poster).rsplit('.', 1)[0] + '.jpg', os.path.basename(mp4)))
    more = ''
    if it.get('more'):
        s, pts = it['more']
        more = '<details><summary>%s</summary><ul>%s</ul></details>' % (E(s), ''.join('<li>%s</li>' % p for p in pts))
    return '<div class="item"><div class="ih"><b>%s</b>%s</div>%s%s%s%s%s</div>' % (E(it['h']), tags, rows, bars, fh, clip, more)


SEC = {'fixed': ('fix', 'FIXED'), 'added': ('add', 'ADDED'), 'changed': ('chg', 'CHANGED'), 'known': ('bug', 'KNOWN ISSUES'), 'next': ('nxt', 'NEXT')}


def page_html(p, head):
    out = [head.replace('<title>3D Bodies &amp; Smoother Movement</title>', '<title>%s</title>' % E(p['name']))]
    out.append('<div class="wrap">\n<header>\n  <br>\n  <span class="ver">%s</span>\n  <h1>%s</h1>\n  <p class="status"><i></i>%s</p>\n  <p class="sub">%s In Admin &rarr; Patch notes this is <b>v%s</b>.</p>\n</header>\n'
               % (E(p['eyebrow']), E(p['h1']), p['status'], p['sub'], p['ver']))
    out.append('<h2 class="nxt"><i></i>CHECK THESE</h2>\n<ul class="ck">%s</ul>\n' % ''.join(
        '<li><label><input type="checkbox" data-k="c%d"><span><span class="q">%s</span><span class="a">%s</span></span></label></li>' % (i, E(q), a)
        for i, (q, a) in enumerate(p['check'])))
    for s in p['sections']:
        cls, word = SEC[s['kind']]
        out.append('<h2 class="%s"><i></i>%s%s</h2>' % (cls, word, (': ' + E(s['title'].upper())) if s.get('title') else ''))
        out.append(''.join(item_html(it, p['ver']) for it in s['items']))
        out.append('\n')
    sb = p['seen']
    out.append('<h2 class="bug"><i></i>SEEN / NOT SEEN</h2>\n<div class="sbox">%s</div>\n' % ''.join(
        '<h3 class="%s">%s</h3><ul>%s</ul>' % (c, t, ''.join('<li>%s</li>' % x for x in sb[k]))
        for k, c, t in (('seen', 'g', 'Seen on a screen'), ('meas', 'b', 'Measured (numbers)'), ('reas', 'a', 'Reasoned, not seen'), ('no', 'r', 'Not seen / not done')) if sb.get(k)))
    out.append('<footer>%s</footer>\n</div>\n' % p['footer'])
    out.append('<script>\n(function(){\n  var K=%s, s={};\n  try{ s=JSON.parse(localStorage.getItem(K)||\'{}\')||{}; }catch(e){ s={}; }\n'
               '  var boxes=document.querySelectorAll(\'.ck input\');\n  for(var i=0;i<boxes.length;i++){(function(b){\n'
               '    var id=b.getAttribute(\'data-k\'); if(s[id]) b.checked=true;\n'
               '    b.addEventListener(\'change\',function(){ s[id]=b.checked; try{ localStorage.setItem(K,JSON.stringify(s)); }catch(e){} });\n'
               '  })(boxes[i]);}\n})();\n</script>\n' % json.dumps('kib-pn-%s-checks' % p['ver']))
    return ''.join(out)


def copy_media(p):
    d = os.path.join(PG, p['ver'])
    for sub in ('img', 'clips'):
        if os.path.isdir(os.path.join(d, sub)):
            shutil.rmtree(os.path.join(d, sub))
    os.makedirs(os.path.join(d, 'img'), exist_ok=True)
    for s in p['sections']:
        for it in s['items']:
            srcs = [f[0] for f in it.get('figs', [])]
            if it.get('clip'):
                srcs.append(it['clip'][1])
                os.makedirs(os.path.join(d, 'clips'), exist_ok=True)
                shutil.copy(it['clip'][0], os.path.join(d, 'clips', os.path.basename(it['clip'][0])))
            for src in srcs:
                im = Image.open(src).convert('RGB')
                maxw = 900 if im.width > im.height else 520
                if im.width > maxw:
                    im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
                im.save(os.path.join(d, 'img', os.path.basename(src).rsplit('.', 1)[0] + '.jpg'), quality=80)


def entry(p):
    secs = [{'kind': 'added', 'title': 'Check these', 'items': [{'title': q, 'detail': strip(a)} for q, a in p['check']]}]
    for s in p['sections']:
        items = []
        for it in s['items']:
            d = ' '.join(strip(it[k]) for k in ('problem', 'why', 'fix') if it.get(k))
            items.append({'title': it['h'], 'detail': d})
        secs.append({'kind': s['kind'], 'title': SEC[s['kind']][1].capitalize() + (': ' + s['title'] if s.get('title') else ''), 'items': items})
    return {'version': p['ver'], 'title': "Harry's patch notes: " + p['name'], 'publishedAt': p['at'], 'updatedAt': None,
            'artifactUrl': None, 'summary': p['summary'], 'stats': [{'value': v, 'label': l} for v, l in p['stats']], 'sections': secs}


# ─────────────────────────────────────────────────────────────────────────────
from round_1021_pages import PAGES  # noqa: E402  (the words live in their own file)


def entry_span(text, v):
    m = re.search(r'"version"\s*:\s*"%s"' % re.escape(v), text)
    if not m:
        return None
    i, depth = m.start(), 0
    while i >= 0:
        c = text[i]
        if c == '}':
            depth += 1
        elif c == '{':
            if depth == 0:
                break
            depth -= 1
        i -= 1
    j, d, ins, esc = i, 0, False, False
    while j < len(text):
        c = text[j]
        if ins:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == '"': ins = False
        elif c == '"': ins = True
        elif c == '{': d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                j += 1
                break
        j += 1
    # take the following comma and line break too
    k = j
    while k < len(text) and text[k] in ' ,\n':
        k += 1
    return i, k


def main():
    head = open(os.path.join(PG, '0.94', 'index.html'), encoding='utf-8').read()
    head = head[:head.index('</style>') + len('</style>\n')]
    for p in PAGES:
        copy_media(p)
        open(os.path.join(PG, p['ver'], 'index.html'), 'w', encoding='utf-8').write(page_html(p, head))
        print('page', p['ver'], len(open(os.path.join(PG, p['ver'], 'index.html')).read()) // 1024, 'KB')

    # the archive data: drop old copies of these versions, then put them first (newest first)
    dp = os.path.join(REPO, 'lib', 'patchNotesData.ts')
    data = open(dp, encoding='utf-8').read()
    for p in PAGES:
        sp = entry_span(data, p['ver'])
        if sp:
            data = data[:sp[0]] + data[sp[1]:]
    at = data.index('= [', data.index('BUILT_IN_PATCH_NOTES')) + 3
    block = ''.join('\n    ' + json.dumps(entry(p), indent=2, ensure_ascii=False).replace('\n', '\n    ') + ',' for p in reversed(PAGES))
    rest = data[at:]
    data = data[:at] + block + ('\n    ' + rest.lstrip('\n ') if not rest.startswith('\n    ') else rest)
    open(dp, 'w', encoding='utf-8').write(data)

    # the kept pages' lines
    pp = os.path.join(REPO, 'lib', 'patchNotePages.ts')
    pages = open(pp, encoding='utf-8').read()
    anchor = '  "0.94": "pages/0.94/index.html",'
    lines = ''.join('  "%s": "pages/%s/index.html",\n' % (p['ver'], p['ver']) for p in reversed(PAGES) if ('"%s":' % p['ver']) not in pages)
    if lines:
        pages = pages.replace(anchor, lines + anchor, 1)
        pages = pages.replace('  // 19-20 Oct 2026: the last two days', '  // 21 Oct 2026: Harry\'s notes 0.95h on (round_1021.py). 19-20 Oct 2026: the last two days', 1)
    open(pp, 'w', encoding='utf-8').write(pages)

    # the index cards (patch-notes/pages/0.75): after v0.94's card
    ip = os.path.join(PG, '0.75', 'index.html')
    idx = open(ip, encoding='utf-8').read()
    idx = re.sub(r'<a class="bcard" href="%s#(?:%s)"[^>]*>.*?</a>' % (re.escape(NOTES_URL), '|'.join(p['key'] for p in PAGES)), '', idx, flags=re.S)
    cards = ''.join('<a class="bcard" href="%s#%s" target="_blank" rel="noopener"><div class="n"><b>%s</b><span class="pill p-amb">%s</span></div><p>%s</p><div class="vtag">v%s in Admin &rarr; Patch notes</div><span class="go">Open the notes &rarr;</span></a>'
                    % (NOTES_URL, p['key'], E(p['name']), p['pill'], E(p['card']), p['ver']) for p in PAGES)
    m = re.search(r'(<a class="bcard" href="%s#bodies"[^>]*>.*?</a>)' % re.escape(NOTES_URL), idx, flags=re.S)
    idx = idx[:m.end()] + cards + idx[m.end():]
    # B14 is no longer "still building"
    idx = re.sub(r'<div class="bcard soon"><div class="n"><b>B14 Running after a chance</b>.*?</p></div>', '', idx, flags=re.S)
    open(ip, 'w', encoding='utf-8').write(idx)
    print('data, pages map and index updated:', ', '.join(p['ver'] for p in PAGES))


if __name__ == '__main__':
    main()
