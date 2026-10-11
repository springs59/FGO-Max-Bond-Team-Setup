import fs from 'node:fs'
import {slimBondCes} from '../../src/game-data.js'
import {ceMilliLive} from '../../src/solver/solver-index.js'
import {pickCeSkill} from '../../src/atlas.js'
import {restrictGlobalQuestSource} from '../../src/solver/global-quest-rules.js'
import {projectGlobalDomain} from '../../src/solver/global-curve-expand.js'
import {compileSpecialGlobalRules,restrictSpecialGlobalRows,specialGuestPlacements,globalTraitMatch} from '../../src/solver/global-special-quest.js'
const dir=process.argv[2],rawdir=process.argv[3],scenes=JSON.parse(fs.readFileSync(dir+'/scenes.json')).filter(s=>!s.tag.includes('-special-')),coverage=JSON.parse(fs.readFileSync(dir+'/quest-coverage.json')),changes=[]
for(const region of ['CN','JP']){
 const data=region==='JP'?JSON.parse(fs.readFileSync('src/data/jp/bundle.json')):{servants:JSON.parse(fs.readFileSync('src/data/servants.json')),quests:JSON.parse(fs.readFileSync('src/data/quests.json'))}
 const base=JSON.parse(fs.readFileSync(dir+'/'+region+'-source.json')),families=new Map();const reviewedIds=new Set(JSON.parse(fs.readFileSync(dir+'/'+region+'-grand-saber-source.json')).groups.flatMap(g=>g.items.map(x=>x.id)));for(const g of [...base.groups,...base.supports])for(const item of g.items){if(!reviewedIds.has(item.id))throw Error('Unreviewed reward CE');item.rewardEligible=true}
 for(const entry of coverage.quests.filter(q=>q.region===region&&(!q.rules.supported||q.specialRules))){
  const q=data.quests.find(q=>q.id===entry.id&&(q.phase||1)===entry.phase),prefix=`${rawdir}/${region}-${entry.id}-${entry.phase}`,nice=JSON.parse(fs.readFileSync(prefix+'-nice.json')),raw=JSON.parse(fs.readFileSync(prefix+'-raw.json')),rules=compileSpecialGlobalRules(q,nice,raw)
  entry.specialRules=rules
  if(!rules.supported){entry.rules.unsupported=rules.unsupported;continue}
  const activeBase={...base,guestPartyMax:0,rows:base.rows.map(r=>({...r,self:Math.round((entry.bonuses[r.id]?.totalSecondLayer||0)*1000),party:Math.round((entry.bonuses[r.id]?.party||0)*1000),activity:entry.bonuses[r.id]||null}))},source=restrictSpecialGlobalRows(activeBase,rules,data.servants),supports=[],zero=()=>source.rows.map(()=>0)
  if(rules.grand)source.supports=restrictGlobalQuestSource(source,{grand:true}).supports
  for(const external of specialGuestPlacements(q,nice,rules)){
   const fixed=external.filter(x=>!x.friend),friend=external.find(x=>x.friend),parts=fixed.flatMap(s=>(s.equips||[]).map(eq=>{const ce=slimBondCes([eq.equip])[0]||{id:eq.equip?.id,name:eq.equip?.name||'空装',skills:[]},fn=pickCeSkill(ce,Number(eq.limitCount)>=4)?.funcs?.[0],rates=source.rows.map(r=>ceMilliLive(ce,{traitIds:r.traits},true,Number(eq.limitCount)>=4));return {rates,flat:fn?.add||0,kind:fn?.add?'portrait':new Set(rates).size>1?'conditional':'universal',items:[{id:ce.id,name:ce.name,cost:0,nominalRate:(fn?.followerRate??fn?.rate??0)/10}],slot:`客将 ${s.name} 固定礼装`,owner:s.svtId,ownerPosition:s.position}}))
   const freePositions=Array.from({length:6},(_,i)=>i).filter(i=>!external.some(s=>s.position===i+1)),frontShare=40*external.filter(s=>s.position<=3).length,satisfiedMask=rules.frontGroups.reduce((m,g,j)=>m|(!g.ownOnly&&fixed.some(s=>s.position<=3&&globalTraitMatch({id:s.svtId,traits:s.traits},g.values))?1<<j:0),0),bannedIds=[...new Set(source.rows.filter(r=>fixed.some(s=>globalTraitMatch(r,rules.unique)&&globalTraitMatch({id:s.svtId,traits:s.traits},rules.unique))).map(r=>r.id))]
   if(freePositions.length<rules.ownMin||external.length>rules.totalMax||rules.ownMax+external.length<rules.totalMin)continue
   const fixedRates=zero();for(const p of parts)p.rates.forEach((r,i)=>fixedRates[i]+=r)
   for(const f of friend?source.supports.filter(f=>!f.equipmentCount||f.equipmentCount<=1||rules.grandPositions.includes(friend.position)):[{rates:zero(),flat:0,items:[]}]){
    const ps=[...parts,...(friend?(f.parts||[f]).map(p=>({...p,slot:p.slot||'好友通常槽',owner:0,ownerPosition:friend.position})):[])],items=ps.flatMap(p=>p.items),layout=external.length?(frontShare?2:1):0
    supports.push({rates:fixedRates.map((r,i)=>r+f.rates[i]),flat:parts.reduce((s,p)=>s+p.flat,0)+f.flat,items,parts:ps,equipmentCount:ps.filter(p=>p.items.length).length,external:external.map(s=>({svtId:s.svtId,name:s.name,traits:s.traits,position:s.position,friend:!!s.friend,ceNames:(s.equips||[]).map(eq=>eq.equip?.name),script:s.script})),freePositions,frontShare,satisfiedMask,bannedIds,layout})
   }
  }
  if(!supports.length){entry.rules.unsupported=['实际 NPC 位置与人数限制没有可验证分支'];continue}
  if(rules.grandSlots>1)source.groups.sort((a,b)=>Number(new Set(b.rates).size>1)-Number(new Set(a.rates).size>1));
  source.supports=supports;source.rules={...rules,phaseScript:undefined,generic:true,layouts:[0,1,2]};entry.rules={...source.rules,supported:true,unsupported:[]}
  const key=JSON.stringify([source.rules,source.rows.map(r=>[r.id,r.form,r.self,r.party]),supports]);if(!families.has(key))families.set(key,{source,entries:[]});families.get(key).entries.push(entry)
 }
 let n=0
 for(const {source,entries}of families.values()){
  const tag=region+'-special-'+n++,info={tag,label:`${region==='CN'?'国服':'日服'} · 特殊 · ${entries[0].name}`,category:entries[0].activity?'event':'regular',quests:entries.map(q=>({id:q.id,phase:q.phase,name:q.name,bond:q.bond})),template:false,bonuses:entries[0].bonuses,note:'按关卡阶段脚本限制己方形态、客将位置、固定礼装、前排对象及人数。'},meta=projectGlobalDomain(source)
  source.scenario=info;meta.scenario=info
  const physical=s=>JSON.stringify([[s.freePositions.filter(i=>i<3).length,s.freePositions.filter(i=>i>=3).length],s.frontShare,s.satisfiedMask,s.bannedIds,s.external.length,s.layout]),frontier=meta.supports.map((_,i)=>i).filter(i=>!meta.supports.some((t,j)=>j!==i&&physical(t)===physical(meta.supports[i])&&t.flat>=meta.supports[i].flat&&t.rates.every((v,k)=>v>=meta.supports[i].rates[k])&&(t.flat>meta.supports[i].flat||t.rates.some((v,k)=>v>meta.supports[i].rates[k])||j<i)))
  meta.precomputedSupports=frontier;source.precomputedSupports=frontier
  fs.writeFileSync(`${dir}/${tag}-source.json`,JSON.stringify(source));fs.writeFileSync(`${dir}/${tag}-meta.json`,JSON.stringify(meta))
  const r=meta.rules,lines=[`${meta.rows.length} ${meta.groups.length} ${frontier.length} 168 0 ${r.grandSlots||0} 7 ${r.ownMin} ${r.ownMax} ${r.totalMin} ${r.totalMax} ${r.frontMask} 1 ${r.frontMin} ${r.grandPositions.length?r.grandPositions.reduce((m,i)=>m|(1<<(i-1)),0):63}`,...meta.rows.map(r=>[r.id,r.cost,r.self,r.party,r.ruleRole||0].join(' ')),...meta.groups.map(g=>[g.flat,g.items.length,...g.items.map(x=>x.cost),...g.rates].join(' ')),...frontier.map(i=>{const s=meta.supports[i];return [s.flat,...s.rates,s.layout,s.freePositions.reduce((m,i)=>m|(1<<i),0),s.external.length,s.external.filter(x=>x.position<=3).length,s.satisfiedMask,s.bannedIds.length,...s.bannedIds].join(' ')})]
  fs.writeFileSync(`${dir}/${tag}.txt`,lines.join('\n'));scenes.push({...info,rules:source.rules,forms:source.forms,identities:source.identities,supportEffects:source.supports.length,groups:source.groups.length});changes.push({tag,quests:entries.length,supportEffects:source.supports.length,frontier:frontier.length})
 }
}
fs.writeFileSync(dir+'/scenes.json',JSON.stringify(scenes));fs.writeFileSync(dir+'/quest-coverage.json',JSON.stringify(coverage));console.log(changes)
