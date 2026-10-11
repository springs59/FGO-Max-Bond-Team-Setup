import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {buildActivityScoreIndex} from '../../src/solver/activity-score-index.js'
import {grandQuestCatalog} from '../../src/game-data.js'
import {compileGlobalQuestRules,restrictGlobalQuestSource} from '../../src/solver/global-quest-rules.js'
import {projectGlobalDomain} from '../../src/solver/global-curve-expand.js'

const out=path.resolve(process.argv[2]),now=Date.parse('2026-10-10T04:37:41Z'),scenes=[],coverage=[]
fs.mkdirSync(out,{recursive:true})
const rewardIds=new Set([9308100,9308110,9308120,9308130,9308140,9308150,9308160,9400970,9400980,9400990,9401000,9401010,9401020,9401030,9401040,9401050,9401060,9401970,9403520,9403990,9404180,9404360,9405170,9406010,9406200,9406740,9407480,9407740,9407850,9408060,9408220,9408390,9408590,9408800,9408990,9409210,9409320,9409490,...Array.from({length:21},(_,i)=>9311310+i*10)])
function writeScene(source,rules,info) {
  const full=restrictGlobalQuestSource(source,rules),meta=projectGlobalDomain(full),tag=info.tag
  meta.vectors=new Set(meta.rows.map((r,i)=>JSON.stringify([meta.groups.map(g=>g.rates[i]),r.self,r.party]))).size
  Object.assign(full,{scenario:info});Object.assign(meta,{scenario:info})
  // A friend's cost is zero. A flat/rate-dominated friend cannot improve the
  // unconstrained global envelope. Keep every option in full source for the
  // all-results stream and solve again when one such option is explicitly pinned.
  const frontier=meta.supports.map((s,i)=>i).filter(i=>!meta.supports.some((t,j)=>j!==i&&t.flat>=meta.supports[i].flat&&t.rates.every((v,k)=>v>=meta.supports[i].rates[k])&&(t.flat>meta.supports[i].flat||t.rates.some((v,k)=>v>meta.supports[i].rates[k])||j<i)))
  meta.precomputedSupports=[0,...frontier.filter(i=>i!==0)]
  full.precomputedSupports=meta.precomputedSupports
  if(meta.groups.length>20)throw Error('Native group bound exceeded')
  fs.writeFileSync(out+'/'+tag+'-source.json',JSON.stringify(full));fs.writeFileSync(out+'/'+tag+'-meta.json',JSON.stringify(meta))
  const mask=rules.layouts.reduce((s,l)=>s|(1<<l),0),lines=[`${meta.rows.length} ${meta.groups.length} ${meta.precomputedSupports.length} 168 ${meta.guestPartyMax} ${rules.grand?1:0} ${mask} ${rules.ownMin||1} ${rules.ownMax||6} ${rules.totalMin||1} ${rules.totalMax||6}`]
  for(const r of meta.rows)lines.push(`${r.id} ${r.cost} ${r.self} ${r.party}`)
  for(const g of meta.groups)lines.push([g.flat,g.items.length,...g.items.map(x=>x.cost),...g.rates].join(' '))
  for(const i of meta.precomputedSupports){const s=meta.supports[i];lines.push([s.flat,...s.rates].join(' '))}
  fs.writeFileSync(out+'/'+tag+'.txt',lines.join('\n'))
  scenes.push({...info,rules,forms:full.rows.length,identities:full.identities,vectors:meta.vectors,supportEffects:meta.supports.length,groups:meta.groups.length})
}
for(const region of ['CN','JP']){
  execFileSync(process.execPath,['scripts/global-curves/export.mjs',region],{env:{...process.env,GLOBAL_CURVE_OUTPUT:out},stdio:'inherit'})
  const data=region==='JP'?JSON.parse(fs.readFileSync('src/data/jp/bundle.json')):{servants:JSON.parse(fs.readFileSync('src/data/servants.json')),quests:JSON.parse(fs.readFileSync('src/data/quests.json')),bondBonuses:JSON.parse(fs.readFileSync('src/data/bond-bonuses.json'))}
  const base=JSON.parse(fs.readFileSync(out+'/'+region+'-source.json'))
  for(const g of [...base.groups,...base.supports])for(const item of g.items){if(!rewardIds.has(item.id))throw Error('Unreviewed reward CE '+item.id);item.rewardEligible=true}
  const idx=buildActivityScoreIndex({...data,now}),families=new Map()
  for(const q of data.quests){
    if(q.questType==='grand'||q.type==='grand'||q.openedAt>now/1000||(q.closedAt&&q.closedAt<now/1000))continue
    const rules=compileGlobalQuestRules(q),bonuses=idx.byQuest[`${q.id}:${q.phase||1}`]||{},activity=Object.keys(bonuses).length>0
    const entry={region,id:q.id,phase:q.phase||1,name:q.display||q.name,bond:q.bond,eventId:q.eventId||0,openedAt:q.openedAt,closedAt:q.closedAt,rules,activity,bonuses}
    coverage.push(entry)
    if(!rules.supported)continue
    // Optional NPC choices are not interchangeable with a freely equipped
    // friend. This bank covers the explicitly labelled friend branch only.
    const key=JSON.stringify([rules,bonuses])
    if(!families.has(key))families.set(key,{rules,bonuses,quests:[],activity,eventId:q.eventId||0})
    families.get(key).quests.push({id:q.id,phase:q.phase||1,name:q.display||q.name,bond:q.bond,openedAt:q.openedAt,closedAt:q.closedAt})
  }
  let f=0
  for(const family of families.values()){
    const source={...base,guestPartyMax:Math.max(0,...Object.values(family.bonuses).filter(b=>b.partyApplySupport!==0).map(b=>Math.round(b.party*1000))),rows:base.rows.map(r=>({...r,self:Math.round((family.bonuses[r.id]?.totalSecondLayer||0)*1000),party:Math.round((family.bonuses[r.id]?.party||0)*1000),activity:family.bonuses[r.id]||null}))}
    const tag=region+'-quest-'+f++,scope=family.activity?'活动':'常规',count=family.rules.totalMax<6?` · 全队≤${family.rules.totalMax}人`:family.rules.totalMin===6?' · 全队六人':family.rules.layouts[0]===0?' · 自出最多六人':' · 助战'+(family.rules.layouts.length===2?'前／后排':family.rules.layouts[0]===2?'前排':'后排')
    writeScene(source,family.rules,{tag,label:`${region==='CN'?'国服':'日服'} · ${scope}${count}${family.rules.friendOnly?' · 好友分支':''}`,category:family.activity?'event':'regular',quests:family.quests,eventId:family.eventId,bonuses:family.bonuses,template:false,npcExcluded:family.rules.friendOnly})
  }
  writeScene(base,{layouts:[0],ownMin:1,ownMax:6,totalMin:1,totalMax:6,requireFront:true},{tag:region+'-self-six',label:`${region==='CN'?'国服':'日服'} · 常规自出六人容量模板`,category:'regular',quests:[],template:true,bonuses:{},note:'自出六人表示最多六个己方位置，允许少上、空位和少戴；不强制出满。'})
  for(const q of grandQuestCatalog())writeScene(base,{grand:true,questClass:q.questClass,layouts:[0,1,2],ownMin:1,ownMax:6,totalMin:1,totalMax:6,requireFront:true},{tag:region+'-grand-'+q.questClass,label:`${region==='CN'?'国服':'日服'} · 冠位 ${q.questClass} 规则模板`,category:'grand',quests:[{id:q.id,name:q.name,bond:q.bond}],template:true,bonuses:{},note:'冠位研钻规则模板；假定己方至少一名满足冠位选定条件，助战可为同职阶冠位。资料中的合成目录不证明本服务器已开放或账号已解锁。未锁定具体冠位身份／位置。'})
}
fs.writeFileSync(out+'/scenes.json',JSON.stringify(scenes));fs.writeFileSync(out+'/quest-coverage.json',JSON.stringify({now:new Date(now).toISOString(),quests:coverage}));console.log(scenes.map(s=>[s.tag,s.forms,s.vectors,s.groups,s.supportEffects,s.quests.length]))
