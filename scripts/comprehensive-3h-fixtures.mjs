import {wideFixture as original,WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {liveBondBonusCatalog} from '../src/bond/bonus.js'
export {WIDE_CASE_IDS}
export const AS_OF='2026-10-22T05:30:00.000Z'
// Freeze campaign membership as input data, while leaving process clocks and
// legacy solver timing behavior untouched. Every variant receives this same
// transformed fixture. Search and validation still use the unmodified rules.
export function wideFixture(id){
 const fixture=original(id)
 if(fixture.opts.bondBonuses){
  const bag=liveBondBonusCatalog(fixture.opts.bondBonuses,fixture.opts.quest,Date.parse(AS_OF))
  const timeless=rows=>rows.map(r=>({...r,startedAt:0,endedAt:0}))
  fixture.opts={...fixture.opts,bondBonuses:{...bag,events:timeless(bag.events),extraPassives:timeless(bag.extraPassives),questFriendships:timeless(bag.questFriendships)}}
 }
 return fixture
}
