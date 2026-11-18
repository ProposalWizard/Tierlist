import json,re,urllib.request,os,time
D=json.load(open('v2data.json'))
people={}
for k in ('salah_top8','salah_now5','palmer_top8','palmer2425_top3'):
    for r in D[k]: people[r['id']]=(r['name'],r['teamId'])
people[D['salah_target']['id']]=('Mohamed Salah',D['salah_target']['teamId']); people[D['palmer_target']['id']]=('Cole Palmer',D['palmer_target']['teamId'])
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()
meta={}
for pid,(name,tid) in people.items():
    try:
        h=get(f'https://www.fotmob.com/players/{pid}/x').decode()
        d=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))['props']['pageProps']
        s=json.dumps(d)
        m=re.search(r'"countryCode":\s*"([A-Z]{3})"',s); cc=m.group(1) if m else None
        m2=re.search(r'"country":\s*"([^"]+)"',s); cn=m2.group(1) if m2 else None
    except Exception as e: cc=cn=None; print('page fail',name,e)
    meta[pid]={'name':name,'cc':cc,'country':cn,'teamId':tid}
    for url,fn in [(f'https://images.fotmob.com/image_resources/playerimages/{pid}.png',f'img/p{pid}.png'),(f'https://images.fotmob.com/image_resources/logo/teamlogo/{tid}.png',f'img/t{tid}.png')]+([(f'https://images.fotmob.com/image_resources/logo/teamlogo/{cc.lower()}.png',f'img/c{cc}.png')] if cc else []):
        if not os.path.exists(fn):
            try: open(fn,'wb').write(get(url))
            except Exception as e: print('img fail',url,e)
    print(name,cc,cn,tid); time.sleep(0.7)
json.dump(meta,open('img/meta.json','w'),indent=1,ensure_ascii=False)
