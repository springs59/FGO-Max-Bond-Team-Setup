import {scorePressureFixture} from './score-first-pressure-fixtures.mjs'
import {ceHasBondGain} from '../src/game-data.js'

export const GRAND_STOCK_CASES=['full-stock','designated-grand','friend-pins','own-pins']
export function grandStockFixture(id){
 const opts=scorePressureFixture('grand-real')
 opts.spriteMode='bond_first'
 opts.account={...opts.account,ces:opts.ces.filter(ceHasBondGain).map(c=>({id:c.id,count:1,mlbCount:1}))}
 // Include ordinary non-bond inventory too: it must not be auto-equipped.
 opts.account.ces.push(...opts.ces.filter(c=>!ceHasBondGain(c)).slice(0,80).map(c=>({id:c.id,count:1,mlbCount:1})))
 if(id!=='full-stock')opts.account.servants=opts.account.servants.map(s=>({...s,isGrand:s.id===600100}))
 if(id==='friend-pins')opts.slotPins=[{position:6,ceId:9403520,ceRewardId:9407480}]
 if(id==='own-pins')opts.slotPins=[{position:1,svtId:600100,ceId:9401970,ceRewardId:9407480}]
 return {...opts,aiMode:'off',skipResultCache:true,skipSolutionLookup:true}
}
