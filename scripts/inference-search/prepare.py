import sys
import subprocess
import shutil
import json
import hashlib
from pathlib import Path

product=Path(__file__).resolve().parents[2]
work=Path(sys.argv[1]).resolve()
subprocess.run([sys.executable,str(product/'scripts/inference-modes/prepare.py'),str(work)],check=True)
root=work/'variants/adaptive'
if root.exists():shutil.rmtree(root)
shutil.copytree(work/'variants/query',root,symlinks=True)
p=root/'src/solver/query-neural.js';s=p.read_text()
s=s.replace('export function neuralProfile(policy,features){','export function neuralRankings(policy,features){')
s=s.replace(' return at\n}', ' return y.map((v,i)=>i).sort((a,b)=>y[b]-y[a]||a-b)\n}\nexport function neuralProfile(policy,features){return neuralRankings(policy,features)[0]}')
assert 'export function neuralProfile' in s and 'export function neuralRankings' in s
p.write_text(s)
# Apply equivalent adaptive ordering to the general production search.
p=root/'src/recommend.js';s=p.read_text()
s="import { fixedQueryPriority } from './solver/query-ai.js'\n"+s
old='''      for (let i = startInGroup; i < group.length; i++) {
        const row = group[i]'''
new='''      let adaptiveIndexes=Array.from({length:Math.max(0,group.length-startInGroup)},(_,i)=>i+startInGroup)
      if(learnedSearch.dynamic){
        const budget=costLimit==null?null:costLimit-spent
        const remainingFeatures=row=>{const x=featuresOf(row);x[5]=budget==null?0:x[4]*20/Math.max(1,budget);x[13]=budget==null?2:Math.log1p(Math.max(0,budget))/5;x[14]=Math.max(1,slotsLeft)/6;return x}
        adaptiveIndexes=learnedSearch.branchOrder(adaptiveIndexes,i=>remainingFeatures(group[i]),()=>({equipment:[],
          servants:(leftoverFrom[gi]||[]).filter(r=>!used.has(r.svt.id)).map(remainingFeatures),
          context:{costLimit:budget,minimumOwn:Math.max(1,minN-selected.length),layouts:useSupport?[6,3]:[0],identitiesCount:fillerMap.size-used.size},
        }),{nodes:searchState.nodes,remaining:slotsLeft,bestScore:searchState.bestPlan?.total??-Infinity,bestCost:searchState.bestPlan?.costUsed??Infinity})
      }
      for (const i of adaptiveIndexes) {
        const row = group[i]'''
assert s.count(old)==1;s=s.replace(old,new)
old='''          const began=performance.now(),selected=mustPick.slice(),used=new Set(mustIds)
          let seedCost=spent
          for(const group of fillerGroups)for(const row of group) {'''
new='''          const began=performance.now()
          for(const recipe of [null,...learnedSearch.portfolio()]){
          const selected=mustPick.slice(),used=new Set(mustIds)
          let seedCost=spent
          const seedGroups=recipe?fillerGroups.map((group,index)=>({group,index,score:Math.max(...group.map(row=>fixedQueryPriority(recipe,'servant',featuresOf(row))))})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.group):fillerGroups
          for(const group of seedGroups)for(const row of group) {'''
assert s.count(old)==1;s=s.replace(old,new)
old='''          learnedSearch.stats.seedBestScore=searchState.bestPlan?.total??null
          learnedSearch.stats.seedMs+=performance.now()-began'''
new='''          }
          learnedSearch.stats.seedBestScore=searchState.bestPlan?.total??null
          learnedSearch.stats.seedMs+=performance.now()-began'''
assert s.count(old)==1;s=s.replace(old,new);p.write_text(s)
p=root/'src/solver/ai-search.js';s=p.read_text()
s=s.replace("import { createQuerySession,", "import { neuralRankings } from './query-neural.js'\nimport { QUERY_PROFILES, createQuerySession,")
start=s.index('export function createLearnedSearch(');end=s.index('// A fixed, small beam',start)
s=s[:start]+(product/'scripts/inference-search/adaptive-search.js').read_text()+'\n'+s[end:];p.write_text(s)
p=root/'src/solver/inventory-curve-solver.js';s=p.read_text()
# Cache each suffix's static features; inference sees actual remaining budget
# and already chosen CE bonuses. Learning changes count order, never cutoffs.
at='  function walk(i,remaining,flat,cost){'
prefix='''  const adaptiveRows=learned.dynamic?Array.from({length:equipment.length+1},(_,i)=>compressed.map(r=>{
    const v=vectors[r.vector]
    return searchFeatures({rates:equipment.slice(i).flatMap(g=>g.items.map(()=>g.rates[r.vector])).concat(v.support),
      cost:r.cost,live:Number(!v.maxed),self:v.self,party:r.contribution,base,budget:costLimit,cap,preferred:required.has(r.svt.id)})
  })):null
  function residualFeatures(x,budget){const y=x.slice();y[5]=budget==null?0:y[4]*20/Math.max(1,budget);y[13]=budget==null?2:Math.log1p(Math.max(0,budget))/5;return y}
'''
assert s.count(at)==1;s=s.replace(at,prefix+at)
old='''    const maxCount=Math.min(remaining,g.items.length),prediction=equipmentPriorities.get(g)'''
new='''    const maxCount=Math.min(remaining,g.items.length)
    const residualBudget=costLimit==null?null:costLimit-cost
    const currentFeatures=()=>residualFeatures(equipmentFeatures(g),residualBudget)
    const prediction=(learned.dynamic?learned.branchPriority(()=>({
      equipment:equipment.slice(i).map(x=>residualFeatures(equipmentFeatures(x),residualBudget)),
      servants:adaptiveRows[i].map((x,j)=>{const y=residualFeatures(x,residualBudget);y[10]+=rate[compressed[j].vector]/1000;return y}),
      context:{costLimit:residualBudget,requiredIds,requiredSeats,fixedPositions,emptyPositions,layouts,minimumOwn,allSupportAlternatives,requireSupportEquipment,identitiesCount:servants.length},
    }),currentFeatures,{nodes,remaining,bestScore:best?.score??-Infinity,bestCost:best?.cost??Infinity}):null)??equipmentPriorities.get(g)'''
assert s.count(old)==1;s=s.replace(old,new)
old='''    const originalSeeds=proposeEquipmentSeeds(equipment,equipmentPriorities,cap,costLimit,6,partyCosts)'''
new=old+'''
    for(const recipe of learned.portfolio()){
      const priorities=new Map(equipment.map(g=>[g,fixedQueryPriority(recipe,'equipment',equipmentFeatures(g))]))
      for(const counts of proposeEquipmentSeeds(equipment,priorities,cap,costLimit,6,partyCosts))
        if(!originalSeeds.some(a=>a.every((x,i)=>x===counts[i])))originalSeeds.push(counts)
    }'''
assert s.count(old)==1;s=s.replace(old,new)
s="import { fixedQueryPriority } from './query-ai.js'\n"+s
p.write_text(s)
# Pressure telemetry observes every exact incumbent, including warm starts.
# This is a separate root, applied equally to native and adaptive finalists.
for variant in ['query','adaptive']:
    pressure=work/('pressure/'+variant)
    if pressure.exists():shutil.rmtree(pressure)
    shutil.copytree(work/('variants/'+variant),pressure,symlinks=True)
    p=pressure/'src/recommend.js';s=p.read_text()
    s=s.replace('  const querySession = createQuerySession()\n  opts = {...opts,querySession}',
                '  const querySession = createQuerySession()\n  opts.onInferenceSession?.(querySession)\n  opts = {...opts,querySession}')
    p.write_text(s)
    for name in ['inventory-curve-solver.js','inventory-curve-legacy.js']:
        p=pressure/'src/solver'/name;s=p.read_text()
        for text,value in [('if(!best||score>best.score||score===best.score&&cost<best.cost)best=candidate','candidate'),
                           ('if(!best||witness.score>best.score||witness.score===best.score&&witness.cost<best.cost)best=witness','witness')]:
            s=s.replace(text,text.split('best=')[0]+'{best='+value+';onCheckpointPlan?.(packPlan(best,false))}')
        p.write_text(s)
manifest=json.loads((work/'runtime-manifest.json').read_text())
manifest['adaptiveFiles']={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'src').rglob('*.js') if p.name in ['ai-search.js','inventory-curve-solver.js','query-neural.js','recommend.js']}
(work/'adaptive-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'adaptive':str(root),'pressureRoots':str(work/'pressure')}))
