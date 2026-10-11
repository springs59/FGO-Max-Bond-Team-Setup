import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createGlobalExpansion,solveProjectedGlobal,globalMemberPositions} from './global-curve-expand.js'
import {buildGlobalEnvelope,globalWinnerAt,globalCurveValue} from './global-envelope.js'
import {compileSpecialGlobalRules,restrictSpecialGlobalRows} from './global-special-quest.js'
const r=(type,vals,rangeType='equal')=>({restriction:{type,targetVals:vals,rangeType}})
const parsed=compileSpecialGlobalRules({}, {flags:[],restrictions:[r('individuality',[110],'notEqual'),r('fixedMySvtIndividualityPositionMain',[1,2]),r('fixedCostume',[2])]}, {mstQuestPhase:{script:{overwriteLimitCountSvtIds:[2],overwriteLimitCounts:[17]}}})
assert.equal(parsed.frontMask,3);assert.equal(parsed.supported,true)
const rows=[{id:1,cost:0,traits:[1],ruleRole:1},{id:2,cost:2,traits:[2],ruleRole:2},{id:2,cost:3,traits:[2],ruleRole:2},{id:3,cost:1,traits:[3],ruleRole:0},{id:4,cost:2,traits:[110],ruleRole:0}].map((r,i)=>({...r,self:i===2?200:0,party:r.id===2?50:0,name:'S'+r.id,form:String(i)}))
const item=(id,cost)=>({id,cost,name:'CE'+id}),groups=[{rates:[200,0,200,200,0],flat:0,items:[item(10,2)]},{rates:rows.map(()=>100),flat:0,items:[item(11,2)]},{rates:rows.map(()=>0),flat:50,items:[item(12,1),item(13,1)]}]
const externals=[{svtId:100,name:'NPC1',position:1},{svtId:200,name:'NPC2',position:5}]
const supports=[{rates:rows.map(()=>150),flat:0,items:[item(20,0)],layout:2,external:externals,freePositions:[1,2,3,5],frontShare:40,satisfiedMask:0,bannedIds:[]},{rates:rows.map(()=>0),flat:50,items:[item(21,0)],layout:2,external:externals,freePositions:[1,2,3,5],frontShare:40,satisfiedMask:2,bannedIds:[2]}]
let checks=0
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'special-curves-')),engine=tmp+'/engine'
execFileSync('g++',['-O2','-std=c++17','scripts/quest-global-curves/global.cpp','-o',engine])
for(const frontMask of [0,1,3]){
 const rules={generic:true,layouts:[2],ownMin:1,ownMax:4,totalMin:3,totalMax:6,frontMin:2,frontMask},source={rows,groups,supports,rules,guestPartyMax:0},opts={cost:8,portraitCap:4,capped:-1},exp=createGlobalExpansion(source,opts),bank=solveProjectedGlobal(source,opts),meta=bank.meta,literal=[]
 const items=groups.flatMap((g,j)=>g.items.map(x=>({...x,g:j})))
 function emit(team){const n=team.length;if(!n)return
  for(let si=0;si<supports.length;si++){const sup=supports[si];if(team.some(r=>sup.bannedIds.includes(rows[r].id)))continue
   function seats(at,used){if(at===n){for(let cap=0;cap<2**n-1;cap++)for(let eq=0;eq<2**items.length;eq++){
    const worn=items.filter((_,i)=>eq&(1<<i));if(worn.length>n)continue;const cost=team.reduce((s,i)=>s+rows[i].cost,0)+worn.reduce((s,i)=>s+i.cost,0);if(cost>8)continue
    let mask=sup.satisfiedMask;for(let j=0;j<n;j++)if(used[j]<3)mask|=rows[team[j]].ruleRole;if((mask&frontMask)!==frontMask||used.filter(i=>i<3).length+1<2)continue
    const k=team.filter((_,i)=>cap&(1<<i)).length,party=team.reduce((s,i)=>s+rows[i].party,0),flat=sup.flat+worn.reduce((s,i)=>s+groups[i.g].flat,0),terms=team.flatMap((r,j)=>cap&(1<<j)?[]:[[used[j]<3?1240:1040,1000+rows[r].self+party+250*k+sup.rates[r]+worn.reduce((s,i)=>s+groups[i.g].rates[r],0)]])
    literal.push({cost,k,p:worn.filter(i=>groups[i.g].flat).length,si,flat,terms});checks++
   }return}
   for(const i of sup.freePositions)if(!used.includes(i))seats(at+1,[...used,i])
   }seats(0,[])
  }
 }
 function teams(id,team){if(id===5){emit(team);return}teams(id+1,team);for(let r=0;r<rows.length;r++)if(rows[r].id===id)teams(id+1,[...team,r])}teams(1,[])
 const lines=[`${meta.rows.length} ${meta.groups.length} ${meta.supports.length} 8 0 0 4 1 4 3 6 ${frontMask} 1 2`,...meta.rows.map(r=>[r.id,r.cost,r.self,r.party,r.ruleRole].join(' ')),...meta.groups.map(g=>[g.flat,g.items.length,...g.items.map(x=>x.cost),...g.rates].join(' ')),...meta.supports.map(s=>[s.flat,...s.rates,s.layout,s.freePositions.reduce((m,i)=>m|(1<<i),0),2,1,s.satisfiedMask,s.bannedIds.length,...s.bannedIds].join(' '))]
 fs.writeFileSync(tmp+'/in',lines.join('\n'));execFileSync(engine,[tmp+'/in',tmp+'/out'],{stdio:'ignore'})
 const native=fs.readFileSync(tmp+'/out','utf8').trim().split('\n').filter(Boolean).map(line=>{const c=line.split(' ').map(Number),f=c.pop();c.pop();const sup=meta.supports[c[1]],old=[...Array(f).keys(),...Array.from({length:c[3]-f},(_,i)=>3+i)],positions=[...sup.freePositions.filter(i=>i<3).slice(0,f),...sup.freePositions.filter(i=>i>=3).slice(0,c[3]-f)],a=c.slice(8,14),rs=c.slice(14,20);c.fill(0,8,20);old.forEach((at,j)=>{c[8+positions[j]]=a[at];c[14+positions[j]]=rs[at]});c.push({ownPositions:positions});return c})
 for(const cost of [0,3,5,8])for(const capped of [-1,0,1,2])for(const portraitCap of [0,1,4])for(const si of [0,1]){
  const options={cost,capped,portraitCap,support:si},envelopes=[buildGlobalEnvelope(bank.records,meta,options),buildGlobalEnvelope(native,meta,options)]
  for(const B of [0,1,249,250,815,1000,6000,1000000000]){let best=-1,bestCost=Infinity;for(const c of literal)if(c.cost<=cost&&(capped<0||c.k===capped)&&c.p<=portraitCap&&c.si===si){const v=c.terms.reduce((s,[f,t])=>s+Math.floor(Math.floor(B*f/1000)*t/1000)+c.flat,0);if(v>best||v===best&&c.cost<bestCost){best=v;bestCost=c.cost}}
   for(let j=0;j<2;j++){const id=globalWinnerAt(envelopes[j],B),recs=j?native:bank.records;assert.equal(id===null?-1:globalCurveValue(recs[id],meta,B),best,JSON.stringify({frontMask,options,B,j}));if(id!==null)assert.equal(recs[id][7],bestCost)}checks++
  }
 }
 for(const c of exp.iterate()){const positions=globalMemberPositions(c),sup=exp.meta.supports[c[1]];assert.ok(positions.every(i=>sup.freePositions.includes(i)));assert.equal(positions.length,c[3]);let mask=sup.satisfiedMask;for(const i of positions)if(i<3)mask|=exp.meta.rows[c[14+i]].ruleRole;assert.equal(mask&frontMask,frontMask);checks++}
}
console.log(JSON.stringify({specialQuestLiteralChecks:checks,passed:true}))
