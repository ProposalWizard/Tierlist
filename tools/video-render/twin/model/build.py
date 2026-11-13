import os; DATA=os.environ.get('TWIN_DATA','fm')  # folder for the downloaded FotMob pages (never commit it)
import json,glob,collections,csv
rows=collections.defaultdict(dict); pos={}; team={}
for f in glob.glob(DATA+'/raw/*.json'):
    d=json.load(open(f)); st=d['stat']
    if st.startswith('phys'): continue
    for r in d['rows']:
        k=(d['season'],r['id']); rows[k]['name']=r['name']; rows[k]['season']=d['season']; rows[k]['teamId']=r['teamId']; rows[k]['pos']=r.get('position')
        rows[k][st]=r['statValue']['value']; rows[k][st+'__sub']=r['substatValue']['value'] if r.get('substatValue') else None
json.dump({f'{k[0]}|{k[1]}':v for k,v in rows.items()},open(DATA+'/table.json','w'))
print(len(rows))
for n in ['Mohamed Salah','Cole Palmer','Erling Haaland','Bukayo Saka','Declan Rice','Virgil van Dijk','Bruno Fernandes']:
    for k,v in rows.items():
        if v['name']==n and k[0] in ('2024/25',): print(n,v['pos'],{x:v.get(x) for x in ['mins_played','mins_played__sub','goals','goals__sub','goal_assist','expected_goals','total_att_assist','won_contest','won_contest__sub','accurate_pass__sub']})
