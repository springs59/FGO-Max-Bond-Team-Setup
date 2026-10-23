import assert from 'node:assert/strict'
import {writeFileSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {createScoreTeamSearch,servantBondForms,formUnlocked} from '../src/recommend.js'
import {expandScoreTeamFamily} from '../src/solver/score-team-equivalence.js'
import {calcParty} from '../src/bond.js'
import {applyCraftEssences} from '../src/atlas.js'
import {resolveSlotEventPassives} from '../src/bond/bonus.js'
import {servantCost} from '../src/servant-cost.js'

const count=Number(process.env.FGO_SCORE_RANDOM_CASES||1000),output=process.env.FGO_SCORE_RANDOM_OUTPUT||'test-output/all-score-wide/random.json'
let seed=2026102201
const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n}
const key=slots=>JSON.stringify(slots.map(s=>[s.p,s.f,s.s,s.svt,s.art||'default',s.ce,s.ce?s.mlb!==false:true]))
const blank=p=>({p,f:0,s:0,svt:0,art:'',ce:0,mlb:true})
const ce=(id)=>({id,name:'Synthetic CE '+id,cost:rand(4),skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target:rand(3)?'ptFull':'self',rate:[0,10,50,100,200,500][rand(6)],followerRate:rand(5)*100,add:rand(5)===0?50:0,tvals:rand(3)===0?[{id:10+rand(2)}]:[],andTvals:[]}]}))})
// Independent, literal physical-slot enumeration: no production search,
// frontier, score bound, candidate ranking or representative compression.
function oracle(o){
 const slots=[1,2,3,4,5,6].map(blank),positions=[1,2,4],used=new Set(),answers=new Set(),copies=[]
 const rows=o.servants.flatMap(s=>servantBondForms(s).filter(f=>formUnlocked(f,o.account?.servants.find(r=>r.id===s.id),o.mode)).map(f=>({s,f})))
 for(const c of o.ces){const r=o.account?.ces.find(r=>r.id===c.id);for(let i=0;i<(o.mode==='account'?r.count:1);i++)copies.push({c,mlb:o.mode!=='account'||i<r.mlbCount})}
 if(o.allowSupport)slots[5]={...blank(6),f:1,s:1}
 let best=-Infinity,visited=0
 const required=new Set([...(o.preferSvtIds||[]),...(o.lockSvtIds||[])])
 function settle(){
  if(!slots.slice(0,3).some(s=>s.f)||!used.size||[...required].some(id=>!used.has(id)))return
  for(const pin of o.slotPins){const s=slots[pin.position-1];if(pin.svtId&&s.svt!==pin.svtId||pin.empty&&s.f||pin.ceId&&s.ce!==pin.ceId)return}
  const raw=slots.filter(s=>s.f).map(s=>{const r=rows.find(r=>r.s.id===s.svt&&r.f.key===(s.art||'default')),a=o.account?.servants.find(r=>r.id===s.svt);return {position:s.p,filled:true,isSupport:!!s.s,svtId:s.svt,svtArtKey:s.art,traitIds:r?.f.traitIds||[],ceId:s.ce,ceMlb:s.mlb,bond15:a?.bondLv===15,bondMaxed:!!a&&a.bondLv>=a.bondCap}})
  const cost=slots.filter(s=>s.f&&!s.s).reduce((n,s)=>{const r=rows.find(r=>r.s.id===s.svt&&r.f.key===(s.art||'default'));return n+servantCost(r.s,r.f)+(o.ces.find(c=>c.id===s.ce)?.cost||0)},0)
  if(o.costLimit!=null&&cost>o.costLimit)return
  applyCraftEssences(raw,o.ces);resolveSlotEventPassives(raw,{catalog:o.bondBonuses,quest:o.quest})
  const result=calcParty(o.base,o.teapot,raw,{bond15Aura:o.bond15Aura});assert.equal(result.ok,true)
  const score=result.results.reduce((n,r)=>n+(o.optimizeBy!=='prefer'||required.has(raw.find(s=>s.position===r.position)?.svtId)?r.final:0),0)
  visited++;if(score>best){best=score;answers.clear()}if(score===best)answers.add(key(slots))
 }
 const consumed=new Set()
 function equip(j){
  if(j===positions.length){for(const c of o.allowSupport?(o.lockSupportCeId?o.ces.filter(c=>c.id===o.lockSupportCeId):[null,...o.ces]):[null]){slots[5].ce=c?.id||0;settle()}return}
  const s=slots[positions[j]-1];s.ce=0;s.mlb=true;equip(j+1)
  if(s.f)for(let i=0;i<copies.length;i++)if(!consumed.has(i)){const x=copies[i];consumed.add(i);s.ce=x.c.id;s.mlb=x.mlb;equip(j+1);consumed.delete(i)}
  s.ce=0;s.mlb=true
 }
 function members(j){if(j===positions.length){equip(0);return}const s=slots[positions[j]-1],pin=o.slotPins.find(p=>p.position===s.p)
  if(!pin?.empty)for(const r of rows)if(!used.has(r.s.id)&&(!pin?.svtId||pin.svtId===r.s.id)){used.add(r.s.id);Object.assign(s,{f:1,svt:r.s.id,art:r.f.key==='default'?'':r.f.key});members(j+1);used.delete(r.s.id)}
  Object.assign(s,blank(s.p));if(!pin?.svtId&&!pin?.ceId)members(j+1)
 }
 members(0);return {best,answers,visited}
}
const began=performance.now(),records=[]
for(let index=0;index<count;index++){
 const caseSeed=seed,n=1+rand(3),servants=Array.from({length:n},(_,i)=>({id:i+1,collectionNo:i+1,name:'Synthetic '+i,className:'saber',rarity:3,cost:rand(5),traitIds:[10+rand(2)],forms:rand(2)?[{key:'c1',cost:rand(5),traitIds:[10+rand(2)]}]:[]})),ces=Array.from({length:rand(3)},(_,i)=>ce(101+i)),accountMode=rand(2)===0,support=rand(2)===0
 const account=accountMode?{region:'CN',servants:servants.map((s,i)=>({id:s.id,bondLv:i&&rand(4)===0?15:5,bondCap:i?15:10,limitCount:4,unlockedCostumes:rand(2)?[1]:[],maxAscension:[0,1,3,4][rand(4)]})),ces:ces.map(c=>{const count=1+rand(2);return {id:c.id,count,mlbCount:rand(count+1)}})}:null
 const opts={servants,ces,account,mode:accountMode?'account':'free',base:[0,1,9,815,2400][rand(5)],teapot:rand(2)===0,bond15Aura:rand(4)!==0,costLimit:rand(5)===0?null:rand(15),allowSupport:support,
  quest:support?{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]}:null,slotPins:[{position:3,empty:true},{position:5,empty:true},...(!support?[{position:6,empty:true}]:[])],aiMode:index%2?'on':'off',skipResultCache:true}
 if(rand(5)===0){opts.optimizeBy='prefer';opts.preferSvtIds=[1]}
 if(rand(5)===0)opts.lockSvtIds=[n]
 if(rand(7)===0)opts.slotPins.push({position:4,svtId:1})
 if(support&&ces.length&&rand(5)===0)opts.lockSupportCeId=ces[0].id
 if(index%6===0)opts.bondBonuses={events:[],questFriendships:[{eventId:0,allQuests:true,targetIds:[1],rate:0.2,startedAt:1,endedAt:4102444800}],extraPassives:[]}
 const expected=oracle(opts),q=createScoreTeamSearch(opts),actual=new Set();let best=-Infinity
 if(q.ok)for(const e of q.iterator)if(e.type==='team'){const r=e.record;const plan=q.hydrate(r);assert.equal(opts.optimizeBy==='prefer'?plan.preferBond:plan.total,r.score,`settlement ${index}`);if(r.score>best){best=r.score;actual.clear()}if(r.score===best)for(const physical of expandScoreTeamFamily(r,q.equivalenceCatalogs[r.domain])){q.hydrate(physical);const k=key(physical.packed.slots);assert.ok(!actual.has(k),`duplicate expanded team ${index}`);actual.add(k)}}
 assert.equal(best,expected.best,`random ${index}, seed ${caseSeed}: maximum`)
 assert.deepEqual([...actual].sort(),[...expected.answers].sort(),`random ${index}, seed ${caseSeed}: ALL tied physical teams`)
 if(q.ok){assert.equal(q.state.complete,true);assert.equal(q.state.recoveries,0,`random ${index}: a valid objective proof must not need recovery`)}
 records.push({index,seed:caseSeed,mode:opts.mode,primary:opts.optimizeBy||'total',base:opts.base,support,activity:!!opts.bondBonuses,best:Number.isFinite(best)?best:null,tiedTeams:actual.size,oracleLeaves:expected.visited,fingerprint:createHash('sha256').update([...actual].sort().join('\n')).digest('hex')})
}
const report={passed:true,seed:2026102201,cases:count,ms:performance.now()-began,tiedTeams:records.reduce((n,r)=>n+r.tiedTeams,0),oracleLeaves:records.reduce((n,r)=>n+r.oracleLeaves,0),records}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,records:undefined,output}))

