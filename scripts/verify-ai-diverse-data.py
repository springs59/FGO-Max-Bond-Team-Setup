"""Integrity/metadata checks only; never evaluates sealed test predictions."""
import gzip,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'experiments/ai-diverse'
r=json.loads((root/'reports/dataset.json').read_text());assert r['status']=='complete'
sets={};stats={};parity=0
for split,n in r['counts'].items():
    b=(root/f'data/{split}.jsonl.gz').read_bytes()
    assert hashlib.sha256(b).hexdigest()==r['files'][split]['sha256']
    rows=[json.loads(l)for l in gzip.decompress(b).splitlines()]
    assert len(rows)==n and {q['index']for q in rows}==set(range(n))
    assert all(q['split']==split for q in rows)
    sets[split]={q['case']['inputSha256']for q in rows if 'case'in q}
    completed=sum(q['status']=='ok'for q in rows)
    assert len(sets[split])==completed,'Repeated exact inputs within split'
    parity+=sum(q['status']=='ok'and q['index']<240 for q in rows)
    stats[split]={'rows':len(rows),'uniqueCompletedInputs':len(sets[split])}
intersections={a+'_'+b:len(sets[a]&sets[b])for a,b in [('train','validation'),('train','test'),('validation','test')]}
assert not any(intersections.values()),'Exact input leakage between splits'
report={'gzipIntegrity':True,'countsAndDigestsMatch':True,'splits':stats,'crossSplitInputOverlaps':intersections,'independentParity':{'attempted':sum(min(240,n)for n in r['counts'].values()),'completed':parity},'testQualityOrTimingEvaluated':False}
(root/'reports/integrity.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
