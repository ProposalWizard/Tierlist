import json
raw=json.load(open('qs_raw.json'))
def R(p,a,b,pre='Q'): return ['%s-%s%d'%(p,pre,i) for i in range(a,b+1)]
NEED=set('LAG-Q2 LAG-Q4 LAG-Q5 LAG-Q8 LAG-Q13 LAG-Q14 LAG-QB1 LAG-QB9 LAG-QB10 LAG-QB11 LAG-QB12 LAG-QB13 LAG-QB14 LAG-QB25 TB-Q1 TB-Q6 ADM-Q1 ADM-Q3 ADM-Q42 ADM-Q68 ADM-Q84 ADM-Q110 ADM-Q146 ADM-Q151 PN-Q3 PN-Q7 PN-Q9 PN-Q40 PN-Q57 PN-Q197'.split())
HK=set('LAG-QB2 LAG-QB6 LAG-QB8 LAG-QB17 LAG-QB18 LAG-QB19 LAG-QB22 LAG-QB23 LAG-QB24'.split())
HK|=set(['ADM-Q5','ADM-Q70','ADM-Q78']+R('ADM',10,37)+R('ADM',45,55)+R('ADM',57,67)+R('ADM',89,91)+['ADM-Q95','ADM-Q96']+R('ADM',104,109)+['ADM-Q111','ADM-Q116','ADM-Q123','ADM-Q127','ADM-Q128','ADM-Q131','ADM-Q132','ADM-Q135','ADM-Q136','ADM-Q137','ADM-Q138','ADM-Q141'])
HK|=set(R('PN',12,26)+R('PN',29,39)+R('PN',41,44)+R('PN',48,56)+R('PN',58,69)+R('PN',71,157)+['PN-Q185','PN-Q186','PN-Q189','PN-Q193'])
HK-=NEED
for q in raw: q['tier']='need' if q['id'] in NEED else ('house' if q['id'] in HK else 'quick')
from collections import Counter
c=Counter((q['plan'],q['tier']) for q in raw); print(sorted(c.items()), len(raw))
json.dump(raw,open('qs_tiered_seed.json','w'),ensure_ascii=False,indent=0)
for q in raw:
  if q['tier']=='quick': print(q['id'],'|',q['q'],'||',q['rec'])
