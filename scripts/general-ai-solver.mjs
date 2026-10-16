import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomUUID,createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rootFeatures, reorderGroups, countOrder, decideRoot } from './general-ai-policy.mjs'
const url=new URL('../src/solver/inventory-curve-solver.js',import.meta.url),original=readFileSync(url,'utf8')
const marker="  const learned=createLearnedSearch({mode:aiMode,model:aiModel,size:equipment.length})"
if(!original.includes(marker))throw Error('Exact root hook marker changed')
function compile(measured){
 let source=original.replace(marker,`  const rootContext={equipment,vectors,rows,contributions,base,costLimit,cap,required,requiredSeats,fixedPositions,empty,seats,allSupportAlternatives}
  const generalPolicy=globalThis.__generalRoot?.(rootContext)||0
  let generalReserve=null
  if(generalPolicy&&costLimit!=null){
    const cheapest=new Map()
    for(const r of rows)cheapest.set(r.svt.id,Math.min(cheapest.get(r.svt.id)??Infinity,r.cost))
    const forced=[...required].reduce((n,id)=>n+cheapest.get(id),0)
    const optional=[...cheapest].filter(([id])=>!required.has(id)).map(([,cost])=>cost).sort((a,b)=>a-b)
    generalReserve=Array.from({length:cap+1},(_,n)=>{
      const need=Math.max(n,minimumOwn,required.size)-required.size
      return need>optional.length?Infinity:forced+optional.slice(0,need).reduce((a,b)=>a+b,0)
    })
  }
  ${marker.trim()}`)
 source=source.replace('if(costLimit!=null&&cost>costLimit){pruned++;return}', 'if(costLimit!=null&&(cost>costLimit||generalReserve&&cost+generalReserve[selected.length]>costLimit)){pruned++;return}')
 source=source.replace('if(counts){const target=prediction', 'if(counts&&prediction!=null){const target=prediction')
 source=source.replace('const counts=prediction==null?null:Array.from({length:maxCount+1},(_,j)=>maxCount-j)',`const counts=globalThis.__generalCounts?.(generalPolicy,maxCount,remaining,cost,costLimit,g)||(prediction==null?null:Array.from({length:maxCount+1},(_,j)=>maxCount-j))`)
 if(measured){
  source=source.replace('walk(0,cap,0,0);if(!best)return null', 'walk(0,cap,0,0);globalThis.__generalWork?.({nodes,evaluated,pruned,dpTransitions,upperRows});if(!best)return null')
  source=source.replace('const started=Date.now();let best=null','let dpTransitions=0,upperRows=0;const started=Date.now();let best=null')
  source=source.replace('return Math.max(...(layout?[layout]:seats).map(l=>{','upperRows+=compressed.length*(layout?1:seats.length);return Math.max(...(layout?[layout]:seats).map(l=>{')
  source=source.replace("for(const x of choices)for(const seat of ['front','back']){","for(const x of choices)for(const seat of ['front','back']){dpTransitions++;")
  source=source.replace("complete:allSupportAlternatives||p.score===best.score,nodes,evaluated,pruned,","complete:allSupportAlternatives||p.score===best.score,nodes,evaluated,pruned,dpTransitions,upperRows,")
 }
 source=source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(new URL(p,url).href))
 return source
}
const dir=join(tmpdir(),'fgo-general-guide');mkdirSync(dir,{recursive:true})
export const GENERAL_KERNEL_SHA=createHash('sha256').update(compile(false)).update(compile(true)).digest('hex')
const modules=[],instance=randomUUID()
for(const measured of [false,true]){const path=join(dir,`solver-${instance}-${measured}.mjs`);writeFileSync(path,compile(measured));modules.push((await import(pathToFileURL(path))).solveInventoryCurves);unlinkSync(path)}
export function solveGeneral(opts,{policy=0,model=null,gate=null,measured=false,capture=false}={}){
 let observation=null,work=null,decision={policy:0,reason:'forced'}
 if(globalThis.__generalRoot)throw Error('Nested general guidance is unsupported')
 globalThis.__generalRoot=c=>{
  if(capture)observation=rootFeatures(c)
  decision=model?decideRoot(c,model,gate):{policy,reason:'forced'}
  reorderGroups(c,decision.policy);return decision.policy
 }
 globalThis.__generalCounts=countOrder
 globalThis.__generalWork=s=>{work=s}
 try{const result=modules[Number(measured)]({...opts,aiMode:'off'});return {result,observation,decision,work}}
 finally{delete globalThis.__generalRoot;delete globalThis.__generalCounts;delete globalThis.__generalWork}
}
export function resultFacts(result,allTargets){
 if(!result)return null
 const alternatives=allTargets?result.plans.map(p=>{const sup=p.slots.find(s=>s.f&&s.s);return [sup?.p||0,sup?.ce||0,p.score,p.cost]}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):undefined
 return [result.score,result.cost,...(alternatives?[alternatives]:[])]
}
