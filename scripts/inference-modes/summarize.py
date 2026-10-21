"""Select using calibration only. Summarize held-out results without retuning."""
import json
import math
from pathlib import Path
import random
import statistics
import sys
from datetime import datetime, timezone

work=Path(sys.argv[1])
phase=sys.argv[2]
calibration=json.loads((work/'results/calibration.json').read_text())
assert calibration['status']=='complete'
KEYS=list(calibration['configs'])

def timing(r,kind):
    return max(1e-6,r['ms'] if kind=='core' else r['roundTripMs']-r['validationMs'])

def measurements(report,key):
    result={}
    for row in report['records']:
        runs=[r for r in row['runs'] if r['key']==key and r['status']=='ok']
        if len(runs)!=(1 if row['tier']=='stress' else report['method']['rounds']):continue
        result[row['id']]={'ms':statistics.median(timing(r,row['kind']) for r in runs),
            'calls':statistics.median(r['inferenceCalls'] for r in runs),
            'callMin':min(r['inferenceCalls'] for r in runs),'callMax':max(r['inferenceCalls'] for r in runs),
            'rssMiB':max(r['rssMiB'] for r in runs),'kind':row['kind'],
            'initial':runs[0].get('ai',{}).get('initialLowerBound') if runs[0].get('ai') else None,
            'initialCost':runs[0].get('ai',{}).get('initialLowerBoundCost') if runs[0].get('ai') else None,
            'profile':runs[0].get('ai',{}).get('queryProfile') if runs[0].get('ai') else None}
    return result

def compare(report,a,b):
    before,after=measurements(report,a),measurements(report,b)
    ids=sorted(before.keys()&after.keys())
    if not ids:return {'n':0}
    logs=[math.log(after[i]['ms']/before[i]['ms']) for i in ids]
    rng=random.Random(1701)
    samples=sorted(math.exp(statistics.mean(rng.choices(logs,k=len(logs)))) for _ in range(5000))
    return {'before':a,'after':b,'n':len(ids),'sumBeforeMs':sum(before[i]['ms'] for i in ids),
        'sumAfterMs':sum(after[i]['ms'] for i in ids),
        'totalRatio':sum(after[i]['ms'] for i in ids)/sum(before[i]['ms'] for i in ids),
        'geometricRatio':math.exp(statistics.mean(logs)), 'ci95':[samples[125],samples[4874]],
        'faster':sum(after[i]['ms']<before[i]['ms'] for i in ids),
        'multiInferenceCases':sum(after[i]['calls']>1 for i in ids),
        'callRangeBefore':[min(before[i]['callMin'] for i in ids),max(before[i]['callMax'] for i in ids)],
        'callRangeAfter':[min(after[i]['callMin'] for i in ids),max(after[i]['callMax'] for i in ids)]}

if phase=='select':
    decision={'frozenAt':datetime.now(timezone.utc).isoformat(),'frozenFrom':'calibration only','criteria':{'geoBelow':.97,'ciUpperBelow':1,'sumRatioAtMost':1.05,'domainMultiCasesAtLeast':2},'models':{}}
    for key in ['H','T','N','F']:
        a,b=(key+'_query',key+'_domain') if key!='F' else ('F_raw','F_memo')
        c=compare(calibration,a,b)
        accepted=c['n']==len(calibration['records']) and c['geometricRatio']<.97 and c['ci95'][1]<1 and c['totalRatio']<=1.05
        if key!='F':accepted=accepted and c['multiInferenceCases']>=2
        decision['models'][key]={'selected':b if accepted else a,'candidateAccepted':accepted,'comparison':c}
    (work/'selection.json').write_text(json.dumps(decision,indent=2)+'\n')
    print(json.dumps(decision,indent=2));sys.exit()

holdout=json.loads((work/'results/holdout.json').read_text())
stress=json.loads((work/'results/stress.json').read_text())
assert holdout['status']==stress['status']=='complete'
selection=json.loads((work/'selection.json').read_text())
extra=[json.loads((work/('results/'+stage+'.json')).read_text()) for stage in ['domain-calibration','domain-holdout']]
assert all(j['status']=='complete' for j in extra)
all_reports=[calibration,holdout,*extra,stress]
summary={'selection':selection,'calibrationCases':len(calibration['records']),'holdoutCases':len(holdout['records']),'stressCases':len(stress['records']),
    'supplementalCases':sum(len(j['records']) for j in extra),
    'supplementalComparisons':{j['cases'][0]['stage']:{k:compare(j,*v) for k,v in {'H':['H_query','H_domain'],'T':['T_query','T_domain'],'N':['N_query','N_domain'],'F':['F_raw','F_memo']}.items()} for j in extra},
    'calibrationComparisons':{k:compare(calibration,*v) for k,v in {'H':['H_query','H_domain'],'T':['T_query','T_domain'],'N':['N_query','N_domain'],'F':['F_raw','F_memo']}.items()},
    'holdoutComparisons':{k:compare(holdout,*v) for k,v in {'H':['H_query','H_domain'],'T':['T_query','T_domain'],'N':['N_query','N_domain'],'F':['F_raw','F_memo']}.items()},
    'holdoutVersusOff':{k:compare(holdout,'off',v['selected']) for k,v in selection['models'].items()},
    'holdoutVersusH':{k:compare(holdout,'H_query',v['selected']) for k,v in selection['models'].items()},
    'allCompletedAnswersAgree':all(r['objectivesAgree'] and r['alternativesAgree'] for j in all_reports for r in j['records']),
    'incompleteOrdinaryCases':[r['id'] for j in [calibration,holdout,*extra] for r in j['records'] if not r['complete']],
    'inferenceRanges':{},'stress':[],'perCase':{}}
for key in KEYS:
    runs=[r for j in all_reports for row in j['records'] for r in row['runs'] if r['key']==key and r['status']=='ok']
    summary['inferenceRanges'][key]=[min(r['inferenceCalls'] for r in runs),max(r['inferenceCalls'] for r in runs)]
for row in stress['records']:
    summary['stress'].append({'id':row['id'],'results':{r['key']:{k:r.get(k) for k in ['status','ms','observedMs','facts','inferenceCalls','rssMiB']} for r in row['runs']}})
for report in [calibration,holdout,*extra]:
    for key in KEYS:
        for case,values in measurements(report,key).items():summary['perCase'].setdefault(case,{})[key]=values
(work/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['perCase','selection']},indent=2))
