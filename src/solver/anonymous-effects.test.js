import assert from 'node:assert/strict'
import {anonymousConfigurations,anonymousDistributions,anonymousEnvelopeBank,packAnonymousBank,unpackAnonymousBank,anonymousDistributionCount,effectValue} from './anonymous-effects.js'
import {buildGlobalEnvelope,globalWinnerAt,globalCurveValue} from './global-envelope.js'
import {mergeGlobalIntervals} from './global-curve-description.js'
const item=(id,cost,nominalRate)=>({id,cost,nominalRate,name:'CE'+id}),meta={groups:[{kind:'conditional',rates:[200,0],flat:0,items:[item(1,12,20),item(2,12,20)]},{kind:'universal',rates:[100,100],flat:0,items:[item(3,12,10)]},{kind:'portrait',rates:[0,0],flat:50,items:[item(4,5,0)]}],supports:[{kind:'conditional',rates:[200,0],flat:0,items:[item(5,0,20)],layout:1,freePositions:[0,3],frontShare:0,external:[{position:6}],parts:null}],rules:{generic:true,ownMin:2,ownMax:2,totalMin:3,totalMax:3,frontMin:1,grand:false}}
let checks=0
const six={n:5,k:0,nf:3,nb:2,flat:0,base:1000,support:{frontShare:0},dimensions:[{key:'own-c200',rate:200,count:5,source:'己方'},{key:'support-c200',rate:200,count:1,source:'助战'}]}
const all=[...anonymousDistributions(six)];assert.equal(all.length,anonymousDistributionCount(six));assert.equal(all.length,28392) // 12 joint hit vectors, multisets C(14,3)*C(13,2)
for(const hits of [[6,6,6,6,6],[6,6,6,6,5],[6,6,6,6,4]])assert.ok(all.some(c=>c.terms.map(t=>t.hits.reduce((s,n)=>s+n,0)).sort((a,b)=>b-a).join(',')===hits.join(',')))
// Retain who is hit by each percentage type, even when total percentages tie.
assert.ok(all.some(c=>c.terms.some(t=>t.hits[0]===5&&t.hits[1]===0)))
for(const c of anonymousConfigurations(meta,{cost:24,capped:-1,portraitCap:1})){
 assert.ok(c.normal<=c.n);assert.equal(c.free,0);const count=[...anonymousDistributions(c)].length;assert.equal(count,anonymousDistributionCount(c));checks++
}
const actual=[{cost:12,rate:200,restricted:true},{cost:12,rate:200,restricted:true},{cost:12,rate:100},{cost:5,flat:50}],literal=[]
for(let mask=0;mask<16;mask++){const items=actual.filter((_,i)=>mask&(1<<i));if(items.length>2)continue;const cost=items.reduce((s,x)=>s+x.cost,0),p=items.filter(x=>x.flat).length,restricted=items.filter(x=>x.restricted)
 function hits(i,columns){if(i<restricted.length){for(let h=0;h<4;h++)hits(i+1,[...columns,h]);return}for(let helper=0;helper<4;helper++)for(let capped=0;capped<3;capped++){const k=capped?1:0,terms=[0,1].flatMap(r=>capped&(1<<r)?[]:[{first:r===0?1200:1000,second:1000+250*k+(helper&(1<<r)?200:0)+items.filter(x=>!x.restricted).reduce((s,x)=>s+(x.rate||0),0)+columns.reduce((s,h)=>s+(h&(1<<r)?200:0),0)}]);literal.push({cost,p,k,flat:50*p,terms});checks++}}hits(0,[])
}
for(const cost of [0,5,12,17,24])for(const portraitCap of [0,1])for(const capped of [-1,0,1]){const opts={cost,portraitCap,capped},bank=anonymousEnvelopeBank(meta,opts),env=buildGlobalEnvelope(bank.records,bank.meta,opts);for(const B of [0,1,49,50,249,250,251,1000,6000,1000000000]){let best=-1,minCost=Infinity;for(const c of literal)if(c.cost<=cost&&c.p<=portraitCap&&(capped<0||c.k===capped)){const v=effectValue(c,B);if(v>best||v===best&&c.cost<minCost){best=v;minCost=c.cost}}const packed=packAnonymousBank(anonymousEnvelopeBank(meta,{cost:168,portraitCap:10,capped:-1})),cached=unpackAnonymousBank(packed,opts),cachedEnv=buildGlobalEnvelope(cached.records,cached.meta,opts),cachedId=globalWinnerAt(cachedEnv,B);assert.equal(cachedId===null?-1:globalCurveValue(cached.records[cachedId],cached.meta,B),best);const id=globalWinnerAt(env,B);assert.equal(id===null?-1:globalCurveValue(bank.records[id],bank.meta,B),best,JSON.stringify({opts,B}));if(id!==null)assert.equal(bank.records[id][7],minCost);checks++}}
// A capped rear member can own the only eligible reward slot. Greedily putting
// every capped member in front would omit this valid effect configuration.
const rearGrand={...meta,rules:{...meta.rules,grand:true,grandSlots:1,grandPositions:[4]}}
const rearConfigs=[...anonymousConfigurations(rearGrand,{cost:24,capped:1,portraitCap:1})]
assert.ok(rearConfigs.some(c=>c.nf===1&&c.capFront===0&&c.free===1));checks++
assert.ok(rearConfigs.every(c=>c.free===0||c.n-c.nf-c.capFront>=1));checks++
// Same effects from different names must also merge when group order differs.
const mergeMeta={rows:[{id:1,name:'A',cost:0,self:0,party:0},{id:2,name:'B',cost:0,self:0,party:0}],groups:[{kind:'conditional',rates:[200,0],flat:0,items:[item(1,0,20)]},{kind:'universal',rates:[100,100],flat:0,items:[item(2,0,10)]},{kind:'conditional',rates:[0,200],flat:0,items:[item(3,0,20)]}],supports:[{rates:[0,0],flat:0,items:[]}],rules:{grand:true}}
const ca=[0,0,0,1,1,0,0,0,1300,0,0,0,0,0,0,0,0,0,0,0,1,1,0,{rewardGroup:1}],cb=[...ca];cb[14]=1;cb[20]=0;cb[22]=1
const merged=mergeGlobalIntervals([{lo:0,hi:3,id:0},{lo:2,hi:5,id:1},{lo:8,hi:9,id:1}],[ca,cb],mergeMeta)
assert.equal(merged.length,1);assert.deepEqual(merged[0].ranges,[[0,5],[8,9]]);checks++
console.log(JSON.stringify({anonymousLiteralChecks:checks,sixConditionalProfiles:all.length,requiredExamples:true,rearRewardCarrier:true,passed:true}))
