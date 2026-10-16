import json, re, time, urllib.request, urllib.parse, sys, os
UA = "KnowitballKitResearch/1.0 (knowitballcontact@gmail.com)"
REN = {"IR Iran":"Iran","Korea Republic":"South Korea","Congo DR":"DR Congo","Türkiye":"Turkey",
 "Côte d'Ivoire":"Ivory Coast","Cabo Verde":"Cape Verde","China PR":"China","Kyrgyz Republic":"Kyrgyzstan",
 "The Gambia":"Gambia","DPR Korea":"North Korea","Hong Kong, China":"Hong Kong","Brunei Darussalam":"Brunei",
 "Timor-Leste":"East Timor","USA":"United States","St Kitts and Nevis":"Saint Kitts and Nevis",
 "St Lucia":"Saint Lucia","St Vincent and the Grenadines":"Saint Vincent and the Grenadines"}
def get(title):
    url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ","_")) + "?action=raw&section=0"
    for attempt in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":UA}), timeout=30)
            return r.read().decode()
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(10*(attempt+1))
        except Exception:
            time.sleep(10*(attempt+1))
    return None
teams = json.load(open("../../data/fifa/ranking-2026-07-20.json"))["teams"]
out = json.load(open("raw.json")) if os.path.exists("raw.json") else {}
for t in teams:
    n = t["name"]
    if n in out and out[n].get("text"): continue
    base = REN.get(n, n)
    title = None; text = None
    for cand in [f"{base} national football team", f"{base} men's national football team", f"{base} national soccer team", f"{base} men's national soccer team"]:
        tx = get(cand); time.sleep(1.5)
        hops = 0
        while tx and tx.lstrip().upper().startswith("#REDIRECT") and hops < 3:
            m = re.search(r"\[\[([^\]#|]+)", tx); cand = m.group(1); tx = get(cand); time.sleep(1.5); hops += 1
        if tx and "body1" in tx: title, text = cand, tx; break
    out[n] = {"title": title, "text": text}
    print(n, "->", title, flush=True)
    json.dump(out, open("raw.json","w"))
