import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {makeSearchCase,randomSource} from './ai-search-cases.mjs'
import {isPlayableServant,ceHasBondGain} from '../src/game-data.js'
import {servantBondForms} from '../src/recommend.js'
import {pickCeSkill} from '../src/atlas.js'
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)))
const cn={servants:read('src/data/servants.json'),ces:read('src/data/ces.json')},jp=read('src/data/jp/bundle.json')
const eligible=c=>{const fs=pickCeSkill(c,true)?.funcs||[];return fs.length===1&&!fs[0].eventId&&fs[0].target==='ptFull'&&
  ((!fs[0].add&&fs[0].rate>=0)||(fs[0].add===50&&!fs[0].rate&&!fs[0].tvals?.length&&!fs[0].andTvals?.length))}
export const catalogCounts=Object.fromEntries(Object.entries({CN:cn,JP:jp}).map(([region,data])=>[region,{
  playable:data.servants.filter(isPlayableServant).length,ces:data.ces.length,bondCes:data.ces.filter(ceHasBondGain).length}]))
export function makeBenchmarkCase(i,kind='core') {
  const seed=3100000+i,rand=randomSource(seed),region=Math.floor(i/4)%2?'JP':'CN',data=region==='JP'?jp:cn
  const sample=(xs,n)=>xs.map(x=>({x,r:rand()})).sort((a,b)=>a.r-b.r).slice(0,n).map(r=>r.x)
  let opts,cohort
  if(kind==='core'&&i<900) {
    const c=makeSearchCase(seed,{real:i%3===0,larger:i>=700});opts=c.opts;cohort=i>=700?'10-12':'3-9'
    opts={...opts,forms:Object.fromEntries(opts.servants.map(s=>[s.id,opts.formsOf(s)])),
      states:Object.fromEntries(opts.servants.map(s=>[s.id,opts.stateOf(s)]))}
    delete opts.formsOf;delete opts.stateOf
  } else {
    const j=kind==='core'?i-900:i,n=[30,120,240,Infinity][j%4]
    const servants=sample(data.servants.filter(isPlayableServant),n)
    cohort=Number.isFinite(n)?String(n):'full-'+region
    // Medium/large inventories use real public traits and forms; accounts are
    // generated, never represented as a capture of the user's private account.
    const ces=sample(data.ces.filter(eligible),[4,6,8,10][Math.floor(j/4)%4])
    if(kind==='core') {
      const states=Object.fromEntries(servants.map(s=>[s.id,{maxed:rand()<.15,aura:0}]))
      opts={servants,ownCes:ces.flatMap(c=>Array.from({length:1+Math.floor(rand()*2)},()=>({...c,accountMlb:rand()>.25}))),
        supportCes:ces,base:500+Math.floor(rand()*1500),costLimit:[40,60,80,95,113,null][Math.floor(j/16)%6],
        forms:Object.fromEntries(servants.map(s=>[s.id,servantBondForms(s)])),states,
        bonuses:Object.fromEntries(servants.map(s=>[s.id,{totalSecondLayer:rand()<.15?.5:0,party:0}])),
        layouts:j%3?[6,3]:[6],minimumOwn:1,allSupportAlternatives:j%5===0}
    }else {
      opts={servants,ces:data.ces,base:500+j,mode:'free',costLimit:[40,80,95,113][Math.floor(j/4)%4],
        useInventoryCurveSolver:true,skipResultCache:true,accountProfileId:'benchmark-'+seed}
      // All CEs are transferred; runtime eligibility determines the real bond pool.
    }
  }
  const sha256=createHash('sha256').update(JSON.stringify(opts)).digest('hex')
  return {id:kind+'-'+seed,seed,region:kind==='core'&&i<900?(i%3===0?'CN':'synthetic'):region,cohort,sha256,opts}
}
