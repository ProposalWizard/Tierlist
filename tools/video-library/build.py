# Knowitball video library: one page with every video we have made, so nobody has to scroll back through chats
# (Mikey, 11 Nov 2026). Finds every mp4 under docs/marketing/videos/, makes a small phone-sized copy and a cover picture
# for each, and writes index.html with search, filters, a player and the Instagram link when posted.
#   python3 tools/video-library/build.py OUTDIR      -> OUTDIR/index.html, OUTDIR/v/*.mp4, OUTDIR/p/*.jpg, OUTDIR/batches.json
# Then publish OUTDIR as the "Knowitball video library" artifact (index.html + every file under v/ and p/), in a few calls
# (at most 64 MB per call). Re-run after new videos: only new or changed videos are re-encoded.
import json, os, re, subprocess, sys, hashlib, html
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); OUT = os.path.abspath(sys.argv[1])
os.makedirs(OUT + '/v', exist_ok=True); os.makedirs(OUT + '/p', exist_ok=True)
board = json.load(open(R + '/marketing/board.json')); cards = board['cards'] if isinstance(board, dict) and 'cards' in board else board
bycard = {c['video']: c for c in cards if c.get('video')}
batch_info = {}
for bj in __import__('glob').glob(R + '/docs/marketing/videos/*/batch.json'):
    for x in json.load(open(bj)): batch_info[os.path.join(os.path.dirname(bj), x['file'])] = x
def dur(p): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip() or 0)
items = []
for root, _, fs in os.walk(R + '/docs/marketing/videos'):
    for f in sorted(fs):
        if not f.endswith('.mp4'): continue
        full = os.path.join(root, f); rel = os.path.relpath(full, R); folder = os.path.relpath(root, R + '/docs/marketing/videos')
        key = hashlib.sha1(rel.encode()).hexdigest()[:10]; mt = os.path.getmtime(full)
        v, p = f'v/{key}.mp4', f'p/{key}.jpg'
        stamp = OUT + f'/v/{key}.src'
        if not (os.path.exists(OUT + '/' + v) and os.path.exists(stamp) and open(stamp).read() == str(mt)):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', full, '-vf', 'scale=540:960', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
                            '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', OUT + '/' + v], check=True)
            open(stamp, 'w').write(str(mt))
        d = dur(full)
        if not os.path.exists(OUT + '/' + p):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(min(1.6, d / 3)), '-i', full, '-frames:v', '1', '-vf', 'scale=270:480', '-q:v', '5', OUT + '/' + p], check=True)
        top = rel.split('/')[3] if rel.count('/') >= 4 else ''   # docs/marketing/videos/<folder>/...
        c = bycard.get(rel) or next((cc for cc in cards if cc.get('video') and os.path.dirname(cc['video']) == os.path.dirname(rel)), None) \
            or next((cc for cc in cards if cc.get('video') and cc['video'].split('/')[3:4] == [top]), None) \
            or next((cc for cc in cards if top and top in json.dumps(cc)), None)
        b = batch_info.get(full)
        title = (f"{b['player']} {b['season'][2:]} → {b['twin']} {b['twinSeason'][2:]} ({b['match']}%)" if b else
                 (c['title'] if c and c.get('video') == rel else (c['title'] + ' · ' + f if c else f)))
        if c and c.get('video') == rel: pass
        elif c and not b:
            extra = re.sub(r'^knowitball-|\.mp4$', '', f)
            title = c['title'] + (' · ' + ('motion style' if 'motion' in extra else '45 s cut' if '45s' in extra else 'first style' if extra == folder else extra))
        if title.endswith('.mp4'): title = re.sub(r'^knowitball-|\.mp4$', '', f).replace('-', ' ')
        links = [l for l in (c.get('links') or [])] if c else []
        if c and c.get('video') != rel and not b: links = []   # a card's Instagram link belongs to the video it posted
        if b: links = [l for l in links if b['player'].split()[-1].lower() in l['label'].lower()]
        posted = bool(links) or (c and c.get('stage') == 'posted' and c.get('video') == rel)
        kind = ('Stat Twins' if 'twin' in folder or 'twins' in folder else 'Replace him' if 'replace' in folder else 'Other')
        items.append({'id': key, 'title': title, 'folder': folder, 'file': rel, 'v': v, 'p': p, 'secs': round(d), 'kind': kind,
                      'batch': folder if b else '', 'posted': posted, 'links': links, 'date': (c or {}).get('updated', '')[:10] or '',
                      'full': f"https://raw.githubusercontent.com/proposalwizard/tierlist/ccr-e4ceba58-g6sz6t/{rel}", 'mt': mt})
items.sort(key=lambda i: (-i['mt'], i['title']))
for i in items: i.pop('mt')
open(OUT + '/index.html', 'w').write(open(os.path.join(os.path.dirname(__file__), 'page.html')).read().replace('/*DATA*/[]', json.dumps(items, ensure_ascii=False)))
print(len(items), 'videos;', sum(os.path.getsize(OUT + '/' + i['v']) for i in items) // 2**20, 'MB of previews')
# Published as "Knowitball video library": https://claude.ai/artifact/RyE4J1Eezo4TihYXBcMw6R (slug ca350686-395d-4804-9311-b3d9e41f4662).
# After new videos: run this, then republish index.html + the new p/*.jpg and v/*.mp4 (patch mode keeps the rest).
