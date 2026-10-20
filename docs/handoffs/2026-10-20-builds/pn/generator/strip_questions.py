"""Take the questions and the how-it-works block out of the kept patch-notes pages (Harry, 20 Oct: "'How these patch notes
work' doesn't need to be on every page, and you can remove the questions into a separate artifact").

Usage: python3 strip_questions.py            (from anywhere; edits patch-notes/pages/<version>/index.html in place)

For each of the 24 pages (0.60 to 0.84):
  - removes the "HOW THESE PATCH NOTES WORK" block (heading + drawing + 5 steps)
  - removes the NEEDS YOUR OK and ALREADY DECIDED sections (everything from the id="ok" heading up to the footer)
  - removes the header chips that pointed at them ("N need your OK", "N decided", "How this works")
For the index (0.75):
  - the how-it-works block becomes ONE small closed toggle near the top (keep_how_once)
  - the combined NEEDS YOUR OK / ALREADY DECIDED sections become one line that links the Patch Notes Questions artifact
  - the "N need your OK" pills on the cards go (the questions live in the other artifact now)
The questions themselves are in questions_data.py (they were read off these pages first; see build_questions.py).
Safe to run twice: a page with nothing left to strip is skipped.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PG = os.path.join(REPO, 'patch-notes', 'pages')

PAGES = ['0.60', '0.61', '0.62', '0.63', '0.64', '0.65', '0.66', '0.67', '0.68', '0.69', '0.70', '0.71', '0.72', '0.73', '0.74',
         '0.76', '0.77', '0.78', '0.79', '0.80', '0.81', '0.82', '0.83', '0.84']

RE_CHIPS = re.compile(r'<a class="chip(?: hot)?" href="#(?:ok|how)">[^<]*</a>')
RE_HOW = re.compile(r'\s*<h2 class="nxt" id="how"><i></i>HOW THESE PATCH NOTES WORK</h2><div class="how">.*?<p class="where">.*?</p></div>', re.S)
RE_OK = re.compile(r'\s*<h2 class="bug" id="ok">.*?(?=\s*<footer>)', re.S)


def strip_page(h):
    """Return (new html, did something). Every part must be found exactly once, or the page is not the shape this expects."""
    if 'id="ok"' not in h and 'id="how"' not in h:
        return h, False
    assert len(RE_HOW.findall(h)) == 1, 'how block'
    assert len(RE_OK.findall(h)) == 1, 'ok section'
    h = RE_HOW.sub('', h, count=1)
    h = RE_OK.sub('', h, count=1)
    n = len(RE_CHIPS.findall(h))
    assert n in (2, 3), 'chips %d' % n   # the OK chip, the How chip, and a Decided chip when something was decided
    h = RE_CHIPS.sub('', h)
    assert 'id="ok"' not in h and 'id="how"' not in h and 'href="#ok"' not in h and 'href="#how"' not in h
    return h, True


if __name__ == '__main__':
    done = 0
    for v in PAGES:
        p = os.path.join(PG, v, 'index.html')
        h = open(p, encoding='utf-8').read()
        new, changed = strip_page(h)
        if changed:
            open(p, 'w', encoding='utf-8').write(new)
            done += 1
            print(v, len(h), '->', len(new))
        else:
            print(v, 'nothing to strip')
    print('pages changed', done)
