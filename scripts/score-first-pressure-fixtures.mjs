import {wideFixture} from './all-score-teams-wide-fixtures.mjs'
export const SCORE_PRESSURE_CASES=['grand-real','grand-conditional','grand-prefer','grand-pinned','ordinary-real','live-campaign','extended-count']
export function scorePressureFixture(id){
 if(id==='live-campaign')return {...wideFixture('active-event').opts,aiMode:'off'}
 if(id==='extended-count')return {...wideFixture('CN-medium').opts,allowSupport:false,
  quest:{noSupport:true,restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]}]},aiMode:'off'}
 if(id==='grand-conditional'){
  const ce=(id,rate,trait,cost)=>({id,name:'CE'+id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,tvals:trait?[{id:trait}]:[]}]}))})
  const servants=Array.from({length:8},(_,i)=>({id:i+1,collectionNo:i+1,name:'S'+i,className:'saber',rarity:i<3?5:1,cost:i<3?12:3,traitIds:i<3?[10]:[]}))
  return {servants,ces:[ce(101,300,10,12),ce(102,250,10,9),ce(103,200,10,5),ce(104,50,0,3)],base:4748,costLimit:80,allowSupport:true,questType:'grand',questClass:'saber',grandPosition:1,
   quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},aiMode:'off'}
 }
 const opts=wideFixture('CN-open').opts;opts.aiMode='off'
 if(id==='ordinary-real')return opts
 Object.assign(opts,{base:4748,costLimit:116,questType:'grand',questClass:'assassin',grandPosition:1})
 if(id==='grand-prefer')Object.assign(opts,{optimizeBy:'prefer',preferSvtIds:[600200]})
 else if(id==='grand-pinned'){
  opts.account.servants=opts.account.servants.map(s=>({...s,isGrand:s.id===600100}))
  Object.assign(opts,{grandPosition:0,slotPins:[{position:4,svtId:600100}]})
 }else if(id!=='grand-real')throw Error('Unknown pressure case '+id)
 return opts
}
