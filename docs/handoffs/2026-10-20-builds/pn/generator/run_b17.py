"""Build the B17 PC Match + Radar page (v0.85) and keep a copy at patch-notes/pages/0.85/.
Usage: PN_OUT=/abs/out python3 run_b17.py
The page has no questions and no how-it-works block (lib.render_page no longer writes them)."""
import os, sys, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from b17 import b17

REPO = os.path.normpath(os.path.join(BASE, '..', '..', '..'))
p, spec = b17()
d, nopen, ndone = write_page(p, spec, '')
kept = os.path.join(REPO, 'patch-notes', 'pages', spec['ver'])
if os.path.isdir(kept):
    shutil.rmtree(kept)
shutil.copytree(d, kept, ignore=shutil.ignore_patterns('files.json', '_preview.html', '*.png'))
print('built', d, '-> kept', kept, 'imgs', len(p.used), 'clips', len(p.clips), 'html', os.path.getsize(os.path.join(d, 'index.html')))
