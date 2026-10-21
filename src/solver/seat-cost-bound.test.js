import assert from 'node:assert/strict'
import { seatCostBounds } from './seat-cost-bound.js'
import { solveInventoryCurves, probeInventoryStart } from './inventory-curve-solver.js'
import { randomSource } from '../../scripts/ai-search-cases.mjs'

// Independent literal seat assignment, including different forms of the same
// identity. No masks or dynamic-programming recurrence in the test oracle.
let checks=0
for(let seed=0;seed<32;seed++){
  const random=randomSource(29000000+seed)
  const rows=Array.from({length:4},(_,i)=>[0,1].map(j=>({svt:{id:i+1},form:{key:String(j)},cost:Math.floor(random()*9)}))).flat()
  const required=new Set(seed%3===0?[1,2]:[1])
  const requiredSeats=seed%2?{1:'back',2:'back'}:{1:'front'}
  const fixed=seed%4===0?{1:4,2:4}:seed%4===1?{1:5}:{}
  const empty=seed%3===0?[2,5]:[],minimum=seed%4
  const layouts=[0,3,6].map(position=>{
    const positions=[1,2,3,4,5,6].filter(p=>p!==position&&!empty.includes(p))
    return {position,positions,front:positions.filter(p=>p<=3),back:positions.filter(p=>p>3)}
  })
  const bounds=seatCostBounds(rows,layouts,required,requiredSeats,fixed,minimum)
  for(const [index,layout] of layouts.entries()){
    const expected=Array(7).fill(Infinity)
    function enumerate(id,members){
      if(id===5){
        if(members.length<minimum||!members.some(x=>x.position<=3))return
        for(let n=0;n<=members.length;n++)expected[n]=Math.min(expected[n],members.reduce((s,x)=>s+x.cost,0))
        return
      }
      if(!required.has(id))enumerate(id+1,members)
      for(const r of rows.filter(r=>r.svt.id===id))for(const position of layout.positions){
        if(members.some(x=>x.position===position)||fixed[id]&&fixed[id]!==position)continue
        if(requiredSeats[id]==='front'&&position>3||requiredSeats[id]==='back'&&position<=3)continue
        enumerate(id+1,[...members,{cost:r.cost,position}])
      }
    }
    enumerate(1,[])
    assert.deepEqual(bounds[index],expected,JSON.stringify({seed,layout}));checks++
  }
}

const servants=Array.from({length:5},(_,i)=>({id:i+1,cost:i===4?50:1,traitIds:[]}))
const ce=(id,cost,rate)=>({id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,add:0,eventId:0,tvals:[],andTvals:[]}]}))})
const cheap=ce(101,1,100),expensive=ce(102,100,10000)
const opts={servants,ownCes:[cheap,cheap,cheap,cheap,expensive],supportCes:[cheap],base:815,costLimit:7,
  formsOf:s=>[{key:'default',cost:s.cost,traitIds:[]}],requiredIds:[1,2,3],requiredSeats:{1:'back',2:'back',3:'back'},
  minimumOwn:4,layouts:[6,3],bonuses:{5:{totalSecondLayer:100}},allSupportAlternatives:false}
const start=probeInventoryStart({...opts,aiFramework:'on'}),on=solveInventoryCurves({...opts,aiMode:'on',aiFramework:'on'}),off=solveInventoryCurves({...opts,aiMode:'off'})
assert.ok(start&&on&&off)
assert.equal(start.complete,false,'an initial witness is never labelled an optimal result')
assert.equal(start.ai.inferenceCalls,1)
assert.ok(start.cost<=7)
assert.equal(start.score,on.certificate.ai.initialLowerBound)
assert.deepEqual([on.score,on.cost],[off.score,off.cost])
assert.ok(on.certificate.ai.seatCostPruned>0,'three mandatory back members cannot fit with a back-row helper')
assert.ok(on.score<on.certificate.ai.initialUpperBound||on.certificate.ai.initialUpperBound===on.score)
assert.ok(on.slots.every(s=>s.svt!==5&&s.ce!==102),'unaffordable theoretical bonuses never become a legal start or answer')
console.log(JSON.stringify({seatCostLiteralChecks:checks,unreachableHighBonus:true,verifiedStart:true,passed:true}))
