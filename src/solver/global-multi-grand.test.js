import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import {createGlobalExpansion,solveProjectedGlobal} from './global-curve-expand.js'
import {buildGlobalEnvelope,globalWinnerAt,globalCurveValue} from './global-envelope.js'
import {describeGlobalCurve} from './global-curve-description.js'
const maxOwn=Number(process.env.TEST_MAX_OWN||3)
const rows=[{id:1,cost:0,cl:1},{id:2,cost:1,cl:1},{id:3,cost:1,cl:8},{id:4,cost:2,cl:8},{id:5,cost:2,cl:8}].map(r=>({...r,cl:process.env.TEST_DISTINCT_CLASSES&&r.id<4?r.id:r.cl,ruleRole:(process.env.TEST_DISTINCT_CLASSES&&r.id<4?r.id:r.cl)<<8,self:0,party:0,name:'S'+r.id,form:'a0',className:r.cl===1?'saber':'ruler'}))
const item=(id,cost)=>({id,cost,name:'CE'+id,rewardEligible:true}),groups=[{rates:[200,200,0,0,0],flat:0,items:[item(10,2)]},{rates:rows.map(()=>100),flat:0,items:[item(11,3),item(12,3),...(process.env.TEST_EXTRA_CE?[item(15,3)]:[])]},{rates:rows.map(()=>0),flat:50,items:[item(13,1),item(14,1)]}],sup={rates:rows.map(()=>150),flat:0,items:[item(20,0)],layout:1,external:[{svtId:100,position:5},{svtId:200,position:6}],freePositions:[0,1,2,3],frontShare:0,satisfiedMask:0,bannedIds:[]},rules={generic:true,grand:true,grandSlots:3,grandPositions:process.env.TEST_ALL_GRAND?[1,2,3,4,5,6]:[1,2,3],layouts:[1],ownMin:1,ownMax:maxOwn,totalMin:1,totalMax:6,frontMin:1,frontMask:0},source={rows,groups,supports:[sup],rules,guestPartyMax:0},opts={cost:7,portraitCap:6,capped:-1},exp=createGlobalExpansion(source,opts),bank=solveProjectedGlobal(source,opts),meta=bank.meta
const literal=[],items=groups.flatMap((g,j)=>g.items.map(x=>({...x,g:j})));let checks=0
function emit(team){const n=team.length;if(!n||n>maxOwn)return
 function seats(at,used){if(at===n){const classes=new Map();for(let i=0;i<n;i++)if(process.env.TEST_ALL_GRAND||used[i]<3)classes.set(rows[team[i]].cl,(classes.get(rows[team[i]].cl)||0)+1);const freeCap=Math.min(rules.grandSlots,[...classes].reduce((s,[cl,n])=>s+Math.min(cl===8?2:1,n),0))
  for(let cap=0;cap<2**n-1;cap++)for(let ceMask=0;ceMask<2**items.length;ceMask++){const worn=items.filter((_,i)=>ceMask&(1<<i));for(let free=0;free<2**worn.length;free++){
   const freeItems=worn.filter((_,i)=>free&(1<<i));if(freeItems.length>freeCap||worn.length-freeItems.length>n)continue
   const cost=team.reduce((s,i)=>s+rows[i].cost,0)+worn.reduce((s,x,i)=>s+(free&(1<<i)?0:x.cost),0);if(cost>7)continue
   const k=team.filter((_,i)=>cap&(1<<i)).length,flat=worn.reduce((s,x)=>s+groups[x.g].flat,0),terms=team.flatMap((r,j)=>cap&(1<<j)?[]:[[used[j]<3?1200:1000,1150+250*k+worn.reduce((s,x)=>s+groups[x.g].rates[r],0)]])
   if(!used.some(i=>i<3))continue;literal.push({cost,k,p:worn.filter(x=>groups[x.g].flat).length,flat,terms});checks++
  }}return}
  for(const i of sup.freePositions)if(!used.includes(i))seats(at+1,[...used,i])
 }seats(0,[])
}
function teams(id,team){if(id===6){emit(team);return}teams(id+1,team);if(team.length<maxOwn)teams(id+1,[...team,id-1])}teams(1,[])
const tmp=fs.mkdtempSync(os.tmpdir()+'/multi-grand-'),lines=[`${meta.rows.length} ${meta.groups.length} 1 7 0 3 2 1 ${maxOwn} 1 6 0 1 1 ${process.env.TEST_ALL_GRAND?63:7}`,...meta.rows.map(r=>[r.id,r.cost,r.self,r.party,r.ruleRole].join(' ')),...meta.groups.map(g=>[g.flat,g.items.length,...g.items.map(x=>x.cost),...g.rates].join(' ')),[sup.flat,...sup.rates,1,15,2,0,0,0].join(' ')]
fs.writeFileSync(tmp+'/in',lines.join('\n'));execFileSync('g++',['-O2','-std=c++17','scripts/quest-global-curves/global.cpp','-o',tmp+'/engine']);execFileSync(tmp+'/engine',[tmp+'/in',tmp+'/out'],{stdio:'ignore'})
const native=fs.readFileSync(tmp+'/out','utf8').trim().split('\n').filter(Boolean).map(line=>{const c=line.split(' ').map(Number),f=c.pop(),free=c.splice(-groups.length);c.pop();const positions=[...Array(f).keys(),...Array.from({length:c[3]-f},(_,i)=>3+i)];c.push({ownPositions:positions,...(free.some(Boolean)?{rewardCounts:free}:{})});return c})
for(const cost of [0,2,4,7])for(const capped of [-1,0,1,2])for(const portraitCap of [0,1,2]){
 const options={cost,capped,portraitCap},envs=[buildGlobalEnvelope(bank.records,meta,options),buildGlobalEnvelope(native,meta,options)]
 for(const B of [0,1,249,250,500,1000,6000]){let best=-1,bestCost=Infinity;for(const c of literal)if(c.cost<=cost&&(capped<0||c.k===capped)&&c.p<=portraitCap){const v=c.terms.reduce((s,[f,t])=>s+Math.floor(Math.floor(B*f/1000)*t/1000)+c.flat,0);if(v>best||v===best&&c.cost<bestCost){best=v;bestCost=c.cost}}
  for(let j=0;j<2;j++){const recs=j?native:bank.records,id=globalWinnerAt(envs[j],B);assert.equal(id===null?-1:globalCurveValue(recs[id],meta,B),best,JSON.stringify({options,B,j}));if(id!==null)assert.equal(recs[id][7],bestCost)}checks++
 }
}
for(const c of exp.iterate()){const d=describeGlobalCurve(c,exp.meta);assert.ok(d.ownNormal<=d.ownCount);assert.ok(d.grandMembers.every(m=>process.env.TEST_ALL_GRAND||m.position<=3));assert.equal(d.grandMembers.length,d.rewards.length);assert.equal(d.members.reduce((s,m)=>s+m.row.cost,0)+d.equipment.flatMap(g=>g.items).filter(x=>!d.rewards.some(r=>r.id===x.id)).reduce((s,x)=>s+x.cost,0),c[7]);const classes=new Map();for(const m of d.grandMembers)classes.set(m.row.cl,(classes.get(m.row.cl)||0)+1);assert.ok([...classes].every(([cl,n])=>n<=(cl===8?2:1)));checks++}
assert.ok(bank.records.some(c=>(c.at(-1)?.rewardCounts||[]).reduce((s,n)=>s+n,0)>=2))
console.log(JSON.stringify({multiGrandLiteralChecks:checks,passed:true}))
