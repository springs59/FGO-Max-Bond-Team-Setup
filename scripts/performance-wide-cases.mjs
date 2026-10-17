import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {makeSearchCase,randomSource} from './ai-search-cases.mjs'
import {isPlayableServant} from '../src/game-data.js'
import {pickCeSkill} from '../src/atlas.js'
import {servantBondForms} from '../src/recommend.js'
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)))
const data={CN:{servants:read('src/data/servants.json'),ces:read('src/data/ces.json')},JP:read('src/data/jp/bundle.json')}
export const ordinary=c=>{const f=pickCeSkill(c,true)?.funcs||[];return f.length===1&&!f[0].eventId&&f[0].target==='ptFull'&&((!f[0].add&&f[0].rate>=0)||(f[0].add===50&&!f[0].rate&&!f[0].tvals?.length&&!f[0].andTvals?.length))}
export function publicDomain(region,n,ceCount,copies=2){
 const d=data[region],rand=randomSource(6200000+n+(region==='JP'?1000:0))
 const servants=d.servants.filter(isPlayableServant).map(x=>({x,r:rand()})).sort((a,b)=>a.r-b.r).slice(0,n).map(x=>x.x)
 const pool=d.ces.filter(ordinary),ces=pool.slice(0,ceCount)
 return {servants,ownCes:ces.flatMap(c=>Array.from({length:copies},(_,i)=>({...c,accountMlb:i%2===0}))),supportCes:ces,
   base:815,costLimit:null,forms:Object.fromEntries(servants.map(s=>[s.id,servantBondForms(s)])),
   states:Object.fromEntries(servants.map((s,i)=>[s.id,{maxed:i%7===0,aura:i%14===0?250:0}])),
   bonuses:{},layouts:[6,3],minimumOwn:1,allSupportAlternatives:true}
}
const serial=o=>{const p={...o};if(p.formsOf){p.forms=Object.fromEntries(p.servants.map(s=>[s.id,p.formsOf(s)]));delete p.formsOf}
 if(p.stateOf){p.states=Object.fromEntries(p.servants.map(s=>[s.id,p.stateOf(s)]));delete p.stateOf}return p}
function meta(id,kind,cohort,region,opts){return {id,kind,cohort,region,opts,
 sha256:createHash('sha256').update(JSON.stringify(opts)).digest('hex'),
 domain:{identities:opts.servants.length,forms:Object.values(opts.forms||{}).reduce((s,x)=>s+x.length,0),
  ceCopies:(opts.ownCes||opts.account?.ces||opts.ces||[]).length,ceTypes:(opts.supportCes||opts.ces||[]).length,
  base:opts.base,costLimit:opts.costLimit,layouts:opts.layouts,allSupportAlternatives:opts.allSupportAlternatives,
  requiredIds:opts.requiredIds,requiredSeats:opts.requiredSeats,minimumOwn:opts.minimumOwn,emptyPositions:opts.emptyPositions,
  maxed:Object.values(opts.states||{}).filter(x=>x.maxed).length}}
}
export function wideCases(){
 const out=[];const add=(id,kind,cohort,region,opts)=>out.push(meta(id,kind,cohort,region,opts))
 // New seeds, never selected using observed runtime. Include both feasible and infeasible queries.
 for(let i=0;i<48;i++){
  const c=makeSearchCase(6300000+i,{real:i%2===0,larger:i>=24}),o=serial(c.opts)
  if(i%6===0)o.costLimit=null
  if(i%5===0)o.allSupportAlternatives=true
  if(i%8===0)o.layouts=[0]
  add('random-'+i,'core','random',i%2===0?'CN':'synthetic',o)
 }
 // Shared public input catalogs for all versions, including unlimited COST and all ordinary CEs.
 for(const region of ['CN','JP'])for(const n of [30,120,240,Infinity])for(let scenario=0;scenario<4;scenario++){
  const o=publicDomain(region,n,[4,8,12,Infinity][scenario],scenario===3?6:2)
  o.costLimit=[40,80,113,null][scenario];o.base=[1,815,2400,100000][scenario]
  if(scenario===2)o.bonuses=Object.fromEntries(o.servants.map((s,i)=>[s.id,{totalSecondLayer:[0,.5,1,2][i%4],party:i%9===0?.05:0}]))
  add(`public-${region}-${n}-${scenario}`,'core','public-grid',region,o)
 }
 for(let i=0;i<16;i++){
  const o=publicDomain('CN',[0,1,3,6,8,12,30,120][i%8],4)
  const tags=['empty-catalog','one-identity','all-maxed-zero','zero-base-flat','no-equipment','zero-cost','all-seats','required-back-empty']
  const tag=tags[i%8];o.costLimit=i<8?null:40
  if(i%8===2)for(const s of Object.values(o.states)){s.maxed=true;s.aura=250}
  if(i%8===3){o.base=0;const p=data.CN.ces.find(c=>ordinary(c)&&pickCeSkill(c,true).funcs[0].add===50);o.ownCes=Array.from({length:6},()=>({...p,accountMlb:true}));o.supportCes=[p]}
  if(i%8===4){o.ownCes=[];o.supportCes=[]}
  if(i%8===5)o.costLimit=0
  if(i%8===6)o.layouts=[0,1,2,3,4,5,6]
  if(i%8===7){const id=o.servants[0].id;o.requiredIds=[id];o.requiredSeats={[id]:'back'};o.fixedPositions={[id]:4};o.emptyPositions=[5];o.minimumOwn=2}
  add('boundary-'+i,'core',tag,'CN',o)
 }
 for(const region of ['CN','JP'])for(let scenario=0;scenario<4;scenario++){
  const o=publicDomain(region,Infinity,Infinity,6)
  const tag=['full-open','full-six-own','full-all-maxed','full-one-trait-filter'][scenario]
  o.costLimit=null;o.base=815
  if(scenario===1)o.layouts=[0]
  if(scenario===2)for(const s of Object.values(o.states)){s.maxed=true;s.aura=250}
  if(scenario===3){o.servants=o.servants.filter(s=>s.className==='saber');o.forms=Object.fromEntries(o.servants.map(s=>[s.id,o.forms[s.id]]))}
  add(`stress-${region}-${scenario}`,'core',tag,region,o)
 }
 for(const region of ['CN','JP'])for(const n of [30,120,240,Infinity])for(const open of [false,true]){
  const p=publicDomain(region,n,open?Infinity:6,open?6:2),d=data[region]
  const opts={servants:p.servants,ces:d.ces,region,base:815,mode:'account',costLimit:open?null:95,
   useInventoryCurveSolver:true,accountProfileId:'wide-'+region+n+open,
   account:{region,servants:p.servants.map((s,i)=>({id:s.id,bondLv:i%14===0?15:5,bondCap:i%14===0?15:10,limitCount:4})),
    ces:p.ownCes.map(c=>({id:c.id,mlb:c.accountMlb!==false,limitCount:c.accountMlb!==false?4:0}))}}
  add(`request-${region}-${n}-${open}`,'worker',open?'account-full-inventory-open':'account-six-ce',region,opts)
 }
 for(let i=0;i<12;i++){
  const p=publicDomain('CN',8,4,2),s=p.servants,opts={servants:s,ces:p.supportCes,base:815,mode:'free',costLimit:null,
   useInventoryCurveSolver:true,accountProfileId:'wide-special-'+i}
  const tag=['no-support','six-own-empty','six-total','support-front','prefer-one','prefer-three','lock-front-back','grand','teapot','event-self-party','fixed-npc','complex-ce'][i]
  if(i===0)opts.allowSupport=false
  if(i===1){opts.quest={restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[6]}]};opts.slotPins=[{position:5,empty:true}]}
  if(i===2)opts.quest={restrictions:[{type:'svtNum',rangeType:'equal',targetVals:[6]}]}
  if(i===3)opts.quest={restrictions:[{type:'fixedSupportPosition',rangeType:'equal',targetVals:[2]}]}
  if(i===4||i===5){opts.optimizeBy='prefer';opts.preferSvtIds=s.slice(0,i===4?1:3).map(x=>x.id)}
  if(i===6){opts.slotPins=[{position:1,svtId:s[0].id},{position:4,svtId:s[1].id}];opts.lockSvtIds=[s[0].id,s[1].id]}
  if(i===7){opts.questType='grand';opts.questClass='saber';opts.servants=data.CN.servants.filter(isPlayableServant).filter(s=>s.className==='saber').slice(0,8);opts.grandPosition=1}
  if(i===8)opts.teapot=true
  if(i===9){opts.quest={id:1,eventId:1};opts.bondBonuses={events:[],questFriendships:[],extraPassives:s.map((x,j)=>({servantId:x.id,skillId:j+1,eventId:1,target:j%3?'self':'ptFull',rate:[.05,.5,1,2][j%4],startedAt:1,endedAt:2145888000}))}}
  if(i===10)opts.quest={flags:['supportOnlyForceBattle'],supportServants:[{id:s[0].id,svtId:s[0].id,name:'Fixed NPC',traitIds:s[0].traitIds,required:true,followerFlags:['fixedNpc'],equips:[{ce:p.supportCes[0],ceMlb:true}]}]}
  if(i===11){const c=structuredClone(p.supportCes[0]);c.id=999999;for(const skill of c.skills||[])if(skill.funcs?.length)skill.funcs.push({...skill.funcs[0],rate:50});opts.ces=[c,...p.supportCes.slice(1)]}
  add('special-'+i,'worker',tag,'CN',opts)
 }
 return out
}
