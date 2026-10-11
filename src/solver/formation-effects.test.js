import assert from 'node:assert/strict'
import {formationOptions,validateFormation,validateActivities,activityMixes,applyActivityEffects,formationConfigMatches,formationEffectKey} from './formation-effects.js'
import {effectValue,anonymousDistributions,anonymousEnvelopeBank,anonymousConfigurations} from './anonymous-effects.js'
import {buildGlobalEnvelope,globalWinnerAt,globalCurveValue} from './global-envelope.js'
const meta={rules:{layouts:[0,1,2],ownMin:1,ownMax:6,totalMin:1,totalMax:6},supports:[{items:[],rates:[0],flat:0},{items:[{id:1}],rates:[200],flat:0}]}
let checks=0
for(let n=0;n<=6;n++)for(let h=0;h<=3;h++)for(let f=0;f<=3;f++){let valid=true;try{validateFormation(meta,{own:n,helpers:h,helperFront:f,capped:0})}catch{valid=false}const expected=n>=1&&n+h<=6&&h<=1&&f<=h;assert.equal(valid,expected,`${n}/${h}/${f}`);checks++}
assert.throws(()=>validateFormation(meta,{own:6,helpers:1}),/6/)
assert.throws(()=>validateFormation(meta,{own:5,helpers:1,helperFront:2}),/前排助战/)
assert.throws(()=>validateFormation(meta,{own:5,helpers:0,capped:5}),/领取/)
const restricted={...meta,rules:{...meta.rules,totalMin:3,totalMax:3,layouts:[2]}}
assert.deepEqual([...new Set(formationOptions(restricted).map(x=>x.own))],[2])
assert.throws(()=>validateFormation({...meta,rules:{...meta.rules,frontMin:3}},{own:1,helpers:1,helperFront:0}),/特殊编队/)
const selfOnly={...meta,rules:{...meta.rules,layouts:[0]}}
assert.deepEqual([...new Set(formationOptions(selfOnly).map(x=>x.own))],[1,2,3,4,5,6])
const multi={rules:{generic:true,layouts:[2],ownMin:1,ownMax:6,totalMin:1,totalMax:6},supports:[{items:[],layout:2,external:[{position:1,friend:false},{position:6,friend:true}],freePositions:[1,2,3,4],frontShare:40}]}
assert.ok(formationOptions(multi).every(x=>x.helpers===2&&x.helperFront===1&&x.own<=4))
assert.throws(()=>validateFormation(multi,{own:5,helpers:2}),/6/)
const limited={...meta,rules:{...meta.rules,generic:true},rows:[{id:1,ruleRole:0}],supports:[{items:[],layout:0,external:[],freePositions:[0,1,2,3,4,5]}]}
assert.deepEqual([...new Set(formationOptions(limited).map(x=>x.own))],[1])
const qualified={...meta,rules:{...meta.rules,frontMask:3},rows:[{id:1,ruleRole:1},{id:2,ruleRole:2}]}
assert.throws(()=>validateFormation(qualified,{own:1,helpers:1,helperFront:0}),/特殊编队/);assert.ok(formationOptions(qualified,{own:2,helpers:1,helperFront:0}).length)
const sameIdentity={...qualified,rows:[{id:1,ruleRole:1},{id:1,ruleRole:2}]}
assert.equal(formationOptions(sameIdentity).length,0)
const p=(self,own,party=0,helpers=0,helperAllowed=true)=>({self,campaign:0,party,own,helpers,helperAllowed})
assert.throws(()=>validateActivities([p(0,0,50,1,false)]),/助战/)
assert.throws(()=>validateActivities([{...p(500,4),available:3}]),/现有数量/)
assert.throws(()=>validateActivities([p(1000,4),p(500,3)]),/容量/)
const c={n:3,k:1,nf:1,nb:1,capFront:1,normal:3,free:0,cost:0,ceCost:0,reserve:0,flat:50,support:{layout:1,external:1,frontShare:0},dimensions:[{source:'己方',rate:200,count:2}],types:[],counts:[],terms:[{first:1200,second:1400,hits:[2]},{first:1000,second:1200,hits:[1]}]}
const profiles=[p(1000,1),p(500,1),p(0,1,50)],values=[...applyActivityEffects(c,profiles)]
assert.equal(values.length,6);const seen=new Set(values.map(x=>x.terms.map(t=>t.activity).join(',')));assert.equal(seen.size,6)
for(const B of [0,1,7,49,249,1000,1001,1000000000]){
 const scores=values.map(x=>effectValue(x,B)).sort((a,b)=>a-b),literal=[]
 for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b){const second=[1400+profiles[a].self+50,1200+profiles[b].self+50];literal.push(Math.floor(Math.floor(B*1200/1000)*second[0]/1000)+Math.floor(B*second[1]/1000)+100)}
 assert.deepEqual(scores,literal.sort((a,b)=>a-b));checks++
}
const joint={...c,n:2,k:0,nf:2,nb:0,terms:[{first:1200,second:1400,hits:[2]},{first:1200,second:1000,hits:[0]}]}
assert.equal([...applyActivityEffects(joint,[p(1000,1),p(0,1)])].length,2)
const equal={...joint,terms:[{first:1200,second:1400,hits:[2]},{first:1200,second:1400,hits:[2]}]}
assert.equal([...applyActivityEffects(equal,[p(1000,1),p(0,1)])].length,1)
for(const mix of activityMixes([p(1000,-1),p(500,-1)],3,1)){assert.ok(mix.own.reduce((a,b)=>a+b,0)<=3);checks++}
const helper=[...applyActivityEffects(c,[p(0,0,50,1,true)])];assert.ok(helper.every(x=>x.activity.party===50));assert.equal([...applyActivityEffects(c,[p(0,0,50,1,false)])].length,0)
assert.ok(formationConfigMatches(c,{own:3,helpers:1,helperFront:0}));assert.ok(!formationConfigMatches(c,{own:4,helpers:1,helperFront:0}))
// Independently enumerate binary CE hits and all mutually exclusive activity
// placements, then compare each integer result with the compressed envelope.
const fixture={...c,n:2,k:0,nf:1,nb:1,flat:0,base:1000,dimensions:[{source:'己方',rate:200,count:1}]},candidates=[]
for(const d of anonymousDistributions(fixture))for(const x of applyActivityEffects(d,[p(500,1),p(0,1)]))candidates.push(x)
const records=candidates.map(x=>[1,0,0,2,1,0,0,0,x.terms[0].second,0,0,x.terms[1].second,0,0,...Array(6).fill(0)]),bankMeta={supports:[{flat:0,frontShare:0}]},env=buildGlobalEnvelope(records,bankMeta,{cost:0,portraitCap:0,capped:0})
for(let B=0;B<=1000;B++){let best=0;for(let hit=0;hit<4;hit++)for(let a=0;a<2;a++){const s0=1000+(hit&1?200:0)+(a===0?500:0),s1=1000+(hit&2?200:0)+(a===1?500:0);best=Math.max(best,Math.floor(Math.floor(B*1.2)*s0/1000)+Math.floor(B*s1/1000))}assert.equal(globalCurveValue(records[globalWinnerAt(env,B)],bankMeta,B),best);checks++}
const duplicateConfig={...equal,support:{...equal.support,types:[]}}
const split=[...applyActivityEffects(duplicateConfig,[p(500,1),p(500,1)])][0],combined=[...applyActivityEffects(duplicateConfig,[p(500,2)])][0]
assert.equal(formationEffectKey(split),formationEffectKey(combined));checks++
// Qualification filtering must happen BEFORE CE dominance. A capped front
// carrier can satisfy a second required role; a rear-only free slot cannot then
// be assumed to remain available after all own front seats are required.
const roleMeta={groups:[{kind:'conditional',flat:0,rates:[200],items:[{id:1,cost:12,nominalRate:20},{id:2,cost:12,nominalRate:20}]}],supports:[{kind:'universal',flat:0,rates:[0],items:[],layout:0,external:[],freePositions:[0,1,2,3,4,5],frontShare:0}],rules:{generic:true,ownMin:2,ownMax:2,totalMin:2,totalMax:2,frontMin:1,frontMask:3,grand:true,grandSlots:1,grandPositions:[4]},rows:[{id:1,ruleRole:1},{id:2,ruleRole:2}]}
const roleOptions={cost:24,capped:1,portraitCap:0,own:2,helpers:0,helperFront:0,roleLimits:formationOptions(roleMeta,{own:2,helpers:0,helperFront:0,capped:1}).map(x=>[x.index,x.layout,x.own,x.ownFrontMin])},accept=c=>formationConfigMatches(c,roleOptions),roleBank=anonymousEnvelopeBank(roleMeta,{...roleOptions,acceptConfiguration:accept}),roleEnv=buildGlobalEnvelope(roleBank.records,roleBank.meta,roleOptions),literalRole=[...anonymousConfigurations(roleMeta,roleOptions)].filter(accept)
assert.ok(roleBank.configs.some(c=>c.nf===1&&c.capFront===1&&c.free===0));assert.ok(roleBank.configs.every(c=>c.free===0))
for(let B=0;B<=200;B++){assert.equal(globalCurveValue(roleBank.records[globalWinnerAt(roleEnv,B)],roleBank.meta,B),Math.max(...literalRole.map(c=>effectValue(c,B))));checks++}
console.log(JSON.stringify({formationActivityChecks:checks,independentJointLiteral:true,mutuallyExclusiveProfiles:true,helpersAndSeats:true,passed:true}))
