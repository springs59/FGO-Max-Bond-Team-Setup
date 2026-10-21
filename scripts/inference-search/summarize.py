"""Aggregate only: public report excludes raw cases, plans and per-run rows."""
import json,statistics,math,random,sys,csv
from collections import Counter
from pathlib import Path
work=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
rng=random.Random(20261021)
def med(rows,k,field):
    vals=[r[field]for r in rows if r['key']==k and r['status']=='ok' and isinstance(r.get(field),(int,float))]
    return statistics.median(vals) if vals else None

def ci(a,b):
    vals=[]
    for _ in range(3000):
        ids=[rng.randrange(len(a))for i in a];vals.append(sum(a[i]for i in ids)/sum(b[i]for i in ids))
    vals.sort();return [vals[74],vals[2924]]
summary={'schema':1,'selectionObjective':'.7 log total median latency ratio + .3 mean log case latency ratio','fixedInferenceLimit':None,'selectionTiming':'ms = core solve or complete Worker handler execution, includes all inference; excludes process IPC, import, validation. Response latency also aggregated separately.','stages':{}}
reports=[json.loads(path.read_text())for path in sorted((work/'results').glob('*.json'))]
reports=[x for x in reports if x['status']=='complete']
for base in ['confirm','blind']:
    a=next((x for x in reports if x['stage']==base),None);b=next((x for x in reports if x['stage']==base+'-best'),None)
    if a and b:
        assert a['configs']==b['configs']
        reports.append({**a,'stage':base+'-combined','records':a['records']+b['records']})
for x in reports:
    stage=x['stage'];result={'cases':len(x['records']),'rounds':x['method']['rounds'],'warmups':x['method']['warmups'],'allObjectivesAgree':all(r['objectivesAgree']for r in x['records']),'allAlternativesAgree':all(r['alternativesAgree']for r in x['records']),'allCheckpointsValid':all(r['checkpointsValid']for r in x['records']),'configs':{}}
    for k,c in x['configs'].items():
        rows=[r for row in x['records']for r in row['runs'] if r['key']==k]
        ok=[r for r in rows if r['status']=='ok'];completed=[row for row in x['records']if all(r['status']=='ok'for r in row['runs']if r['key']==k)]
        times=[med(row['runs'],k,'ms')for row in completed]
        calls=[r.get('inferenceCalls')for r in ok if isinstance(r.get('inferenceCalls'),(int,float))]
        z={'statusCounts':dict(Counter(r['status']for r in rows)),'family':c['family'],'use':c.get('use','off'),'completeCases':len(completed),'validCases':sum(any(r.get('valid')for r in row['runs']if r['key']==k)for row in completed),'okRuns':len(ok),'deadlineRuns':sum(r['status']=='deadline'for r in rows),'totalCaseMedianMs':sum(times),'totalResponseCaseMedianMs':sum(statistics.median(r['roundTripMs']-r['validationMs']for r in row['runs']if r['key']==k and r['status']=='ok')for row in completed),'medianCaseMs':statistics.median(times)if times else None,'minInferenceCalls':min(calls)if calls else None,'maxInferenceCalls':max(calls)if calls else None,'medianInferenceCalls':statistics.median(calls)if calls else None,'maxRssMiB':max((r.get('rssMiB',0)for r in ok),default=None)}
        baseline=c['family']+('_raw'if c['family']=='F'else'_single')
        if baseline in x['configs']and stage!='pressure':
            paired=[row for row in completed if all(r['status']=='ok'for r in row['runs']if r['key']==baseline)]
            a=[med(row['runs'],k,'ms')for row in paired];b=[med(row['runs'],baseline,'ms')for row in paired]
            z.update({'nativeComparisonCases':len(a),'totalRatioToNative':sum(a)/sum(b),'geomeanRatioToNative':math.exp(statistics.mean(math.log(v/w)for v,w in zip(a,b))),'totalRatioBootstrap95':ci(a,b),'fasterCases':sum(v<w for v,w in zip(a,b)),'slowerCases':sum(v>w for v,w in zip(a,b)),'nodesChangedCases':sum(med(row['runs'],k,'nodes')!=med(row['runs'],baseline,'nodes')for row in paired),'startImprovedCases':sum((next((r.get('ai')or{}).get('seedBestScore')for r in row['runs']if r['key']==k)or -math.inf)>(next((r.get('ai')or{}).get('seedBestScore')for r in row['runs']if r['key']==baseline)or -math.inf)for row in paired)})
        if stage=='pressure':
            z['checkpointCases']=sum(any(r.get('lastCheckpoint')for r in row['runs']if r['key']==k)for row in x['records'])
            z['deadlineCheckpointCases']=sum(any(r['status']=='deadline'and r.get('checkpointValid')for r in row['runs']if r['key']==k)for row in x['records'])
            observed=[r['observedInferenceCalls']for r in rows if r['status']=='deadline'and isinstance(r.get('observedInferenceCalls'),(int,float))]
            z['maxObservedDeadlineInferenceCalls']=max(observed)if observed else None
            z['deadlineInferenceCountsAreLowerBounds']=True
            paired=[]
            if baseline in x['configs']:
                for row in x['records']:
                    a=next((r for r in row['runs']if r['key']==k),None);b=next((r for r in row['runs']if r['key']==baseline),None)
                    if a and b and a['status']==b['status']=='deadline' and a.get('checkpointValid')and b.get('checkpointValid'):
                        def objective(r):
                            p=r['lastCheckpoint'];return(p.get('score',p.get('total')),-p.get('cost',p.get('costUsed')))
                        paired.append((objective(a),objective(b)))
            z.update({'pairedDeadlineCheckpointCases':len(paired),'checkpointBetterCases':sum(a>b for a,b in paired),'checkpointEqualCases':sum(a==b for a,b in paired),'checkpointWorseCases':sum(a<b for a,b in paired)})
        result['configs'][k]=z
    result['environment']=x['environment'];result['method']=x['method'];summary['stages'][stage]=result
summary['recordCounts']={'timed':sum(len(row['runs'])for r in reports if not r['stage'].endswith('-combined')for row in r['records']),'warmups':sum(len(row['warmups'])for r in reports if not r['stage'].endswith('-combined')for row in r['records']),'caseEntries':sum(len(r['records'])for r in reports if not r['stage'].endswith('-combined'))}
for p in ['screen-selection.json','confirm-selection.json','protocol.json']:
    if(work/p).exists():
        value=json.loads((work/p).read_text())
        if p=='protocol.json':value={k:v for k,v in value.items()if k not in ['screenSession','rawDisclosure']}
        summary[p.removesuffix('.json')]=value
(out/'summary-public.json').write_text(json.dumps(summary,indent=2)+'\n')
fields=['stage','key','family','use','completeCases','okRuns','deadlineRuns','totalCaseMedianMs','totalRatioToNative','geomeanRatioToNative','minInferenceCalls','maxInferenceCalls','nodesChangedCases','startImprovedCases','maxRssMiB']
with(out/'comparisons.csv').open('w')as f:
    w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader()
    for stage,s in summary['stages'].items():
        for k,c in s['configs'].items():w.writerow({'stage':stage,'key':k,**c})
print(json.dumps({'stages':list(summary['stages']),'path':str(out)}))
