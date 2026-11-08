import json,sys
V,D,title,fname,extra=sys.argv[1:6]
tl=json.load(open(V+'/timeline.json')); L={l['id']:l for l in json.load(open(V+'/lines.json'))}; SC=json.load(open(V+'/scenes.json')); sc=SC['scenes']; lists=SC['lists']
def onscreen(id):
    s=sc[id]; t=s['type']
    if t=='intro': return f"Intro card: face, badge, flag, {s['name']} {s['season']}; " + '; '.join(' '.join(f) for f in s['facts'])
    if t=='countdown':
        L2=lists[s['list']]['rows']
        if 'steps' in s: return 'Countdown: '+', '.join(f"#{k} {L2[k-1]['name']} {round(L2[k-1]['match'])}%" for k,_ in s['steps'])
        r=L2[s['upto']-1]; return f"Countdown #{s['upto']}: spotlight {r['name']} {r['season']}, {round(r['match'])}% match" + (f", \"{r['line']}\"" if r.get('line') else '') + (f", {r['sure']}" if r.get('sure') else '')
    if t=='cd2':
        L2=lists[s['list']]['rows']; g=s['show']
        if s.get('aside'): a=s['aside']; return f"Aside: {a['name']} {a['season']}, #{a['rank']}, {round(a['match'])}% match, '{a['text']}'" + (f"; pop-up {s['pop']['big']} {s['pop']['label']} ({s['pop']['rank']})" if s.get('pop') else '')
        r=L2[g[0]-1]
        return f"Countdown {' · '.join('#'+str(k) for k in g)}: {r['name']} {' · '.join(L2[k-1]['season'] for k in g)}" + (' (greyed out, not counted)' if r.get('excluded') else f", {round(r['match'])}% match") + (", becomes SALAH'S STATISTICAL TWIN" if r.get('twin') else '') + (f"; pop-up {s['pop']['big']} {s['pop']['label']} ({s['pop']['rank']})" if s.get('pop') else '') + ('; sticker GUESS THE TWIN IN THE COMMENTS' if s.get('sticker') else '')
    if t=='end2': return 'End card: '+' / '.join(f"{p['label']}: {p['aName']} = {p['bName']}" for p in s['pairs'])+"; KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk"
    if t=='compare': return f"{s['title']} (per 90): " + '; '.join(f"{r['label']} {r['a']} vs {r['b']}" for r in s['rows'])
    if t=='statement': return ' / '.join(l[0] for l in s['lines'])
    return "End card: both faces, KNOWITBALL, WHO'S NEXT? COMMENT BELOW, knowitball.co.uk"
rows=[f"| {g['start']:.2f}–{g['end']:.2f} | \"{L[g['id']]['say'].replace('Koo-cheen-yo','Coutinho').replace('De Broyna','De Bruyne')}\" | {onscreen(g['id'])} | v2data.json |" for g in tl['segs']]
md=f"""# {title}

- File: `{fname}`. 1080×1920 (9:16), 30 fps, H.264, AAC 48 kHz stereo. Length: {tl['total']:.1f} s. Cover: `cover.png` (the intro card at 3 s).
- Version 4 (8 Nov 2026) = version 3 plus Mikey's picks: 4-s intro, '100% = identical' on screen only, 'You'd think Saka? 31st', 'guess the twin' sticker at #4, a pop-up fact per player, cards slide in from alternating sides. Version 3: voice Hugo on ElevenLabs (FACT-KIB-012); the target's own seasons shown first and greyed out, then the countdown from the bottom, a repeated player's places shown together; \"first in x% of tests\"; end card with both = pairs; ending line \"Follow for more.\" (RUL-KIB-005). Faces, club badges and flags (RUL-KIB-007), "% match" (100% = identical), "#1 in x of 10 tests" in place of "2,000 runs", real per-90 numbers on screen (never ranks).
- {extra}
- Model: Premier League attackers (wingers, 10s, strikers), 900+ minutes (450+ for 26/27, about 10 games in). Every stat per 90 minutes, ranked 0–100 against that player's own season; weighted gap; match % = 100 minus the gap; 2,000 tests with the weights shuffled ±50%. Data: FotMob's public stat pages (Opta), read 7 Nov 2026. Pictures: FotMob headshots, club badges (the club that season) and flags.
- Voice: Hugo (ElevenLabs, eleven_multilingual_v2), gaps trimmed to 0.16 s, as tools/video-factory/make.py. Sound made in numpy. Made with `tools/video-render/twin/` (engine `video2.html`, numbers `model/v2data.py`).

| Time (s) | Voiceover | On screen | Source |
|---|---|---|---|
""" + "\n".join(rows) + "\n"
open(D+'/script.md','w').write(md); print('ok',D)
