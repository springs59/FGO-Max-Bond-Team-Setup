"""Build isolated inference variants; never edit the product runtime."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import os
import gzip
import subprocess

product = Path(__file__).resolve().parents[2]
work = Path(sys.argv[1]).resolve()
work.mkdir(parents=True, exist_ok=True)
source = (product / 'src/solver/ai-search.js').read_text()
domain_old = '''  if(active&&!querySession.decision){
    const began=performance.now()
    querySession.decision=inferQueryPolicy(model.queryPolicy,queryFeatures(equipmentFeatures,servantFeatures,queryContext))
    querySession.inferenceCalls++
    querySession.inferenceMs+=performance.now()-began
  }
  const decision=active?querySession.decision:null'''
domain_new = '''  let decision=null
  if(active){
    const features=queryFeatures(equipmentFeatures,servantFeatures,queryContext)
    const key=JSON.stringify(features.slice(0,model.queryPolicy.features.length))
    const decisions=querySession.domainDecisions??=new Map()
    if(!decisions.has(key)){
      const began=performance.now()
      decisions.set(key,inferQueryPolicy(model.queryPolicy,features))
      querySession.inferenceCalls++
      querySession.inferenceMs+=performance.now()-began
    }
    decision=decisions.get(key)
  }'''
assert source.count(domain_old) == 1

framework = '''export function createLearnedSearch({mode='auto',model=SEARCH_MODEL,size=0,minimum=4,
  querySession=createQuerySession()}={}) {
  const started=performance.now(),valid=mode!=='off'&&validSearchModel(model)
  const active=valid&&(mode==='on'||size>=minimum)
  const memo=MEMO ? (querySession.candidateScores??=new Map()) : null
  const stats={enabled:active,modelVersion:valid?model.version+'/candidate-heads':null,ranked:0,
    inferenceCalls:querySession.inferenceCalls,inferenceMs:querySession.inferenceMs,
    scoreCacheHits:0,queryProfile:null,
    seedAttempts:0,seedFeasible:0,seedMs:0,seedBestScore:null,seedReused:0,seedCertifiedStops:0,seedPendingRechecks:0,budgetPruned:0,lowerBoundPruned:0,dpStatePruned:0,
    reason:mode==='off'?'disabled':!valid?'invalid-model':!active?'small-domain':'candidate-heads'}
  return {
    stats,upperBoundPolicy:null,
    score(kind,features){
      if(!active)return null
      stats.ranked++
      const key=memo?kind+':'+features.join(','):null
      if(memo?.has(key)){stats.scoreCacheHits++;return memo.get(key)}
      const began=performance.now(),value=predictPriority(model.heads[kind],features)
      querySession.inferenceCalls++
      querySession.inferenceMs+=performance.now()-began
      stats.inferenceCalls=querySession.inferenceCalls;stats.inferenceMs=querySession.inferenceMs
      const result=Number.isFinite(value)?value:null
      if(memo)memo.set(key,result)
      return result
    },
    order(items,featuresOf,kind='equipment'){
      if(!active)return items
      return items.map((item,index)=>({item,index,score:this.score(kind,featuresOf(item))??-Infinity}))
        .sort((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.item)
    },
    finish(){return {...stats,inferenceCalls:querySession.inferenceCalls,inferenceMs:querySession.inferenceMs,
      setupMs:performance.now()-started-(querySession.inferenceMs||0)}},
  }
}
'''
start=source.index('export function createLearnedSearch(')
end=source.index('// A fixed, small beam',start)
variants={
    'query':source,
    'domain':source.replace(domain_old,domain_new),
    'framework-raw':source[:start]+framework.replace('MEMO','false')+'\n'+source[end:],
    'framework-memo':source[:start]+framework.replace('MEMO','true')+'\n'+source[end:],
}
shared_data=work/'data'
if shared_data.exists():shutil.rmtree(shared_data)
shutil.copytree(product/'src/data',shared_data)
fixtures=os.environ.get('FGO_INFERENCE_FIXTURES')
if fixtures:
    fixtures=Path(fixtures).resolve()
    data_ref=os.environ.get('FGO_INFERENCE_DATA_REF','2d21ebd76b14139051af9f4dad9b926d6aad0577')
    if data_ref:
        for name in ['bundle.json','metadata.json','version.json']:
            result=subprocess.run(['git','show',data_ref+':src/data/'+name],cwd=product,capture_output=True)
            if result.returncode==0:(shared_data/name).write_bytes(result.stdout)
            elif name=='bundle.json':raise RuntimeError('Fetch the complete repository history to restore frozen CN data: '+result.stderr.decode())
    (shared_data/'jp/bundle.json').write_bytes(gzip.decompress((fixtures/'jp-bundle.json.gz').read_bytes()))
    (shared_data/'jp/metadata.json').write_bytes((fixtures/'jp-metadata.json').read_bytes())
    expected=json.loads((fixtures/'runtime-manifest.json').read_text())['data']
    for name,digest in expected.items():
        assert hashlib.sha256((shared_data/Path(name).relative_to('src/data')).read_bytes()).hexdigest()==digest, 'Frozen data mismatch: '+name
for mode, runtime in variants.items():
    root=work/'variants'/mode
    if root.exists():shutil.rmtree(root)
    shutil.copytree(product/'src',root/'src',ignore=shutil.ignore_patterns('data'))
    (root/'src/data').symlink_to(shared_data,target_is_directory=True)
    shutil.copytree(product/'native/shared',root/'native/shared')
    (root/'package.json').write_text('{"type":"module"}\n')
    (root/'src/solver/ai-search.js').write_text(runtime)
    (root/'runtime-diff.patch').write_text(''.join(__import__('difflib').unified_diff(
        source.splitlines(keepends=True),runtime.splitlines(keepends=True),fromfile='a/src/solver/ai-search.js',tofile='b/src/solver/ai-search.js')))
source_hash=hashlib.sha256()
for p in sorted((product/'src').rglob('*.js')):
    source_hash.update((str(p.relative_to(product))+'\0').encode());source_hash.update(p.read_bytes())
expected_source='6ac8f530a16e33beb4620d4e5ac8dca7c5fa065725a54c9e5daaaaac8052660e'
assert source_hash.hexdigest()==expected_source, 'This experiment requires the frozen 2.1.6 JavaScript runtime; check out the benchmark commit before preparing variants.'
(work/'runtime-manifest.json').write_text(json.dumps({'productSourceCommit':'2d21ebd76b14139051af9f4dad9b926d6aad0577',
    'javascriptSha256':source_hash.hexdigest(),'variants':{m:hashlib.sha256(s.encode()).hexdigest() for m,s in variants.items()},
    'data':{'src/data/'+str(p.relative_to(shared_data)):hashlib.sha256(p.read_bytes()).hexdigest() for p in shared_data.rglob('bundle.json')},
    'weights':{n:hashlib.sha256((product/n).read_bytes()).hexdigest() for n in ['src/solver/query-ai-model.js','src/solver/query-policies/T.js','src/solver/query-policies/N8192.js','src/solver/ai-model.js']}},indent=2)+'\n')
print(json.dumps({'work':str(work),'variants':list(variants)}))
