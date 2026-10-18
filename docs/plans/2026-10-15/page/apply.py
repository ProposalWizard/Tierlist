"""Rebuild the plan-questions page: drop answered questions, add Harry's extra info.
Usage: python3 apply.py out.html   (reads base.html, answers.json, extra.json here)"""
import json, re, sys, html, datetime
here = __file__.rsplit('/', 1)[0] or '.'
s = open(f'{here}/base.html').read()
ans = json.load(open(f'{here}/answers.json'))
extra = json.load(open(f'{here}/extra.json'))
import os
repl = json.load(open(f'{here}/replace.json')) if os.path.exists(f'{here}/replace.json') else {}
lines = s.split('\n')
answered = []  # (id, question text, answer)
out = []
for ln in lines:
    m = re.match(r'<(article|li) class="qi [a-z]+" data-id="([^"]+)"', ln)
    if m and m.group(2) in ans:
        qid = m.group(2)
        q = re.search(r'class="(?:qt|sq)">(.*?)</(?:div|span)>', ln)
        answered.append((qid, re.sub('<[^>]+>', '', q.group(1)) if q else qid, ans[qid]))
        continue
    if m and m.group(2) in repl:
        ln = repl[m.group(2)]
    if m and m.group(2) in extra:
        ln = re.sub(r'(<div class="why">.*?)(</div>)', lambda mm: mm.group(1) + extra[m.group(2)] + mm.group(2), ln, count=1)
    out.append(ln)
s = '\n'.join(out)
assert all(k not in s or ('data-id="%s"' % k) not in s for k in ans), 'removal failed'
# counts
def count(tier, plan=None):
    pat = r'class="qi %s" data-id="[^"]+" data-plan="%s"' % (tier, plan or '[A-Z]+')
    return len(re.findall(pat, s))
need, quick, house = count('need'), count('quick'), count('house')
total = need + quick + house
s = re.sub(r'(<a href="#need" class="ct need"><b>)\d+', r'\g<1>%d' % need, s)
s = re.sub(r'(<a href="#quick" class="ct quick"><b>)\d+', r'\g<1>%d' % quick, s)
s = re.sub(r'(<a href="#house" class="ct house"><b>)\d+', r'\g<1>%d' % house, s)
s = re.sub(r'Answer the \d+ first', 'Answer the %d first' % need, s)
s = re.sub(r'Four plans, \d+ questions[^<]*', 'Four plans: %d questions left, %d answered. Answered ones are gone from the page; the list is at the bottom.' % (total, len(answered)), s)
s = re.sub(r'<span class="ver">[^<]*</span>', '<span class="ver">PLANS · UPDATED %s</span>' % datetime.date.today().strftime('%-d %b').upper(), s)
for plan in ['LAG', 'ADM', 'PN', 'TB']:
    n, q, h = count('need', plan), count('quick', plan), count('house', plan)
    s = re.sub(r'(<a class="chip" href="#need-%s">.*?<span class="cc">)[^<]*' % plan, r'\g<1>%d need you · %d quick · %d housekeeping' % (n, q, h), s)
    s = re.sub(r'(<h3 class="ph" id="need-%s">[^<]*<span>)\d+' % plan, r'\g<1>%d' % n, s)
# drop empty need headers
s = re.sub(r'<h3 class="ph" id="need-[A-Z]+">[^<]*<span>0</span></h3>\n', '', s)
s = s.replace('0 of 399 answered', '0 of %d answered' % total)
# answered list
rows = ''.join('<li><span class="qid">%s</span> %s <b>→ %s%s</b></li>' % (i, html.escape(t), html.escape(a['a']), (' ' + html.escape(a['note'])) if a['note'] else '') for i, t, a in answered)
block = ('<h2 class="hx" id="answered"><i></i>Answered so far <span class="pc">%d</span></h2>'
         '<details class="hl"><summary>Show your %d answers</summary><ul class="pts" style="list-style:none;padding:0">%s</ul></details>\n' % (len(answered), len(answered), rows))
s = s.replace('<p class="foot">', block + '<p class="foot">', 1)
if quick == 0:
    i = s.find('<h2 id="quick"'); j = s.find('<h2 id="house"')
    if i > 0 and j > i: s = s[:i] + s[j:]
if house == 0:
    i = s.find('<h2 id="house"'); j = s.find('<h2 id="next"')
    if i > 0 and j > i: s = s[:i] + s[j:]
if quick == 0 and house == 0:
    s = re.sub(r'<a href="#quick" class="ct quick">.*?</a><a href="#house" class="ct house">.*?</a>', '', s, flags=re.S)
    s = re.sub(r'<p class="hint">.*?</p>', '<p class="hint">Only these are left. Answer them and paste them into the chat.</p>', s, count=1, flags=re.S)
open(sys.argv[1], 'w').write(s)
print('left', total, 'need', need, 'quick', quick, 'house', house, 'answered', len(answered))
