import {globalFirstMultiplier} from './global-envelope.js'
export function globalCandidate(record,meta,{queryId='',kind='actual'}={}) {
  const support=meta.supports[record[1]],flat=50*record[2]+support.flat
  return {engine:'equipment-curve',formation:kind,queryId,record,
    cost:record[7],curve:{terms:Array.from({length:6},(_,i)=>({position:i+1,
      eligible:Boolean(record[8+i]),front:globalFirstMultiplier(record,meta,i),second:record[8+i]||1000,flat}))}}
}
