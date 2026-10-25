import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createScoreTeamSearch} from '../src/recommend.js'
import {grandStockFixture,GRAND_STOCK_CASES} from './grand-stock-fixtures.mjs'
import {ceHasBondGain} from '../src/game-data.js'

const records=[]
for(const id of GRAND_STOCK_CASES){
 const opts=grandStockFixture(id),began=performance.now(),q=createScoreTeamSearch(opts),history=[]
 const inactive=new Set(opts.ces.filter(c=>!ceHasBondGain(c)).map(c=>c.id))
 assert.ok(q.ok,q.error)
 let proof=false
 for(const event of q.iterator){
  assert.ok(performance.now()-began<120000,id+': public-stock proof did not finish within the regression deadline')
  if(event.type==='best'){
   const plan=q.hydrate(event.record)
   assert.ok(plan.costUsed<=opts.costLimit)
   const grand=plan.slots.find(s=>s.isGrand&&!s.isSupport)
   if(id!=='full-stock')assert.equal(grand.svtId,600100)
   for(const s of plan.slots)assert.ok(!inactive.has(s.ceId)&&!inactive.has(s.ceRewardId),'Never add a non-bond CE from the fixture inventory')
   history.push({ms:performance.now()-began,score:event.score})
  }
  if(event.type==='phase'){proof=true;break}
 }
 assert.ok(proof&&q.state.maximumProven,id+': a preview alone is not an objective proof')
 assert.equal(q.state.stats.ceFirstProofs,1,id+': the large inventory/pins must stay on the exact DP path')
 assert.equal(q.state.stats.ceFirstFallback,undefined)
 // Conservative lower witnesses, not hardcoded catalog-dependent maxima.
 const floor={'full-stock':54500,'designated-grand':52222,'friend-pins':46715,'own-pins':50895}[id]
 assert.ok(q.state.bestScore>=floor,id+': previously validated feasible witness remains reachable')
 q.iterator.return()
 records.push({id,ms:performance.now()-began,best:q.state.bestScore,maximumProven:q.state.maximumProven,history,stats:q.state.stats})
 console.log(JSON.stringify({id,passed:true,ms:records.at(-1).ms,best:q.state.bestScore}))
}
mkdirSync('test-output/grand-incumbent',{recursive:true})
writeFileSync('test-output/grand-incumbent/proof-regression.json',JSON.stringify({passed:true,records,scope:'Public current CN inventory, objective proof and exact witnesses only; no private account and no claim that all ties have been collected.'},null,2)+'\n')
