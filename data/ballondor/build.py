import json, re, html, os
from html.parser import HTMLParser
B = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(f'{B}/rankings_parsed.json'))
N = json.load(open(f'{B}/notes.json'))
src = open(f'{B}/snippets.py').read()
W = eval(src[src.index('W={') + 2: src.index('\n}\n') + 2].replace('# slug: (aliases, years)', ''))
FILES = {f[:-4] for f in os.listdir(f'{B}/players') if f.endswith('.txt')}
FIX = {'gerd-muller': 'gerd-mueller', 'lothar-matthaus': 'lothar-matthaeus', 'ronaldo-nazario': 'ronaldo'}

def slugfile(s):
    s = FIX.get(s, s)
    m = [f for f in FILES | {'raymond-kopa-7986820'} if re.fullmatch(re.escape(s) + r'-\d+', f)]
    return m[0] if m else None

YEAR2SLUG = {}
for s, (_, ys) in W.items():
    for y in ys:
        YEAR2SLUG[y] = s

class T(HTMLParser):
    def __init__(s): super().__init__(); s.out = []; s.skip = 0
    def handle_starttag(s, t, a):
        if t in ('script', 'style'): s.skip += 1
    def handle_endtag(s, t):
        if t in ('script', 'style'): s.skip -= 1
    def handle_data(s, d):
        if not s.skip and d.strip(): s.out.append(d.strip())

def lines_for(f):
    p = f'{B}/players/{f}.txt'
    if os.path.exists(p):
        return [l.strip() for l in open(p) if l.strip()]
    t = T(); t.feed(open(f'{B}/articles/_players_{f.replace("-", "_")}').read()); return t.out

LABELS = ['POSITION', 'CLUB', 'COUNTRY', 'DATE OF BIRTH', 'HEIGHT', 'WEIGHT']
STOP = re.compile(r"(Performance|Efficiency|MORE STATS|^His |Statistics|Ballon d'Or PRESS|Information)", re.I)

def profile(f):
    L = lines_for(f)
    P = {}
    for i, l in enumerate(L[:80]):
        if l in LABELS and i + 1 < len(L) and L[i + 1] not in LABELS:
            P.setdefault(l, L[i + 1])
    hon, season, slabel, bio = [], [], None, None
    if 'The Golden Race: two decades of legendary champions' in L or any('ON TAPE' in l for l in L):
        start = next((i for i, l in enumerate(L) if l.endswith('ON TAPE')), None)
        if start is not None:
            i = start + 1
            while i < len(L) and not L[i][0].isdigit() and not re.match(r'His \d{4}', L[i]): i += 1
            while i + 1 < len(L) and re.fullmatch(r'\d+', L[i]) and not STOP.search(L[i + 1]):
                hon.append((L[i], L[i + 1])); i += 2
    for i, l in enumerate(L):
        if re.match(r'His \d{4}-\d{4} season', l):
            slabel = l.rstrip(':')
            j = i + 1
            while j + 1 < len(L) and re.fullmatch(r'\d+', L[j]):
                season.append((L[j], L[j + 1])); j += 2
        if bio is None and len(l) > 160 and ('born' in l.lower()):
            bio = l
    return P, hon, slabel, season, bio

STATS = {
    1963: 'Partial: conceded 6 goals in 27 matches for Dynamo Moscow in the 1963 Soviet league.',
    1988: 'Partial: 19 matches and 8 goals in his first AC Milan season, after ankle surgery.',
    1997: '1996-97: 49 matches, 47 goals for Barcelona.',
    2002: 'Partial: 8 goals at the 2002 World Cup (Golden Boot), 2 in the final.',
    2023: '2022-23: 54 matches, 38 goals, 25 assists.',
    2024: '2023-24: 63 matches, 12 goals, 14 assists, 15 yellow cards, 1 red card.',
    2025: '2024-25: 60 matches, 37 goals, 15 assists, 5 yellow cards, 1 red card. (A second article says 35 goals.)',
}
CL = {1957,1958,1959,1968,1969,1971,1973,1976,1985,1989,2007,2008,2009,2011,2014,2015,2016,2017,2018,2022,2025}
WC = {1966, 1982, 1990, 1998, 2002, 2006, 2023}
NONE = {1956, 1964, 1970, 1978, 2000, 2013}

def name(row): return ' '.join(row[1:-2])
e = html.escape
counts = {}
for y in sorted(int(k) for k in R):
    if R[str(y)]:
        n = name(R[str(y)][0]); counts[n] = counts.get(n, 0) + 1

cards = []
running = {}
for y in range(1956, 2026):
    rows = R.get(str(y))
    if not rows:
        cards.append(f'''<details class="yr gap" data-dec="{y//10*10}" data-q="{y} no award"><summary><span class="y">{y}</span><span class="who"><b>No Ballon d'Or</b><small>The site lists no ranking for {y}.</small></span></summary></details>''')
        continue
    w = rows[0]; wn = name(w); running[wn] = running.get(wn, 0) + 1
    slug = YEAR2SLUG.get(y); f = slugfile(slug) if slug else None
    P, hon, slabel, season, bio = profile(f) if f else ({}, [], None, [], None)
    notes = list(dict.fromkeys(N.get(str(y), [])))
    tags = []
    if y in CL: tags.append('<span class="tag cl">Won European Cup / Champions League</span>')
    if y in WC: tags.append('<span class="tag wc">Won the World Cup</span>')
    if y in NONE: tags.append('<span class="tag no">No trophy that year</span>')
    if y in STATS: tags.append('<span class="tag st">Season stats on site</span>')
    nth = f'{running[wn]} of {counts[wn]}' if counts[wn] > 1 else ''
    pod = ''.join(f'<li><span class="pl">{r[0]}</span><span class="pn">{e(name(r))}</span><span class="pc">{e(r[-2])} · {e(r[-1])}</span></li>' for r in rows[:3])
    rest = ''.join(f'<li><span class="pl">{r[0]}</span><span class="pn">{e(name(r))}</span><span class="pc">{e(r[-2])} · {e(r[-1])}</span></li>' for r in rows[3:])
    stat = f'<p class="stat">{e(STATS[y])}</p>' if y in STATS else '<p class="none">Not on ballondor.com. The site gives no games, goals or assists for this winning season.</p>'
    prof = ''.join(f'<div><dt>{k.title()}</dt><dd>{e(v)}</dd></div>' for k, v in P.items() if v and v != '-' and k != 'CLUB')
    hons = ''.join(f'<li><b>{a}</b> {e(b)}</li>' for a, b in hon)
    cur = ''
    if season:
        cur = f'<p class="lab">{e(slabel)} (now, not the winning year)</p><ul class="hon">' + ''.join(f'<li><b>{a}</b> {e(b)}</li>' for a, b in season) + '</ul>'
    link = f'https://ballondor.com/players/{f}' if f else 'https://ballondor.com/winners'
    first = e(notes[0]) if notes else ''
    q = f'{y} {wn} {w[-2]} {w[-1]}'.lower()
    cards.append(f'''<details class="yr" data-dec="{y//10*10}" data-q="{e(q)}">
<summary><span class="y">{y}</span><span class="who"><b>{e(wn)}</b><small>{e(w[-2])} · {e(w[-1])}{' · win ' + nth if nth else ''}</small></span></summary>
<div class="body">
<div class="tags">{''.join(tags)}</div>
<p class="lab">Podium (points not shown on the ranking page)</p><ol class="pod">{pod}</ol>
{f'<details class="in"><summary>Full ranking ({len(rows)} players)</summary><ol class="pod">{rest}</ol></details>' if rest else ''}
<p class="lab">That year, per the site</p>
<ul class="facts">{''.join(f'<li>{e(n)}</li>' for n in notes) or '<li class="none">The site has no articles on this win beyond the ranking.</li>'}</ul>
<p class="lab">Winning-season stats</p>{stat}
{f'<p class="lab">Player card</p><dl class="prof">{prof}</dl>' if prof else ''}
{f'<p class="lab">Career honours (player page)</p><ul class="hon">{hons}</ul>' if hons else ''}
{cur}
{f'<details class="in"><summary>Site bio</summary><p class="bio">{e(bio)}</p></details>' if bio else ''}
<a class="src" href="{link}" target="_blank" rel="noopener">Player page on ballondor.com ↗</a>
</div></details>''')

page = open(f'{B}/template.html').read().replace('<!--CARDS-->', '\n'.join(reversed(cards)))
open(f'{B}/ballondor.html', 'w').write(page)
print('cards', len(cards), 'missing slug', [y for y in range(1956, 2026) if R.get(str(y)) and not slugfile(YEAR2SLUG.get(y, 'x') or 'x')])
