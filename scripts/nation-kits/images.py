import json, time, hashlib, urllib.request, urllib.parse, os
exec(open("compose.py").read().split("def hexc")[0])
raw = json.load(open("raw.json"))
names=set()
for n,r in raw.items():
    t=r.get("text")
    if not t: continue
    for i in (1,2):
        for code,colkey,prefix,_,_ in PARTS:
            p=field(t,f"pattern_{code}{i}")
            if p: names.add(f"{prefix}{p}.png")
order={"Kit_body":0,"Kit_left_arm":1,"Kit_right_arm":2,"Kit_shorts":3,"Kit_socks":4}
todo=sorted([x for x in names if not (os.path.exists("img/"+x) and os.path.getsize("img/"+x)>0)], key=lambda x: min(v for k,v in order.items() if x.startswith(k)))
print("todo",len(todo),flush=True)
miss=0
for i,name in enumerate(todo,1):
    fn=name.replace(" ","_"); h=hashlib.md5(fn.encode()).hexdigest(); ok=False
    for repo in ("commons","en"):
        u=f"upload.wikimedia.org/wikipedia/{repo}/{h[0]}/{h[:2]}/"+urllib.parse.quote(fn)
        url="https://wsrv.nl/?url="+urllib.parse.quote(u, safe="")
        for a in range(3):
            try:
                d=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":UA}),timeout=40).read()
                open("img/"+name,"wb").write(d); ok=True; break
            except urllib.error.HTTPError as e:
                if e.code in (404,400): break
                time.sleep(10*(a+1))
            except Exception: time.sleep(10*(a+1))
        time.sleep(0.8)
        if ok: break
    if not ok: miss+=1; open("img/"+name,"wb").close()
    if i%100==0: print(i,"missing",miss,flush=True)
print("finished missing",miss,flush=True)
