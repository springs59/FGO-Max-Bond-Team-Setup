"""Freeze calibration selections without using blind or pressure outcomes."""
import json, math, statistics, sys
from pathlib import Path
work=Path(sys.argv[1]); stage=sys.argv[2]
assert stage in ('screen','confirm')
x=json.loads((work/'results'/f'{stage}.json').read_text())
assert x['status']=='complete'
if stage=='confirm' and (work/'results/confirm-best.json').exists():
    extra=json.loads((work/'results/confirm-best.json').read_text());assert extra['status']=='complete' and extra['configs']==x['configs']
    x['records']+=extra['records'];x['endedAt']+=' + '+extra['endedAt']
assert all(r['complete'] and r['objectivesAgree'] and r['alternativesAgree'] and r['checkpointsValid'] for r in x['records'])
rankings={}; keys=['off']
for family in 'HTNF':
    baseline=family+('_raw' if family=='F' else '_single')
    medians={}
    for key,cfg in x['configs'].items():
        if cfg['family']!=family: continue
        medians[key]=[statistics.median(r['ms'] for r in row['runs'] if r['key']==key and r['status']=='ok') for row in x['records']]
    ref=medians[baseline]
    ranked=[]
    for key,vals in medians.items():
        ratio=sum(vals)/sum(ref)
        loggeo=statistics.mean(math.log(a/b) for a,b in zip(vals,ref))
        ranked.append(dict(key=key,score=.7*math.log(ratio)+.3*loggeo,totalMs=sum(vals),totalRatio=ratio,geomeanRatio=math.exp(loggeo)))
    ranked.sort(key=lambda r:r['score']); rankings[family]=ranked
    selected=[r['key'] for r in ranked[:2 if stage=='screen' else 1]]
    keys.extend(selected+[baseline])
    if stage=='confirm' and selected[0]==baseline:
        keys.append(next(r['key']for r in ranked if r['key']!=baseline))
out=dict(adoptionEvidenceRule='Independent pooled blind total-latency bootstrap95 upper below 1 and geometric mean ratio <= 1; no inference count criterion',stage=stage,cases=len(x['records']),source=x['endedAt'],objective='.7 log total median ratio + .3 mean log case ratio',rankings=rankings,keys=list(dict.fromkeys(keys)),winners={f:r[0]['key'] for f,r in rankings.items()})
(work/f'{stage}-selection.json').write_text(json.dumps(out,indent=2)+'\n')
print(','.join(out['keys']))
print(json.dumps(out['winners']))
