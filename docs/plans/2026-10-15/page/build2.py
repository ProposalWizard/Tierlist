"""Plan page v3: "which questions need Harry" first.
Usage: python3 build2.py ../planpage/index.html
Data: questions.json (every question, with its tier) is rebuilt from questions.py + tiers_seed.py's
tier sets + plain.py's plain-English text. Edit the tier in tiers_seed.py, then re-run both scripts.
"""
import json, sys, re, html
from collections import OrderedDict
import plain

KEY = 'kib-plans-2026-10-15'   # same storage key as the old page, so answers carry over
GH = 'https://github.com/ProposalWizard/Tierlist/blob/Harry/docs/plans/2026-10-15/%s.md'

raw = json.load(open('qs_tiered_seed.json', encoding='utf-8'))
TOTAL = len(raw)
assert TOTAL == 399, TOTAL

PLANS = OrderedDict([
  ('LAG', dict(name='Lag, speed and bloat', file='lag', chip='Back to Home gets faster, full screen can be turned off, and every chat starts lighter.')),
  ('ADM', dict(name='Admin revamp', file='admin', chip='One admin home and one lock for every test page, with a tester view.')),
  ('PN',  dict(name='Patch notes', file='patchnotes', chip='Each person\'s patch notes get their own numbers, so they never clash again.')),
  ('TB',  dict(name='Team board', file='teamboard', chip='One page shows who pushed what, plus live progress bars from each chat.')),
])

def e(s): return html.escape(s, quote=True)
def clean(s):
    s = s.replace('`', '')
    return s

# ---------- write questions.json (the rebuildable split)
out = []
for q in raw:
    d = dict(id=q['id'], plan=q['plan'], group=q['group'], tier=q['tier'], q=q['q'], rec=q['rec'], ev=q['ev'])
    if q['tier'] == 'need':
        n = plain.NEED[q['id']]
        d.update(plain_q=n['q'], why=n['why'], opts=n.get('opts'), rec_key=n.get('rec'))
    elif q['tier'] == 'quick':
        d.update(plain_q=plain.QUICK[q['id']][0], plain_rec=plain.QUICK[q['id']][1])
    out.append(d)
json.dump(out, open('questions.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

by = {c: {'need': [], 'quick': [], 'house': []} for c in PLANS}
for d in out: by[d['plan']][d['tier']].append(d)
cnt = {t: sum(len(by[c][t]) for c in PLANS) for t in ('need', 'quick', 'house')}

# ---------- diagrams
def diag_commentary():
    rows = [('A', 'As now', 18.5, 'var(--red)'), ('B', '3× faster', 6.2, 'var(--green)'), ('C', 'Jump to chance', 0.4, 'var(--blue)')]
    s = '<svg viewBox="0 0 340 112" width="100%" role="img" aria-label="Waiting time after GET OUT THERE: A 18.5 seconds, B about 6, C almost none">'
    s += '<text x="0" y="12" font-size="11" fill="var(--ink3)" font-weight="700">WAIT AFTER "GET OUT THERE"</text>'
    for i, (k, l, v, c) in enumerate(rows):
        y = 26 + i * 28
        w = max(3, v / 18.5 * 190)
        s += '<text x="0" y="%d" font-size="12" font-weight="800" fill="var(--ink)">%s</text>' % (y + 13, k)
        s += '<text x="16" y="%d" font-size="11.5" fill="var(--ink2)">%s</text>' % (y + 13, l)
        s += '<rect x="112" y="%d" width="190" height="16" rx="5" fill="var(--card2)"/>' % (y + 1)
        s += '<rect x="112" y="%d" width="%.1f" height="16" rx="5" fill="%s"/>' % (y + 1, w, c)
        s += '<text x="308" y="%d" font-size="11.5" fill="var(--ink)" font-weight="700">%s</text>' % (y + 13, ('%.1f s' % v) if k == 'A' else ('≈6 s' if k == 'B' else '≈0 s'))
    return '<figure class="diag">%s</svg></figure>' % s

def diag_fullscreen():
    return '<figure class="fig"><img src="img/fullscreen-no-switch.webp" alt="Settings, Full screen row with only a How? link" loading="lazy"><figcaption>Look at the Full screen row: it only says "How?". There is no switch to turn the look off.</figcaption></figure>'

DIAG = {'commentary': diag_commentary, 'fullscreen': diag_fullscreen}

# ---------- cards
def need_card(d):
    opts = d['opts']; rk = d['rec_key']
    btns = []
    if opts:
        for k, lab in opts:
            star = '<span class="rk">Recommended</span>' if k == rk else ''
            btns.append('<button type="button" class="ob" data-a="%s" aria-pressed="false"><b>%s</b><span>%s</span>%s</button>' % (k, k, e(lab), star))
    else:
        btns.append('<button type="button" class="ob" data-a="y" aria-pressed="false"><b>✓</b><span>Agree</span>%s</button>' % ('<span class="rk">Recommended</span>' if rk == 'y' else ''))
        btns.append('<button type="button" class="ob" data-a="n" aria-pressed="false"><b>✗</b><span>No</span></button>')
    choice = '' if rk else '<div class="yc">Your choice — no recommendation.</div>'
    dk = plain.NEED[d['id']].get('diag'); dg = DIAG[dk]() if dk else ''
    return ('<article class="qi need" data-id="{id}" data-plan="{p}" data-tier="need" data-rec="{rk}">'
            '<div class="qt">{q}</div><div class="why"><b>Why it matters:</b> {why}</div>{dg}{choice}'
            '<div class="ops{oc}">{btns}</div><div class="qf"><button type="button" class="nb" data-a="note" aria-pressed="false">✎ Note</button>'
            '<span class="was" hidden></span><span class="qid">{id}</span></div>'
            '<input class="qn" type="text" maxlength="300" placeholder="One-line note" aria-label="Note for {id}" hidden></article>'
            ).format(id=d['id'], p=d['plan'], rk=rk or '', q=e(d['plain_q']), why=e(d['why']), dg=dg, choice=choice,
                     oc=' abc' if opts else '', btns=''.join(btns))

def small_row(d, q, rec, tier):
    return ('<li class="qi {t}" data-id="{id}" data-plan="{p}" data-tier="{t}" data-rec="y">'
            '<div class="sr"><div class="st"><span class="sq">{q}</span> <span class="sr2">→ {rec}</span></div>'
            '<div class="sb"><button type="button" data-a="y" aria-pressed="false" aria-label="Agree">✓</button>'
            '<button type="button" data-a="n" aria-pressed="false" aria-label="No">✗</button>'
            '<button type="button" class="nb" data-a="note" aria-pressed="false" aria-label="Note">✎</button></div></div>'
            '<div class="sm"><span class="qid">{id}</span></div>'
            '<input class="qn" type="text" maxlength="300" placeholder="One-line note" aria-label="Note for {id}" hidden></li>'
            ).format(t=tier, id=d['id'], p=d['plan'], q=e(q), rec=e(rec))

# ---------- page parts
CSS = open('css2.css', encoding='utf-8').read()

def top():
    o = ['<div class="wrap"><header><span class="ver">PLANS · 16 OCT</span><h1>What needs your answer</h1>'
         '<p class="sub">Four plans, %d questions. Most already have a safe recommended answer. Only the first group needs you to think.</p></header>' % TOTAL]
    o.append('<div class="count"><a href="#need" class="ct need"><b>%d</b><span>need you</span></a>'
             '<a href="#quick" class="ct quick"><b>%d</b><span>quick checks</span></a>'
             '<a href="#house" class="ct house"><b>%d</b><span>housekeeping<br><small>defaults are fine</small></span></a></div>' % (cnt['need'], cnt['quick'], cnt['house']))
    o.append('<p class="hint">Answer the %d first. Then tap "Accept all" on the other two groups, or change any you disagree with. Your answers stay on this phone. Copy them into the chat at the end.</p>' % cnt['need'])
    o.append('<div class="chips">')
    for c, p in PLANS.items():
        n = by[c]
        o.append('<a class="chip" href="#need-%s"><span class="cn">%s</span><span class="co">%s</span><span class="cc">%d need you · %d quick · %d housekeeping</span></a>' % (c, p['name'], p['chip'], len(n['need']), len(n['quick']), len(n['house'])))
    o.append('</div>')
    return '\n'.join(o)

def need_sec():
    o = ['<h2 id="need" class="hn"><i></i>Needs you <span class="pc" data-tc="need"></span></h2>',
         '<p class="lead">Each one changes what you see or play, the order of work, time or money — or needs Leo or Mikey, or the plans disagree.</p>']
    for c, p in PLANS.items():
        L = by[c]['need']
        if not L: continue
        o.append('<h3 class="ph" id="need-%s">%s <span>%d</span></h3>' % (c, p['name'], len(L)))
        o.extend(need_card(d) for d in L)
    return '\n'.join(o)

def quick_sec():
    o = ['<h2 id="quick" class="hq"><i></i>Quick checks <span class="pc" data-tc="quick"></span></h2>',
         '<p class="lead">Each has a recommendation and a small effect. Read the line; tap ✗ only where you disagree.</p>',
         '<button type="button" class="btn pri wide" data-acc="quick">Accept all quick checks</button><div class="accmsg" data-am="quick" role="status"></div>']
    for c, p in PLANS.items():
        L = by[c]['quick']
        if not L: continue
        o.append('<h3 class="ph">%s <span>%d</span></h3><ul class="sl">' % (p['name'], len(L)))
        o.extend(small_row(d, d['plain_q'], d['plain_rec'], 'quick') for d in L)
        o.append('</ul>')
    return '\n'.join(o)

def house_sec():
    o = ['<h2 id="house" class="hh"><i></i>Housekeeping <span class="pc" data-tc="house"></span></h2>',
         '<p class="lead">Note titles, dates, renumbers, page wiring, page locks that follow the rule above, and removing dead files. Nothing a player sees changes.</p>',
         '<div class="hk">']
    for c, p in PLANS.items():
        L = by[c]['house']
        if L: o.append('<div class="hkr"><span>%s</span><b>%d</b></div>' % (p['name'], len(L)))
    o.append('</div><button type="button" class="btn pri wide" data-acc="house">Accept all housekeeping</button><div class="accmsg" data-am="house" role="status"></div>')
    o.append('<details class="hl"><summary>Show list (%d)</summary>' % cnt['house'])
    for c, p in PLANS.items():
        L = by[c]['house']
        if not L: continue
        o.append('<h3 class="ph">%s <span>%d</span></h3><ul class="sl">' % (p['name'], len(L)))
        for d in L:
            rec = clean(d['rec']).rstrip('.')
            if rec.lower().startswith('yes, as written'): rec = 'Yes'
            o.append(small_row(d, clean(d['q']), rec, 'house'))
        o.append('</ul>')
    o.append('</details>')
    return '\n'.join(o)

def next_sec():
    return '''<h2 id="next" class="hx"><i></i>What happens next</h2>
<ol class="pts">
<li><b>You answer and paste.</b> The "Needs you" cards first, then accept or change the rest. Tap Copy and paste into the chat.</li>
<li><b>We update the four plans, then design.</b> Higgsfield pictures of the admin home, the archive and the team board before anything is built.</li>
<li><b>Build one piece per chat, each signed off:</b> 0 notes-file trim → 1 full-screen fix → 2 lag quick wins → 3 patch notes → 4 admin → 5 team board → 6 code and file clean-up.</li>
<li><b>Piece 7: the lag re-check.</b> The same measuring script on every screen, after everything. Any screen slower than its piece-2 result is a bug to fix first.</li>
</ol>'''

def bar(lb, was, now, mx, txt, cls=''):
    w = min(100, was / mx * 100)
    if now is None:
        return '<div class="bar"><span class="lb">%s</span><div class="tr"><div class="fl now %s" style="width:%.1f%%"></div></div><span class="vv">%s</span></div>' % (lb, cls or 'warn', w, txt)
    n = min(100, now / mx * 100)
    return '<div class="bar"><span class="lb">%s</span><div class="tr"><div class="fl was" style="width:%.1f%%"></div><div class="fl now %s" style="width:%.1f%%"></div></div><span class="vv">%s</span></div>' % (lb, w, cls, n, txt)

def bg_sec():
    o = ['<h2 id="bg" class="hx"><i></i>Background (for reference)</h2>',
         '<p class="lead">Grey = today, green = after the plan. Full detail lives in each plan file.</p>']
    B = {
     'LAG': ('Measured on a phone-sized build with the processor slowed 4×. This computer has no graphics chip, so 3D numbers are worse than a phone: read them as before and after only. Back to Home takes 4–14 s because the Home player is rebuilt every time. Full screen cannot be turned off. Every chat reads about 107k tokens of notes before it starts.',
             [bar('First 2D → 3D', 40.1, 10.1, 45, '<s>40 s</s> ≈10 s'), bar('Garden opens', 12.0, 4.4, 45, '<s>12 s</s> ≈4.4 s'),
              bar('Home first load', 4.07, 3.24, 4.07, '<s>4.0 MB</s> ≈3.2 MB'), bar('Notes per chat', 107, 25, 107, '<s>107k</s> ≤25k')]),
     'ADM': ('69 admin and test pages, five different kinds of lock, and 28 pages with no lock at all. The plan: one page list that the build checks, one lock, an admin home with search and filters, and a tester view. No page is deleted; 15 move to "Old tests".',
             [bar('Pages with no lock', 28, 0, 28, '<s>28</s> 0'), bar('Testers can open', 52, 43, 52, '<s>52</s> 43'),
              bar('Missing from the menu', 13, 0, 13, '<s>13</s> 0'), bar('Pages with no guide', 6, 0, 6, '<s>6</s> 0')]),
     'PN': ('Three people shared one number line, so numbers clashed 15 times. The plan: each note is named by its author and their own number ("harry-v0.56"); old site numbers still open as links. 7 rounds that never had a note get one, and missing pages are copied back where they still exist.',
             [bar('Notes listed', 58, 65, 65, '<s>58</s> 65', ''), bar('Number clashes', 15, 0, 15, '<s>15</s> 0'),
              bar('Notes with no full page', 13, 1, 13, '<s>13</s> ≈1 (v0.51)')]),
     'TB': ('An admin page for the team. Step 1 shows pushes, pull requests and the deploy from GitHub, with no setup (about 2.5 h to build). Step 2 adds live progress bars from each chat, sent automatically; it needs Mikey to run one database file and add a secret (about 3 h more).',
             [bar('Tokens a day per person', 50, 0, 50, '<s>≈50k</s> 0 (automatic)')]),
    }
    for c, p in PLANS.items():
        t, bars = B[c]
        o.append('<div class="bgc"><h3>%s</h3><p>%s</p><div class="bars">%s</div><a class="gh" href="%s" target="_blank" rel="noopener">Read the full plan on GitHub →</a></div>' % (p['name'], t, ''.join(bars), GH % p['file']))
    o.append('<p class="foot">16 Oct 2026. Nothing in the game or the site has changed from these plans yet. Note on "Notes with no full page": ≈1 assumes every copy-back works; reasoned, not checked.</p></div>')
    return '\n'.join(o)

def bar_sticky():
    return ('<div class="cbar" id="cbar"><div class="cnt"><b id="cnt">0 of %d answered</b><small id="cmsg" role="status"></small></div>'
            '<button type="button" class="btn tog" id="fun" aria-pressed="false">Unanswered</button>'
            '<button type="button" class="btn pri" id="copy">Copy my answers</button></div><textarea id="cpy" hidden readonly aria-label="Your answers"></textarea>' % TOTAL)

JS = open('js2.js', encoding='utf-8').read().replace('__KEY__', KEY)

page = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<title>Knowitball Plan Questions</title><style>' + CSS + '</style>'
        + top() + need_sec() + quick_sec() + house_sec() + next_sec() + bg_sec() + bar_sticky() + '<script>' + JS + '</script>')
open(sys.argv[1], 'w', encoding='utf-8').write(page)
print(len(page.encode()) // 1024, 'KB', cnt, {c: {t: len(by[c][t]) for t in by[c]} for c in PLANS})
