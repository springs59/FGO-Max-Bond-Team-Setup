import { pickCeSkill } from '../atlas.js'

export function fixedBonusOf(ce, asSupport = false) {
  return Math.max(0, ...[true,false].map(mlb => (pickCeSkill(ce,mlb)?.funcs || [])
    .filter(fn => !fn.eventId && !(asSupport && fn.applySupport === 0))
    .reduce((sum,fn) => sum + Math.max(0,Number(fn.add)||0),0)))
}

// Ignore trait and wearer restrictions for an admissible upper bound. Use
// actual catalog fixed values, rather than assuming future CEs also add 50.
export function fixedBonusUpperBound(ownCes, supportCes, ownSlots = 6, supportSlots = 2) {
  const own = (ownCes || []).map(ce => fixedBonusOf(ce)).sort((a,b) => b-a)
    .slice(0,ownSlots).reduce((sum,value) => sum+value,0)
  const support = Math.max(0,...(supportCes || []).map(ce => fixedBonusOf(ce,true))) * supportSlots
  return own+support
}
