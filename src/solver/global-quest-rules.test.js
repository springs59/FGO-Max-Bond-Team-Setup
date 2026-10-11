import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {compileGlobalQuestRules,restrictGlobalQuestSource,globalClassMatches} from './global-quest-rules.js'
import {createGlobalExpansion,solveProjectedGlobal} from './global-curve-expand.js'
import {describeGlobalCurve,mergeGlobalIntervals} from './global-curve-description.js'
import {buildGlobalEnvelope,globalWinnerAt,globalCurveValue} from './global-envelope.js'
const restriction=(type,rangeType,n)=>({restriction:{type,rangeType,targetVals:[n]}})
const six=compileGlobalQuestRules({restrictions:[restriction('mySvtNum','equal',6)]})
assert.deepEqual(six.layouts,[0]);assert.equal(six.ownMin,1)
assert.equal(compileGlobalQuestRules({restrictions:[restriction('svtNum','below',4)]}).totalMax,4)
assert.equal(compileGlobalQuestRules({restrictions:[restriction('svtNum','equal',6)]}).totalMin,6)
assert.equal(compileGlobalQuestRules({restrictions:[restriction('fixedSupportPosition','equal',2)]}).supportPosition,2)
assert.equal(compileGlobalQuestRules({restrictions:[restriction('individuality','notEqual',1)]}).supported,false)
assert.equal(compileGlobalQuestRules({flags:['supportOnlyForceBattle']}).supported,false)
assert.ok(globalClassMatches('shielder','extra1'));assert.ok(!globalClassMatches('foreigner','extra1'));assert.ok(globalClassMatches('beast','extra2'))
const rows=[{id:1,cost:0,self:0,party:0,className:'saber'},{id:2,cost:3,self:200,party:50,className:'saber'},{id:2,cost:4,self:500,party:50,className:'saber'},{id:3,cost:4,self:0,party:0,className:'saber'},{id:4,cost:7,self:1000,party:0,className:'assassin'}].map((r,i)=>({...r,form:String(i),name:'S'+r.id}))
const item=(id,cost,name)=>({id,cost,name,rewardEligible:true})
const groups=[{flat:0,kind:'universal',rates:[100,100,100,100,100],items:[item(1,2,'全体')]},{flat:50,kind:'portrait',rates:[0,0,0,0,0],items:[item(2,1,'肖像A'),item(3,1,'肖像B')]},{flat:0,kind:'conditional',rates:[0,200,0,200,200],items:[item(4,3,'限定20%')]}]
const source={rows,groups,supports:[{rates:rows.map(()=>0),flat:0,items:[]},...groups.map(g=>({...g,rates:g.rates.map(x=>g.kind==='universal'?150:x)}))],guestPartyMax:0}
let checks=0
const nativeDir=fs.mkdtempSync(path.join(os.tmpdir(),'quest-curves-test-')),native=path.join(nativeDir,'engine')
execFileSync('g++',['-O2','-std=c++17','scripts/quest-global-curves/global.cpp','-o',native])
for(const rules of [{layouts:[1],ownMin:1,ownMax:6,totalMin:1,totalMax:4,requireFront:true},{...six,requireFront:true},{grand:true,questClass:'saber',layouts:[0,1,2],requireFront:true}]){
 const full=restrictGlobalQuestSource(source,rules),opts={cost:18,portraitCap:7,capped:-1},exp=createGlobalExpansion(full,opts),records=[...exp.iterate()],bank=solveProjectedGlobal(full,opts),meta=bank.meta
 for(const c of records){const d=describeGlobalCurve(c,exp.meta),price=d.members.reduce((s,m)=>s+m.row.cost,0)+d.equipment.reduce((s,g)=>s+g.items.reduce((s,x)=>s+(x.id===d.reward?.id?0:x.cost),0),0);assert.equal(price,c[7]);assert.ok(d.ownNormal<=d.ownCount);assert.ok(d.ownEquipped<=d.ownCount+(rules.grand?1:0));assert.ok(!d.reward||d.grand);assert.ok(d.support?.equipped<=(rules.grand?2:1)||!d.support);assert.ok(d.members.some(m=>m.position<=3)||c[0]===2);if(rules.questClass)assert.ok(d.members.every(m=>m.row.className==='saber'));checks++}
 const literal=[],flatItems=full.groups.flatMap((g,j)=>g.items.map(x=>({...x,g:j})))
 function teams(id,team){if(id===5){if(team.length&&team.some(x=>!x.cap))emit(team);return}teams(id+1,team);for(let r=0;r<full.rows.length;r++)if(full.rows[r].id===id)for(const cap of [false,true])teams(id+1,[...team,{r,cap}])}
 function emit(team){const n=team.length,k=team.filter(x=>x.cap).length;for(const l of rules.layouts)for(let si=0;si<(l?full.supports.length:1);si++){
  if(n>(l?5:6)||n+(l?1:0)>(rules.totalMax||6)||n<(rules.ownMin||1)||n+(l?1:0)<(rules.totalMin||1))continue
  for(let ceMask=0;ceMask<2**flatItems.length;ceMask++){const equipped=flatItems.filter((x,i)=>ceMask&(1<<i));for(const reward of [-1,...(rules.grand?equipped.map(x=>x.id):[])]){if(equipped.length-(reward>=0?1:0)>n)continue;const cost=team.reduce((s,x)=>s+full.rows[x.r].cost,0)+equipped.reduce((s,x)=>s+(x.id===reward?0:x.cost),0);if(cost>18)continue
   for(let mask=0;mask<2**n;mask++){let nf=0;for(let i=0;i<n;i++)if(mask&(1<<i))nf++;if(nf>(l===2?2:3)||n-nf>(l===1?2:3)||(!nf&&l!==2))continue
    const flat=equipped.reduce((s,x)=>s+full.groups[x.g].flat,0)+full.supports[si].flat,terms=team.filter(x=>!x.cap).map(x=>{const at=team.indexOf(x);return [(mask&(1<<at))?(l===2?1240:1200):(l===2?1040:1000),1000+full.rows[x.r].self+team.reduce((s,z)=>s+full.rows[z.r].party,0)+250*k+full.supports[si].rates[x.r]+equipped.reduce((s,z)=>s+full.groups[z.g].rates[x.r],0)]});literal.push({l,si,cost,k,p:equipped.filter(x=>full.groups[x.g].flat).length,flat,terms})
   }
  }}
 }}
 teams(1,[])
 const lines=[`${meta.rows.length} ${meta.groups.length} ${meta.supports.length} 18 0 ${rules.grand?1:0} ${rules.layouts.reduce((s,l)=>s|(1<<l),0)} ${rules.ownMin||1} ${rules.ownMax||6} ${rules.totalMin||1} ${rules.totalMax||6}`,...meta.rows.map(r=>[r.id,r.cost,r.self,r.party].join(' ')),...meta.groups.map(g=>[g.flat,g.items.length,...g.items.map(x=>x.cost),...g.rates].join(' ')),...meta.supports.map(s=>[s.flat,...s.rates].join(' '))],input=path.join(nativeDir,'input'),output=path.join(nativeDir,'output');fs.writeFileSync(input,lines.join('\n'));execFileSync(native,[input,output],{stdio:'ignore'});const nativeRecords=fs.readFileSync(output,'utf8').trim().split('\n').map(s=>{const c=s.split(' ').map(Number),rewardGroup=c.pop();if(rewardGroup>=0)c.push({rewardGroup});return c})
 for(const cost of [0,4,8,18])for(const capped of [-1,0,1,2])for(const layout of rules.layouts)for(const portraitCap of [0,1,2,7]){
  const opt={cost,capped,layout,portraitCap},env=buildGlobalEnvelope(bank.records,meta,opt),ne=buildGlobalEnvelope(nativeRecords,meta,opt)
  for(const B of [0,1,9,249,250,499,1000,10000]){let best=-1,bestCost=Infinity;for(const c of literal)if(c.cost<=cost&&(capped<0||c.k===capped)&&c.l===layout&&c.p<=portraitCap){const v=c.terms.reduce((s,[f,t])=>s+Math.floor(Math.floor(B*f/1000)*t/1000)+c.flat,0);if(v>best||v===best&&c.cost<bestCost){best=v;bestCost=c.cost}}
   for(const[recs,e]of[[bank.records,env],[nativeRecords,ne]]){const id=globalWinnerAt(e,B);if(id===null)assert.equal(best,-1);else{assert.equal(globalCurveValue(recs[id],meta,B),best,JSON.stringify({rules,opt,B}));assert.equal(recs[id][7],bestCost)}}checks++
  }
 }
 if(rules.grand){assert.ok(records.some(c=>describeGlobalCurve(c,exp.meta).ownEquipped>c[3]));const c=records.find(c=>c.at(-1)?.rewardGroup>=0),other=c.slice();other[other.length-1]={rewardGroup:-1};assert.equal(mergeGlobalIntervals([{lo:0,hi:2,id:0},{lo:0,hi:2,id:1}],[c,other],exp.meta).length,2)}
}
console.log(JSON.stringify({questRulesLiteralAndNativeChecks:checks,passed:true}))
