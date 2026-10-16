import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { isPlayableServant } from '../src/game-data.js'
import { pickCeSkill } from '../src/atlas.js'
import { servantBondForms } from '../src/recommend.js'

export function randomSource(seed) {
  let state=seed>>>0
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
}
const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url),'utf8'))
export const trainingDataVersion=createHash('sha256').update(readFileSync(new URL('../src/data/servants.json',import.meta.url)))
  .update(readFileSync(new URL('../src/data/ces.json',import.meta.url))).digest('hex')
const realServants=read('src/data/servants.json').filter(isPlayableServant)
const realCes=read('src/data/ces.json').filter(c=>{
  const fs=pickCeSkill(c,true)?.funcs||[]
  return fs.length===1&&!fs[0].eventId&&fs[0].target==='ptFull'&&
    ((!fs[0].add&&fs[0].rate>0)||(fs[0].add===50&&!fs[0].rate&&!fs[0].tvals?.length&&!fs[0].andTvals?.length))
})
const ce=(id,rate,cost,traits=[],flat=0)=>({id,collectionNo:id,name:'CE '+id,cost,rarity:4,
  skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target:'ptFull',rate:mlb?rate:Math.floor(rate/2),
    followerRate:mlb?rate+50:Math.floor(rate/2),add:flat,eventId:0,
    tvals:traits.map(id=>({id})),andTvals:[]}]}))})

// Seeds, not user captures, define reproducible and disjoint query domains.
export function makeSearchCase(seed,{real=false,larger=false}={}) {
  const rand=randomSource(seed),int=(a,b)=>a+Math.floor(rand()*(b-a+1)),pick=xs=>xs[int(0,xs.length-1)]
  const sample=(xs,n)=>{const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=int(0,i);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
  const n=larger?int(10,12):int(3,9)
  const servants=real?sample(realServants,n):Array.from({length:n},(_,i)=>{
    const traits=sample([10,11,12,13],int(0,3)),cost=pick([0,1,3,4,7,12,16])
    return {id:1000+i,collectionNo:100+i,name:'Synthetic '+i,className:'saber',rarity:3,cost,traitIds:traits,
      forms:rand()<.3?[{key:'c1',cost:pick([3,7,12,16]),traitIds:sample([10,11,12,13],int(1,3))}]:[]}
  })
  const catalog=real?sample(realCes,larger?int(5,6):int(2,6)):Array.from({length:larger?int(5,6):int(2,6)},(_,i)=>{
    const flat=rand()<.12?50:0
    return ce(5000+i,flat?0:pick([50,100,150,200,250]),pick([1,3,5,9,12]),rand()<.65?[pick([10,11,12,13])]:[],flat)
  })
  const ownCes=catalog.flatMap(c=>Array.from({length:int(1,2)},()=>({...c,accountMlb:rand()>.25})))
  const layouts=pick([[0],[6],[6,3]]),cap=layouts[0]===0?6:5,base=int(0,2400)
  const states=new Map(servants.map(s=>{const maxed=rand()<.18;return [s.id,{maxed,aura:maxed&&rand()<.5?250:0}]}))
  const bonuses=Object.fromEntries(servants.map(s=>[s.id,{
    totalSecondLayer:pick([0,0,0,.5,1,2]),party:pick([0,0,0,0,.05,.10])}]))
  const requiredIds=rand()<.2?[servants[0].id]:[]
  const opts={servants,ownCes,supportCes:catalog,base,costLimit:rand()<.1?null:int(4,130),
    formsOf:s=>servantBondForms(s).slice(0,3),stateOf:s=>states.get(s.id),bonuses,layouts,requiredIds,
    requiredSeats:requiredIds.length&&rand()<.3?{[requiredIds[0]]:'back'}:{},
    emptyPositions:rand()<.15?[5]:[],minimumOwn:rand()<.12?Math.min(n,cap):1,
    allSupportAlternatives:false}
  return {id:(real?'catalog':'synthetic')+'-'+seed,seed,real,opts}
}
