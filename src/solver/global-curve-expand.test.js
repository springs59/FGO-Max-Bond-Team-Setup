import assert from 'node:assert/strict'
import {createGlobalExpansion,projectGlobalDomain,solveProjectedGlobal,globalMemberPositions} from './global-curve-expand.js'
import {globalCurveValue,buildGlobalEnvelope,globalWinnerAt} from './global-envelope.js'
import {describeGlobalCurve,mergeGlobalIntervals} from './global-curve-description.js'
let checks=0
for (const party of [0,50]) {
 const rows=[{id:1,cost:0,self:0,party:0},{id:2,cost:3,self:200,party},{id:2,cost:4,self:500,party},{id:3,cost:4,self:0,party:0},{id:4,cost:7,self:0,party:0}].map((r,i)=>({...r,form:String(i),name:`S${r.id}`}))
 const groups=[{flat:0,rates:[100,100,100,100,100],items:[{id:1,name:'全体',cost:2}]},{flat:50,rates:[0,0,0,0,0],items:[{id:2,name:'肖像A',cost:1},{id:3,name:'肖像B',cost:1}]},{flat:0,rates:[0,200,0,200,200],items:[{id:4,name:'限定',cost:2}]}]
 const supports=[{flat:0,rates:rows.map(()=>0),items:[]},{flat:0,rates:rows.map(()=>150),items:[{id:5,name:'助战15%',cost:12}]},{flat:50,rates:rows.map(()=>0),items:[{id:6,name:'助战肖像',cost:5}]}]
 const source={rows,groups,supports,guestPartyMax:0}
 for (const requiredIds of [[],[2],[1,3],[2,4]]) {
  const options={cost:22,portraitCap:2,capped:-1,requiredIds}, expansion=createGlobalExpansion(source,options),records=[...expansion.iterate()],bank=solveProjectedGlobal(source,options)
  for(const c of records){const d=describeGlobalCurve(c,expansion.meta);assert.ok(d.ownEquipped<=d.ownCount);assert.ok(d.ownCount+(d.support?1:0)<=6);assert.equal(d.ownEmpty+d.ownEquipped,d.ownCount);const ids=d.members.map(m=>m.row.id);assert.equal(ids.length,new Set(ids).size);assert.ok(requiredIds.every(id=>ids.includes(id)));let cost=d.members.reduce((s,m)=>s+m.row.cost,0);for(const g of d.equipment)cost+=g.items.reduce((s,x)=>s+x.cost,0);assert.equal(cost,c[7]);checks++}
  const literal=[]
  function teams(at,team){if(at===4){if(team.length&&team.some(x=>!x.cap))emit(team);return}const id=at+1;if(!requiredIds.includes(id))teams(at+1,team);for(let r=0;r<rows.length;r++)if(rows[r].id===id)for(const cap of [false,true])teams(at+1,[...team,{r,cap}])}
  function emit(team){const n=team.length,k=team.filter(x=>x.cap).length;for(let a=0;a<=1;a++)for(let p=0;p<=2;p++)for(let t=0;t<=1;t++){if(a+p+t>n)continue;const cost=team.reduce((s,x)=>s+rows[x.r].cost,0)+2*a+p+2*t;if(cost>22)continue;for(let l=0;l<3;l++)for(let si=0;si<(l?3:1);si++)for(let mask=0;mask<2**n;mask++){let f=0;for(let i=0;i<n;i++)if(mask&(1<<i))f++;const fc=l===2?2:3,bc=l===1?2:3;if(f>fc||n-f>bc)continue;const terms=[];for(let i=0;i<n;i++){const x=team[i];if(x.cap)continue;terms.push([(mask&(1<<i))?(l===2?1240:1200):(l===2?1040:1000),1000+rows[x.r].self+team.reduce((s,x)=>s+rows[x.r].party,0)+250*k+supports[si].rates[x.r]+100*a+groups[2].rates[x.r]*t])}literal.push({l,si,k,p,cost,terms,flat:50*p+supports[si].flat})}}}
  teams(0,[])
  for(const cost of [0,4,8,14,22])for(const k of [-1,0,1,2,3])for(const l of [0,1,2])for(const si of (l?[0,1,2]:[0]))for(const portraitCap of [0,1,2]){
   const opts={cost,capped:k,layout:l,support:l?si:-1,portraitCap},env=buildGlobalEnvelope(bank.records,bank.meta,opts)
   for(const B of [0,1,9,249,250,499,1000,10000]){let best=-1,bestCost=Infinity;for(const c of literal)if(c.cost<=cost&&(k<0||c.k===k)&&c.l===l&&c.si===si&&c.p<=portraitCap){const value=c.terms.reduce((s,[f,t])=>s+Math.floor(Math.floor(B*f/1000)*t/1000)+c.flat,0);if(value>best||value===best&&c.cost<bestCost){best=value;bestCost=c.cost}}const id=globalWinnerAt(env,B);if(id===null)assert.equal(best,-1);else{assert.equal(globalCurveValue(bank.records[id],bank.meta,B),best,JSON.stringify({party,requiredIds,opts,B}));assert.equal(bank.records[id][7],bestCost)}checks++}
  }
  assert.ok(records.some(c=>c.slice(20).every(x=>x===0)), '肖像和其他礼装均可不带')
  const x=records[0],clone=x.slice(),merged=mergeGlobalIntervals([{lo:5,hi:8,id:0},{lo:7,hi:10,id:1},{lo:20,hi:21,id:0}], [x,clone],expansion.meta);assert.equal(merged.length,1);assert.deepEqual(merged[0].ranges,[[5,10],[20,21]])
 }
}
const wide={rows:Array.from({length:8},(_,i)=>({id:i+1,cost:i,self:0,party:0})),groups:[{rates:Array(8).fill(100),flat:0,items:[]}],supports:[{rates:Array(8).fill(0),flat:0,items:[]}],guestPartyMax:0}
assert.ok(!projectGlobalDomain(wide).rows.some(r=>r.id===8));assert.ok(projectGlobalDomain(wide,[8]).rows.some(r=>r.id===8))
console.log(JSON.stringify({globalExpansionLiteralQueriesAndWitnessChecks:checks,passed:true}))
