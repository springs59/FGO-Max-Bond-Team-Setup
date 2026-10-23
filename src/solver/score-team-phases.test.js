import assert from 'node:assert/strict'
import {enumerateScoreTeamPhases} from './score-team-phases.js'
import {createScoreTeamController} from './score-team-worker.js'
import {createScoreTeamStore} from './score-team-store.js'

// Deliberately inject a wrong initial bound. Production inputs have no fault
// toggle: this dependency tests the real phase coordinator and Worker/store.
function fixture({repeat=false,prefer=false,precomputed=false,extraHistory=0}={}){
  const state={bestScore:-Infinity,complete:false,maximumProven:false,phase:'optimizing',recoveries:0,useBounds:true,compact:true,
    stats:{nodes:0,evaluated:0,scorePruned:0,budgetPruned:0}}
  const rows=[[['10a',10],['10b',10],...Array.from({length:extraHistory},(_,i)=>['old'+i,10]),['30a',30],['30b',30],...(repeat?[['40a',40],['40b',40]]:[])],
    [['20a',20],['30c',30],...(repeat?[['40c',40]]:[])]]
  const visits=[],domains=rows.map(rs=>({optimizeBy:prefer?'prefer':'total',rows:rs,
    hydrate:packed=>({ok:true,total:prefer?1000-packed.value:packed.value,preferBond:packed.value,slots:[],costUsed:0})}))
  const q={ok:true,initial:null,state,equivalenceCatalogs:domains.map(()=>null),visits,
    hydrate:r=>({...domains[r.domain].hydrate(r.packed),resultStatus:{source:'all-score-teams',primaryScore:state.bestScore}})}
  q.iterator=enumerateScoreTeamPhases({domains,state,enumerateDomain:function*(d,s){
    visits.push({domain:domains.indexOf(d),phase:s.phase,recoveries:s.recoveries,bounds:s.useBounds})
    for(const [tag,value] of d.rows){
      s.stats.nodes++
      if(s.useBounds&&value>(s.phase==='optimizing'?10:20)||repeat&&!s.useBounds&&s.recoveries===1&&s.phase==='optimizing'&&value>30){s.stats.scorePruned++;continue}
      s.stats.evaluated++
      yield {type:'team',score:precomputed?value:null,packed:{tag,value,slots:[]}}
    }
  }})
  return q
}
for(const repeat of [false,true])for(const prefer of [false,true])for(const precomputed of [false,true]){
  const q=fixture({repeat,prefer,precomputed}),records=[],proofs=[],recoveries=[]
  for(const e of q.iterator){
    if(e.type==='phase'){assert.equal(q.state.maximumProven,true);assert.equal(q.state.complete,false);proofs.push(q.state.bestScore)}
    if(e.type==='best'&&e.recovery){
      assert.equal(q.state.maximumProven,false);assert.equal(q.state.complete,false)
      assert.equal(q.state.phase,'optimizing');assert.equal(q.state.useBounds,false)
      assert.ok(e.score>e.previousBestScore);recoveries.push(e.score)
    }
    if(e.type==='team')records.push(e.record)
  }
  const best=repeat?40:30
  assert.deepEqual(proofs,repeat?[10,30,40]:[10,30])
  assert.deepEqual(recoveries,repeat?[20,40]:[20])
  assert.equal(q.state.bestScore,best);assert.equal(q.state.maximumProven,true);assert.equal(q.state.complete,true)
  assert.equal(q.state.recoveries,repeat?2:1);assert.equal(q.state.useBounds,false)
  assert.equal(new Set(records.map(r=>r.packed.tag)).size,records.length,'Restarts must not re-archive any old team')
  assert.deepEqual(records.filter(r=>r.score===best).map(r=>r.packed.tag).sort(),[best+'a',best+'b',best+'c'])
  assert.ok(['10a','10b','20a'].every(tag=>records.some(r=>r.packed.tag===tag)),'Earlier collections survive as other results')
  for(let recovery=1;recovery<=q.state.recoveries;recovery++){
    assert.deepEqual(q.visits.filter(v=>v.recoveries===recovery&&v.phase==='optimizing').map(v=>v.domain),[0,1],'Recovery rechecks earlier domains, not only the remaining suffix')
    assert.ok(q.visits.filter(v=>v.recoveries===recovery).every(v=>v.bounds===false))
  }
}
console.log('Recovery coordinator: cross-domain rewind, repeated counterexamples, primary/prefer objectives, exact ties and no duplicate/lost history passed')

for(const stage of ['found','archived','reproved','recollected','done']){
  const events=[],id=100,query=fixture();let controller
  controller=createScoreTeamController({createSearch:()=>query,yieldTask:async()=>{},post:m=>{
    events.push(m)
    if(m.type!=='score-progress'||!m.progress.recoveries)return
    if(stage==='found'&&m.progress.phase==='optimizing'&&m.progress.bestScore===20)controller.cancel(id)
    if(stage==='reproved'&&m.progress.phase==='collecting'&&m.progress.bestScore===30)controller.cancel(id)
  },createStore:async()=>{
    const real=await createScoreTeamStore()
    return {...real,append:async r=>{
      await real.append(r)
      if(stage==='archived'&&r.packed.tag==='20a'||stage==='recollected'&&r.packed.tag==='30b')controller.cancel(id)
    }}
  }})
  await controller.start(id,{aiMode:'off'})
  assert.ok(!events.some(m=>m.type==='error'),'A higher score is recoverable, not a terminal error')
  const result=events.find(m=>m.type===(stage==='done'?'score-complete':'score-stopped')).result.value,info=result.scoreTeamResults
  assert.equal(result.ok,true);assert.equal(info.recoveries,1)
  const reproved=['reproved','recollected','done'].includes(stage)
  assert.equal(info.bestScore,reproved?30:20);assert.equal(info.maximumProven,reproved)
  assert.equal(info.complete,stage==='done');assert.equal(info.stopped,stage!=='done')
  assert.equal(info.bestCount,{found:0,archived:1,reproved:1,recollected:2,done:3}[stage])
  assert.equal(info.otherCount,reproved?3:2)
  assert.equal(result.plans[0].total,info.bestScore)
  assert.equal(info.previewOnly,stage==='found')
  assert.equal(result.resultStatus.optimality,stage==='done'?'search-complete':reproved?'maximum-proven':'candidate')
  const recovery=events.find(m=>m.type==='score-progress'&&m.progress.recoveries===1)
  assert.equal(recovery.progress.maximumProven,false);assert.equal(recovery.preview.total,20,'Immediately publish the counterexample before writing its archive record')
  await controller.page({id,kind:'other'})
  assert.equal(events.at(-1).ok,true);assert.ok(events.at(-1).result.value.plans.every(p=>p.total<info.bestScore))
  await controller.exportTeams({id})
  const exported=events.at(-1);assert.equal(exported.ok,true)
  const lines=(await(await fetch(exported.url)).text()).trim().split('\n').map(JSON.parse);URL.revokeObjectURL(exported.url)
  assert.equal(lines[0].recoveries,1);assert.equal(lines[0].maximumProven,reproved);assert.equal(lines[0].complete,stage==='done')
  assert.equal(lines.length-1,info.bestCount+info.otherCount)
  if(stage==='found')assert.equal(lines[0].feasiblePreview.total,20)
  if(stage==='done'){
    await controller.start(id+1,{aiMode:'off'})
    assert.equal(events.at(-1).result.value.scoreTeamResults.cacheHit,true)
    assert.equal(events.at(-1).result.value.scoreTeamResults.bestCount,3)
  }
}
console.log('Recovery Worker: immediate higher preview, stop before/after archive and reproof, old-score reclassification, paging, export and complete-only cache passed')
for(const stop of [true,false]){
  const query=fixture({extraHistory:128}),events=[];let controller
  controller=createScoreTeamController({createSearch:()=>query,yieldTask:async()=>{},post:m=>{
    events.push(m)
    if(stop&&m.type==='score-progress'&&m.progress.recoveries)controller.cancel(200)
  }})
  await controller.start(200,{})
  const info=events.at(-1).result.value.scoreTeamResults
  assert.equal(info.bestCount,stop?0:3);assert.equal(info.otherCount,stop?130:131)
  const ids=new Set()
  for(let offset=0;offset<info.otherCount;offset+=64){
    await controller.page({id:200,kind:'other',offset})
    const page=events.at(-1).result.value
    assert.equal(page.scoreTeamResults.offset,offset)
    for(const record of (await controller.current.store.page({kind:'other',offset,bestScore:info.bestScore})).records)ids.add(record.packed.tag)
  }
  assert.equal(ids.size,info.otherCount,'Recovery retains every previously collected page, without a 64-team cutoff')
  await controller.exportTeams({id:200})
  const file=events.at(-1),lines=(await(await fetch(file.url)).text()).trim().split('\n').map(JSON.parse);URL.revokeObjectURL(file.url)
  assert.equal(lines.length-1,info.bestCount+info.otherCount)
  assert.equal(lines[0].maximumProven,!stop)
}
console.log('Recovery multi-page history: 130 earlier ties survive stop/completion, reclassification, every page and full export')
