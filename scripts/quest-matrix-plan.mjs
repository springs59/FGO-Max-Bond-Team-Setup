import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {emptyRosterFilter,ATTR_OPTIONS,TRAIT_OPTIONS,matchRosterForm} from '../src/filter.js'
import {servantBondForms} from '../src/recommend.js'
import {questPartyRules} from '../src/quest-party-rules.js'
import {getEffectiveBondBonus} from '../src/bond/bonus.js'
export const hash=s=>createHash('sha256').update(s).digest('hex')
export function bundle(region){
  const read=name=>JSON.parse(fs.readFileSync('src/data/'+name+'.json'))
  return region==='JP'?read('jp/bundle'):{region,servants:read('servants'),ces:read('ces'),quests:read('quests'),bondBonuses:read('bond-bonuses'),version:read('version')}
}
export function inputs(b,quest,filter){return {mode:'free',account:null,region:b.region,servants:b.servants,ces:b.ces,
  bondBonuses:b.bondBonuses,game:{version:b.version},quest,base:quest.bond,costLimit:95,filter,teapot:false,
  allowSupport:!questPartyRules(quest).noSupport,questType:'normal',questClass:'',useInventoryCurveSolver:true}}
export function matrixPlan(b,now){
  const filters=new Map(),add=(rarity=[],svtClass=[],attribute=[],traits=[],matchAll=false)=>{
    const f=emptyRosterFilter();for(const [k,v] of Object.entries({rarity,svtClass,attribute}))f[k].options=v
    f.trait.options=traits;f.trait.matchAll=matchAll;filters.set(JSON.stringify(f),f)
  }
  const classes=[...new Set(b.servants.map(s=>s.className)), 'extra'].filter((x,i,a)=>a.indexOf(x)===i).sort()
  add()
  for(const r of [0,1,2,3,4,5])for(const c of classes)for(const [a] of ATTR_OPTIONS)for(const t of TRAIT_OPTIONS)add([r],[c],[a],[t.id])
  for(const r of [0,1,2,3,4,5])add([r])
  for(const c of classes)add([],[c])
  for(const [a] of ATTR_OPTIONS)add([],[],[a])
  for(const t of TRAIT_OPTIONS)add([],[],[],[t.id])
  for(const r of [[0,1,2,3],[4,5]])for(const c of [['saber','archer'],['lancer','rider'],['caster','assassin','berserker']])for(const a of [['man','earth'],['sky','star']])for(const t of [[1,300],[2,303],[2821,2654]])for(const all of [false,true])add(r,c,a,t,all)
  const domains=new Map();let empty=0
  const forms=b.servants.flatMap(s=>servantBondForms(s).map(f=>({s,f})))
  for(const filter of filters.values()){
    const members=forms.filter(({s,f})=>matchRosterForm(s,f,filter)).map(({s,f})=>s.id+':'+f.key)
    if(!members.length){empty++;continue}
    const key=hash(JSON.stringify(members));let d=domains.get(key)
    if(!d){d={key,filters:[],members};domains.set(key,d)}d.filters.push(filter)
  }
  const eligible=b.quests.filter(q=>q.bond>0&&q.type!=='grand'&&!q.supportServants?.length&&questPartyRules(q).supported&&
    (!q.openedAt||q.openedAt<=now)&&(!q.closedAt||q.closedAt>=now))
  const quests=[],pick=list=>{const q=list[0];if(q&&!quests.some(x=>x.id===q.id&&x.phase===q.phase))quests.push(q)}
  const sorted=list=>list.sort((a,b)=>b.bond-a.bond||a.id-b.id)
  const free=sorted(eligible.filter(q=>q.type==='free'&&!q.eventId));pick(free);pick([...free].reverse())
  const training=sorted(eligible.filter(q=>/修炼场|修練場/.test(q.name)));pick(training);pick(training.filter(q=>q.id!==training[0]?.id&&q.bond===training[0]?.bond))
  pick(sorted(eligible.filter(q=>/宝物库|宝物庫/.test(q.name))))
  pick(sorted(eligible.filter(q=>q.eventId>0&&q.type==='event')))
  pick(sorted(eligible.filter(q=>q.type==='event'&&!q.eventId&&!/修炼场|修練場|宝物库|宝物庫/.test(q.name))))
  // Equivalent quest models may share a completed solve only when base,
  // party rules and every identity's effective bonus are identical.
  const models=new Map()
  for(const quest of quests){
    const bonuses=b.servants.map(s=>{const x=getEffectiveBondBonus({servantId:s.id,catalog:b.bondBonuses,quest,now});return [x.totalSecondLayer,x.party,x.partyApplySupport]})
    const key=hash(JSON.stringify([quest.bond,questPartyRules(quest),bonuses]))
    let model=models.get(key);if(!model){model={key,quests:[]};models.set(key,model)}model.quests.push(quest)
  }
  return {region:b.region,filters:filters.size,empty,domains:[...domains.values()],quests,models:[...models.values()]}
}
