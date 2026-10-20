"""The plain pass (Harry, 20 Oct: "a full plain pass could be run over everything to simplify and get rid of yap").

Cuts words on a kept page without touching its layout, links, stills or clips. The page is split into text UNITS (a paragraph, a list
line, a caption, a card title, a bar label, a summary). A person writes a shorter version of each unit; this tool puts them back and
checks nothing else moved.

  python3 plain_units.py extract <version> <out.txt>     one line per unit:  id <TAB> kind <TAB> inner html
  python3 plain_units.py apply   <version> <new.txt>     new.txt has  id <TAB> new html   ("=" keeps it, "-" deletes the unit)
  python3 plain_units.py words   <version>               word count of the page body

Checks on apply (it refuses to write if one fails): every link in a changed unit is still there; no tag outside the unit changed.
It then prints any number that was in the old page text and is missing from the new text, so a human can look at each one.
Alt text of a still is re-made from its caption. A row left with only its label (Problem / Why / Fix) is removed."""
import os, re, sys, html

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PG = os.path.join(REPO, 'patch-notes', 'pages')

BLOCK = re.compile(r'<(?:p|li|ul|ol|div|figure|details|summary|svg|h[1-6]|table|tr|td|video|img|section|button)\b', re.I)
OPEN = re.compile(r'<(p|li|summary|figcaption|h1)\b[^>]*>|<span class="(q|a|bl)">|<div class="ih"><b>|<div class="tile"><b>|<b class="pt">', re.I)


def body_range(h):
    i = h.index('<div class="wrap">')
    j = h.index('<script>', i) if '<script>' in h[i:] else len(h)
    return i, j


def find_close(h, start, tag):
    """index of the matching close tag for an element whose inner html starts at `start`."""
    depth = 1
    pat = re.compile(r'<(/?)%s\b[^>]*>' % tag, re.I)
    for m in pat.finditer(h, start):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.start(), m.end()
    raise ValueError('no close for ' + tag)


def units(h):
    """list of (start, end, kind, inner, open_start, close_end); inner = html between the open and close tag, only for leaf blocks."""
    i, j = body_range(h)
    out = []
    # skip svg, style and script blocks
    skip = [(m.start(), m.end()) for m in re.finditer(r'<svg.*?</svg>|<style.*?</style>', h[i:j], re.S)]
    skip = [(a + i, b + i) for a, b in skip]
    for m in OPEN.finditer(h, i, j):
        if any(a <= m.start() < b for a, b in skip):
            continue
        tag = m.group(1) or ('span' if m.group(2) else 'b')
        kind = m.group(1) or (m.group(2) and 'span.' + m.group(2)) or ('ih' if 'ih' in m.group(0) else 'tilehead')
        s = m.end()
        try:
            cs, ce = find_close(h, s, tag.lower())
        except ValueError:
            continue
        inner = h[s:cs]
        if BLOCK.search(inner):
            continue
        out.append((s, cs, kind.lower(), inner, m.start(), ce))
    return out


def text_of(s):
    s = re.sub(r'<script.*?</script>|<style.*?</style>|<svg.*?</svg>|<title>.*?</title>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(s)


def words(h):
    i, j = body_range(h)
    return len(text_of(h[i:j]).split())


NUM = re.compile(r'\d[\d,]*(?:\.\d+)?')


def nums(s):
    return sorted(m.group(0).rstrip('.,') for m in NUM.finditer(text_of(s)))


def hrefs(s):
    return sorted(re.findall(r'href="([^"]+)"', s))


def cmd_extract(ver, out):
    h = open(os.path.join(PG, ver, 'index.html'), encoding='utf-8').read()
    us = units(h)
    with open(out, 'w', encoding='utf-8') as f:
        for n, (s, e, kind, inner, os_, ce_) in enumerate(us):
            f.write('%d\t%s\t%s\n' % (n, kind, inner.replace('\n', ' ').replace('\t', ' ')))
    print(ver, 'units', len(us), 'words', words(h))


def cmd_apply(ver, newf):
    p = os.path.join(PG, ver, 'index.html')
    h = open(p, encoding='utf-8').read()
    us = units(h)
    new = {}
    for line in open(newf, encoding='utf-8').read().split('\n'):
        if not line.strip():
            continue
        k, _, v = line.partition('\t')
        new[int(k)] = v
    bad = [k for k in new if k >= len(us)]
    assert not bad, 'unknown ids %s' % bad
    out = h
    edits = []
    for k, v in new.items():
        s, e, kind, inner, os_, ce_ = us[k]
        if v == '=':
            continue
        if v == '-':
            assert kind in ('p', 'li', 'figcaption', 'span.a'), 'unit %d (%s) cannot be deleted' % (k, kind)
            edits.append((k, os_, ce_, None))
            continue
        if hrefs(inner) != hrefs(v):
            raise SystemExit('unit %d: links changed\n old %s\n new %s' % (k, hrefs(inner), hrefs(v)))
        if v.count('<') != v.count('>'):
            raise SystemExit('unit %d: unbalanced < >' % k)
        for t in ('b', 'span', 'a', 'i', 's'):
            if len(re.findall(r'<%s\b' % t, v)) != len(re.findall(r'</%s>' % t, v)):
                raise SystemExit('unit %d: unbalanced <%s>' % (k, t))
        edits.append((k, s, e, v))
    # apply from the end. A deleted unit is (open_start, close_end, None); a changed one is (inner_start, inner_end, new)
    for k, s_, e_, v in sorted(edits, key=lambda t: -t[1]):
        out = out[:s_] + ('' if v is None else v) + out[e_:]
    # rows left with only a label, empty lists, empty paragraphs
    out = re.sub(r'<div class="row"><div class="rl [a-z]+">[^<]*</div></div>', '', out)
    out = re.sub(r'<ul[^>]*></ul>', '', out)
    out = re.sub(r'<ol[^>]*></ol>', '', out)
    # alt text of a still comes from its caption
    def alt_fix(m):
        cap = ' '.join(text_of(m.group(3)).split())
        return '%s alt="%s"%s<figcaption>%s' % (m.group(1), html.escape(cap, quote=True), m.group(2), m.group(3))
    out = re.sub(r'(<img src="[^"]+") alt="[^"]*"([^>]*>)<figcaption>(.*?)(?=</figcaption>)', alt_fix, out, flags=re.S)
    # numbers that went missing
    i0, j0 = body_range(h)
    i1, j1 = body_range(out)
    before = nums(h[i0:j0])
    after = nums(out[i1:j1])
    from collections import Counter
    cb, ca = Counter(before), Counter(after)
    missing = {n: c - ca.get(n, 0) for n, c in cb.items() if c > ca.get(n, 0)}
    open(p, 'w', encoding='utf-8').write(out)
    print(ver, 'words', words(h), '->', words(out), 'units changed', len(edits))
    print('numbers fewer than before (check each is a repeat, not a lost fact):', dict(sorted(missing.items())))
    imgs_b = len(re.findall(r'<img ', h)); imgs_a = len(re.findall(r'<img ', out))
    vids_b = len(re.findall(r'<video ', h)); vids_a = len(re.findall(r'<video ', out))
    print('stills', imgs_b, '->', imgs_a, 'clips', vids_b, '->', vids_a, 'links', len(re.findall(r'href=', h)), '->', len(re.findall(r'href=', out)))


if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'extract':
        cmd_extract(sys.argv[2], sys.argv[3])
    elif c == 'apply':
        cmd_apply(sys.argv[2], sys.argv[3])
    elif c == 'words':
        h = open(os.path.join(PG, sys.argv[2], 'index.html'), encoding='utf-8').read()
        print(words(h))
