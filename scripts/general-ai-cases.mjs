import { createHash } from 'node:crypto'
import { randomSource } from './ai-search-cases.mjs'
import { servantBondForms } from '../src/recommend.js'
import { ceMilliLive } from '../src/solver/solver-index.js'

// Splits differ in rule composition, incidence construction and number ranges,
// not only seeds. No catalog IDs or family labels enter model features.
const TRAIN=[[],['trait'],['aura'],['self'],['form'],['seat'],['flat'],['trait','self'],['trait','form'],['aura','flat'],['seat','self'],['form','flat']]
const CAL=[['trait','aura','self'],['aura','form','flat'],['self','seat','flat']]
const VALID=[['trait','form','seat'],['aura','self','seat'],['trait','self','flat'],['form','seat','flat']]
const TEST=[['trait','aura','self','form'],['trait','aura','seat','flat'],['aura','self','form','seat'],['trait','self','form','flat']]
export const GENERAL_SPLITS={train:{seed:61000000,families:TRAIN},calibration:{seed:71000000,families:CAL},validation:{seed:81000000,families:VALID},test:{seed:91000000,families:TEST}}
export function semanticFingerprint(opts,near=false){
 const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),quant=(x,step)=>near?Math.round(x/step):x
 const rows=[],members=new Map()
 for(const s of opts.servants)for(const f of opts.forms[s.id]){
  const state=opts.states[s.id],bonus=opts.bonuses[s.id],edge=opts.supportCes.map(c=>[ceMilliLive(c,f,false,false),ceMilliLive(c,f,false,true),ceMilliLive(c,f,true,true)].map(x=>quant(x,100)))
  const base=[quant(f.cost??s.cost,4),quant((bonus.totalSecondLayer||0)*1000,250),quant(state.aura||0,100),Boolean(state.maxed),opts.requiredIds.includes(s.id),opts.requiredSeats[s.id]||'',opts.fixedPositions[s.id]||0]
  const r={id:s.id,base,edge};rows.push(r);if(!members.has(s.id))members.set(s.id,[]);members.get(s.id).push(r)
 }
 const columns=opts.supportCes.map(c=>[quant(c.cost,4),opts.ownCes.filter(x=>x.id===c.id&&x.accountMlb===false).length,opts.ownCes.filter(x=>x.id===c.id&&x.accountMlb!==false).length,c.skills.map(s=>s.funcs[0].add||0)])
 let rl=rows.map(r=>hash(r.base)),cl=columns.map(c=>hash(c))
 for(let round=0;round<3;round++){
  const old=rl
  rl=rows.map(r=>hash([r.base,members.get(r.id).map(x=>old[rows.indexOf(x)]).sort(),r.edge.map((e,j)=>[cl[j],e]).sort()]))
  cl=columns.map((c,j)=>hash([c,rows.map((r,i)=>[rl[i],r.edge[j]]).sort()]))
 }
 return hash([near?0:opts.base,opts.costLimit==null?null:quant(opts.costLimit,20),opts.layouts,opts.emptyPositions,opts.minimumOwn,opts.allSupportAlternatives,
  [...members.values()].map(xs=>xs.map(r=>rl[rows.indexOf(r)]).sort()).sort(),cl.sort()])
}
export function makeGeneralCase(split,index){
  const spec=GENERAL_SPLITS[split];if(!spec)throw Error('Unknown split')
  const seed=spec.seed+index,rand=randomSource(seed),int=(a,b)=>a+Math.floor(rand()*(b-a+1)),pick=xs=>xs[int(0,xs.length-1)],flags=spec.families[index%spec.families.length],has=k=>flags.includes(k)
  const n=split==='train'?int(5,12):split==='calibration'?int(7,15):split==='validation'?int(8,24):int(12,36)
  const groupN=split==='train'?int(2,5):split==='calibration'?int(3,6):split==='validation'?int(4,7):int(5,8)
  const rates=split==='train'?[50,100,150,200,250,500]:split==='calibration'?[60,120,180,240,360]:split==='validation'?[65,135,225,315,475]:[77,183,299,411,633]
  const ordinal=Object.keys(GENERAL_SPLITS).indexOf(split),svtBase=100000000+ordinal*10000000+index*40,ceBase=500000000+ordinal*1000000+index*16
  const traits=(i,form=0)=>!has('trait')?[]:split==='train'?[10+int(0,3),10+int(0,3)]:split==='validation'?[10+(i+form)%4,10+Math.floor(i/3)%4]:split==='test'?Array.from({length:1+(i+form)%4},(_,j)=>10+j):[10+i%4,10+(i+1+form)%4]
  const servants=Array.from({length:n},(_,i)=>({id:svtBase+i,name:'generated '+i,collectionNo:i+1,className:'saber',rarity:3,
    cost:split==='train'?pick([0,3,4,7,12,16]):pick([1,2,5,6,9,13,16]),traitIds:traits(i),
    forms:has('form')?[{key:'alternate',cost:pick([1,3,8,11,15]),traitIds:traits(i,1)}]:[]}))
  const ces=Array.from({length:groupN},(_,j)=>{
    const flat=has('flat')&&j===groupN-1?50:0,rate=flat?0:pick(rates),target=has('trait')&&j%3!==0?[10+j%4]:[]
    return {id:ceBase+j,name:'effect '+j,cost:split==='train'?pick([1,3,5,9,12]):pick([2,4,6,8,11,14]),
      skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target:'ptFull',rate:mlb?rate:Math.floor(rate*.57),followerRate:mlb?rate+30:Math.floor(rate*.57),add:flat,eventId:0,tvals:target.map(id=>({id})),andTvals:[]}]}))}
  })
  const ownCes=ces.flatMap((ce,j)=>Array.from({length:1+((j+index)%2)},()=>({...ce,accountMlb:rand()>.22})))
  const states=Object.fromEntries(servants.map((s,i)=>[s.id,{maxed:has('aura')&&i%4===0,aura:has('aura')&&i%4===0?250:0}]))
  const bonuses=Object.fromEntries(servants.map((s,i)=>[s.id,{totalSecondLayer:has('self')?(i%3===0?.5:i%3===1?1:2):0,party:0}]))
  const position=pick([0,3,6]),emptyPositions=has('seat')?[5]:[],requiredIds=has('seat')?[servants[0].id]:[]
  const requiredSeats=has('seat')?{[servants[0].id]:'front'}:{},fixedPositions=has('seat')?{[servants[0].id]:1}:{}
  const costLimit=pick([null,18,28,43,57,76,95,113]),base=split==='train'?pick([49,165,500,815,1000,1500]):split==='validation'?pick([51,167,519,837,1031,1537]):pick([1,99,251,997,1649,2451])
  const opts={servants,ownCes,supportCes:ces,base,costLimit,states,bonuses,layouts:[position],requiredIds,requiredSeats,fixedPositions,emptyPositions,minimumOwn:index%13===0?Math.min(n,position?5:6):1,allSupportAlternatives:index%3===0,
    forms:Object.fromEntries(servants.map(s=>[s.id,servantBondForms(s)]))}
  // Strict composition groups disjoint across all splits. Canonical semantic
  // hashes remove identity/name and ordering, and quantize near variants.
  const semantic={flags:[...flags].sort(),base,costLimit,layouts:opts.layouts,emptyPositions,minimumOwn:opts.minimumOwn,allTargets:opts.allSupportAlternatives,
    members:servants.map((s,i)=>[s.cost,s.traitIds.slice().sort(),opts.forms[s.id].map(f=>[f.cost,f.traitIds]).sort(),states[s.id].maxed,states[s.id].aura,bonuses[s.id].totalSecondLayer,i===0&&has('seat')]).sort(),
    effects:ces.map(c=>[c.cost,c.skills.map(s=>s.funcs)]).sort(),stock:ownCes.map(c=>[ces.findIndex(x=>x.id===c.id),c.accountMlb]).sort()}
  delete semantic.flags
  const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
  const near={...semantic,base:0,costLimit:costLimit==null?'unlimited':Math.floor(costLimit/20),members:semantic.members.map(m=>[Math.floor(m[0]/4),...m.slice(1)])}
  return {split,index,seed,family:flags.slice().sort().join('+')||'basic',structureKey:flags.slice().sort().join('+')||'basic',inputSha256:semanticFingerprint(opts),nearSha256:semanticFingerprint(opts,true),opts}
}
export const materializeGeneral=o=>({...o,formsOf:s=>o.forms[s.id],stateOf:s=>o.states[s.id]})
