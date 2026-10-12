import assert from 'node:assert/strict'
import { solveInventoryCurves } from './inventory-curve-solver.js'
import { applyCraftEssences } from '../atlas.js'
import { calcParty } from '../bond.js'
import { evaluateBondCurve } from './bond-curve.js'
import { servantCost } from '../servant-cost.js'
const ce=(id,rate,trait=0,flat=0)=>({id,cost:2,skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target:'ptFull',rate:mlb?rate:Math.floor(rate/2),add:flat,tvals:trait?[{id:trait}]:[],andTvals:[]}]}))})
function brute(opts, bySupport=new Map()){
  let best=0
  function pick(i,team){
    if(i<opts.servants.length){pick(i+1,team);for(const form of opts.formsOf(opts.servants[i]))pick(i+1,[...team,{svt:opts.servants[i],form}]);return}
    if(!team.length || team.length<(opts.minimumOwn||1) || (opts.requiredIds||[]).some(id=>!team.some(r=>r.svt.id===id)))return
    const n=team.length
    for(const supportPos of opts.layouts||[3,6])for(let frontMask=0;frontMask<2**n;frontMask++){
      const front=team.filter((_,j)=>frontMask&(1<<j)),back=team.filter((_,j)=>!(frontMask&(1<<j)))
      const fp=[1,2,3].filter(p=>p!==supportPos&&!opts.emptyPositions?.includes(p)),bp=[4,5,6].filter(p=>p!==supportPos&&!opts.emptyPositions?.includes(p))
      if(!front.length||front.length>fp.length||back.length>bp.length)continue
      if(team.some(r=>opts.requiredSeats?.[r.svt.id] && (front.includes(r)?'front':'back')!==opts.requiredSeats[r.svt.id]))continue
      const aura=team.reduce((s,r)=>s+Math.round((opts.bonuses[r.svt.id]?.party||0)*1000)+(opts.stateOf(r.svt).aura||0),0)
      const slots=[...front.map((r,j)=>({...r,p:fp[j]})),...back.map((r,j)=>({...r,p:bp[j]}))].map(({svt,form,p})=>({position:p,filled:true,svtId:svt.id,traitIds:form.traitIds,bondMaxed:opts.stateOf(svt).maxed,bond15:Boolean(opts.stateOf(svt).aura),eventPassive:(opts.bonuses[svt.id]?.totalSecondLayer||0)+(aura-(opts.stateOf(svt).aura||0))/1000,ceMlb:true,cost:servantCost(svt,form)}))
      const used=new Set()
      function equip(j,cost){
        if(opts.costLimit!=null&&cost>opts.costLimit)return
        if(j<slots.length){slots[j].ceId=0;equip(j+1,cost);for(let k=0;k<opts.ownCes.length;k++){if(used.has(k))continue;used.add(k);slots[j].ceId=opts.ownCes[k].id;slots[j].ceMlb=opts.ownCes[k].accountMlb!==false;equip(j+1,cost+opts.ownCes[k].cost);used.delete(k)}return}
        for(const support of supportPos?[null,...opts.supportCes]:[null]){
          const party=[...slots.map(s=>({...s})),...(supportPos?[{position:supportPos,filled:true,isSupport:true,ceId:support?.id||0,ceMlb:true}]:[])]
          applyCraftEssences(party,[...opts.ownCes,...opts.supportCes])
          // Aura was independently settled above, so disable automatic bond15.
          const out=calcParty(opts.base,false,party,{bond15Aura:false})
          if(out.ok){const score=out.results.reduce((sum,r)=>sum+r.final,0);best=Math.max(best,score);const key=`${support?.id||0}:${supportPos}`;bySupport.set(key,Math.max(bySupport.get(key)||0,score))}
        }
      }
      equip(0,slots.reduce((s,r)=>s+r.cost,0))
    }
  }
  pick(0,[]);return best
}
for(let seed=0;seed<12;seed++){
  const servants=[1,2,3].map(id=>({id,collectionNo:id,cost:id+1,rarity:3,traitIds:[id%2+10]}))
  const ownCes=[ce(101,100),ce(102,200,10),ce(103,0,0,50),ce(106,0,0,50)]
  if(seed%2){ownCes[0].accountMlb=false;ownCes.push({...ce(101,100),accountMlb:true})}
  const opts={servants,ownCes,supportCes:[ce(104,150),ce(105,200,11),ce(107,0,0,50)],base:seed<3?seed:165+seed,
    costLimit:seed%2?9:20,bonuses:{2:{totalSecondLayer:seed/10},3:{party:.05}},
    stateOf:s=>({maxed:s.id===1&&seed%3===0,aura:s.id===1&&seed%3===0?250:0}),
    formsOf:s=>[{key:'default',cost:s.cost,traitIds:s.traitIds},{key:'c1',cost:s.cost+1,traitIds:[10,11]}]}
  const expectedBySupport=new Map()
  const expected=brute(opts,expectedBySupport)
  const evaluated=[]
  const actual=solveInventoryCurves({...opts,onEvaluatedPlan:plan=>evaluated.push(plan)})
  assert.ok(evaluated.length>=actual.plans.length)
  assert.ok(evaluated.some(p=>p.score<actual.score),'non-winning evaluated states must be observed')
  for(const plan of evaluated)assert.equal(evaluateBondCurve(plan.curve,opts.base).total,plan.score,'stored DP curve must reproduce its actual score')
  assert.ok(actual.plans.length>1,`multiple support/position alternatives ${seed}`)
  const seen=new Set()
  for(const plan of actual.plans){
    const support=plan.slots.find(s=>s.s)
    const key=`${support.ce}:${support.p}`
    assert.equal(plan.score,expectedBySupport.get(key),`alternative must be optimal for its support and position: ${seed} ${key}`)
    assert.ok(!seen.has(key));seen.add(key)
    assert.ok(plan.cost<=opts.costLimit)
  }
  assert.equal(actual?.score||0,expected,`inventory/COST/portrait/event/form/support differential ${seed}`)
  assert.equal(solveInventoryCurves({...opts,allSupportAlternatives:false}).score,expected,`primary optimum ${seed}`)
  assert.equal(solveInventoryCurves({...opts,allSupportAlternatives:false,initialScore:expected}).score,expected,`feasible seeded bound must preserve tied optimum ${seed}`)
}
for(let seed=0;seed<18;seed++){
  const servants=[1,2,3].map(id=>({id,collectionNo:id,cost:id,rarity:3,traitIds:[10+id%2]}))
  const opts={servants,ownCes:[ce(101,200,10),ce(102,0,0,50)],supportCes:[ce(103,150)],
    formsOf:s=>[{key:'default',cost:s.cost,traitIds:s.traitIds}],base:177+seed,
    stateOf:s=>({maxed:s.id===3&&seed%4===0,aura:s.id===3&&seed%4===0?250:0}),
    bonuses:{1:{party:.05},2:{party:.10,totalSecondLayer:.5}},costLimit:seed%3?8:15,
    layouts:seed%2?[0]:[3,6],requiredIds:[1],requiredSeats:seed%3?{}:{1:'back'},
    emptyPositions:seed%4?[5]:[],minimumOwn:seed%5?1:3,allSupportAlternatives:false}
  const expected=brute(opts)
  assert.equal(solveInventoryCurves(opts)?.score||0,expected,`constrained/aura-sum differential ${seed}`)
  assert.equal(solveInventoryCurves({...opts,initialScore:expected})?.score||0,expected,`seeded constrained/aura-sum differential ${seed}`)
}
{
  const servants=Array.from({length:20},(_,i)=>({id:i+1,cost:1,traitIds:[]}))
  const opts={servants,ownCes:[],supportCes:[],base:1000,formsOf:s=>[{key:'default',cost:1,traitIds:[]}],
    bonuses:Object.fromEntries(servants.map(s=>[s.id,{party:.05}])),allSupportAlternatives:false}
  assert.equal(solveInventoryCurves(opts).score,7000,'more than ten aura identities stay in the effect solver')
  const noSupport=solveInventoryCurves({...opts,layouts:[0],minimumOwn:6})
  assert.equal(noSupport.score,8580)
  assert.equal(noSupport.certificate.auraAmounts,7,'six seats give seven distinct amounts')
}
console.log('inventory-curve-solver.test.js ok')
