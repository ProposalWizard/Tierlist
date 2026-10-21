"""Patch note 0.104h (nav). Usage: python3 -I round_nav.py   (reuses round_1021's builders; touches only 0.104h)."""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import round_1021 as r
from round_nav_pages import PAGES
r.PAGES = PAGES
r.main()
# put the card after the newest existing card (0.102h) instead of after v0.94's
ip = os.path.join(r.PG, '0.75', 'index.html')
idx = open(ip, encoding='utf-8').read()
card = re.search(r'<a class="bcard" href="%s#nav"[^>]*>.*?</a>' % re.escape(r.NOTES_URL), idx, flags=re.S)
if card:
    c = card.group(0)
    idx = idx.replace(c, '', 1)
    m = re.search(r'<a class="bcard" href="%s#b20"[^>]*>.*?</a>' % re.escape(r.NOTES_URL), idx, flags=re.S)
    idx = idx[:m.end()] + c + idx[m.end():]
    open(ip, 'w', encoding='utf-8').write(idx)
