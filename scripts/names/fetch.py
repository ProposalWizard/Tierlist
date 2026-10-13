import json, subprocess, time, os, sys
q = json.load(open("qids.json"))
UA = "KnowitballNames/1.0 (knowitballcontact@gmail.com)"
for n, qid in sorted(q.items()):
    f = f"raw/{qid}.csv"
    if os.path.exists(f) and os.path.getsize(f) > 3: continue
    query = f'SELECT DISTINCT ?p ?l WHERE {{ {{ ?p wdt:P27 wd:{qid} }} UNION {{ ?p wdt:P1532 wd:{qid} }} ?p wdt:P106 wd:Q937857; wdt:P21 wd:Q6581097; rdfs:label ?l FILTER(LANG(?l)="en") }}'
    for attempt in range(3):
        r = subprocess.run(["curl", "-sS", "-m", "170", "-G", "https://query.wikidata.org/sparql", "--data-urlencode", f"query={query}",
                            "-H", "Accept: text/csv", "-H", f"User-Agent: {UA}", "-o", f, "-w", "%{http_code}"], capture_output=True, text=True)
        if r.stdout.strip() == "200": break
        time.sleep(5 * (attempt + 1))
    lines = sum(1 for _ in open(f)) - 1 if os.path.exists(f) else -1
    print(n, qid, r.stdout.strip(), lines, flush=True)
    time.sleep(1)
