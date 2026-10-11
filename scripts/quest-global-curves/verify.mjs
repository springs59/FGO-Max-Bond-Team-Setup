import fs from 'node:fs'
import assert from 'node:assert/strict'
import {describeGlobalCurve} from '../../src/solver/global-curve-description.js'
import {globalMemberPositions} from '../../src/solver/global-curve-expand.js'
import {globalClassMatches} from '../../src/solver/global-quest-rules.js'
const dir=process.argv[2],scenes=JSON.parse(fs.readFileSync(dir+'/scenes.json')),result=[]
for(const s of scenes){if(process.env.SKIP_MISSING==='1'&&!fs.existsSync(dir+'/'+s.tag+'-bank-v2.json'))continue;const {records}=JSON.parse(fs.readFileSync(dir+'/'+s.tag+'-bank-v2.json')),meta=JSON.parse(fs.readFileSync(dir+'/'+s.tag+'-meta.json')),rules=meta.rules;let maxSecond=0,rewards=0,doubleSupports=0
 assert.ok(records.length,'No curve for '+s.tag)
 for(let index=0;index<records.length;index++){const c=records[index],positions=globalMemberPositions(c),members=positions.map(i=>meta.rows[c[14+i]]),ids=members.map(m=>m.id),rewardGroup=c.at(-1)?.rewardGroup??-1,freeCounts=c.at(-1)?.rewardCounts||meta.groups.map((_,i)=>i===rewardGroup?1:0),free=freeCounts.reduce((s,v)=>s+v,0),ownEquipped=meta.groups.reduce((n,g,i)=>n+c[20+i],0),sup=meta.supports[c[1]],ext=sup.external?.length??(c[0]?1:0),frontExternal=sup.external?.filter(x=>x.position<=3).length??(c[0]===2?1:0)
  assert.equal(ids.length,new Set(ids).size);assert.equal(ids.length,c[3]);assert.equal(positions.length,new Set(positions).size);assert.ok(positions.every(i=>i>=0&&i<6));assert.ok(rules.layouts.includes(c[0]));assert.ok(c[3]<=(rules.ownMax??6));assert.ok(c[3]>=(rules.ownMin??1));assert.ok(c[3]+ext<=(rules.totalMax??6));assert.ok(c[3]+ext>=(rules.totalMin??1));assert.ok(c[3]>c[5]||c[3]===0&&rules.ownMin===0);assert.ok(ownEquipped-free<=c[3]);assert.ok(positions.filter(i=>i<3).length+frontExternal>=(rules.frontMin??1));assert.ok(members.every(m=>globalClassMatches(m.className,rules.questClass)))
  if(sup.freePositions)assert.ok(positions.every(i=>sup.freePositions.includes(i)));assert.ok(ids.every(id=>!sup.bannedIds?.includes(id)))
  let front=sup.satisfiedMask||0;positions.filter(i=>i<3).forEach(i=>front|=(meta.rows[c[14+i]].ruleRole||0)&255);assert.equal(front&(rules.frontMask||0),rules.frontMask||0)
  let cost=members.reduce((n,m)=>n+m.cost,0),ownFlat=0;for(let g=0;g<meta.groups.length;g++){const group=meta.groups[g],count=c[20+g];assert.ok(count>=0&&count<=group.items.length);assert.ok(freeCounts[g]<=count);ownFlat+=group.flat*count;for(let j=0;j<count-freeCounts[g];j++)cost+=group.items[j].cost;for(let j=count-freeCounts[g];j<count;j++)assert.ok(group.items[j].rewardEligible)}
  assert.equal(cost,c[7]);assert.ok(cost<=168);assert.equal(ownFlat,50*c[2]);if(free)rewards++
  if(c[0]&&!rules.generic&&sup.equipmentCount===2){doubleSupports++;assert.equal(new Set(sup.parts.flatMap(p=>p.items.map(i=>i.id))).size,2)}
  const party=members.reduce((n,m)=>n+m.party,0)
  for(const i of positions){if(!c[8+i])continue;const row=c[14+i];let second=1000+meta.rows[row].self+party+250*c[5]+c[6]*meta.guestPartyMax+sup.rates[row];for(let g=0;g<meta.groups.length;g++)second+=meta.groups[g].rates[row]*c[20+g];assert.equal(second,c[8+i]);maxSecond=Math.max(maxSecond,second)}
  if(index%4096===0||index===records.length-1){const d=describeGlobalCurve(c,meta);assert.equal(d.members.filter(m=>m.ce).length,d.ownNormal);assert.equal(d.ownEmpty+d.ownNormal,d.ownCount);assert.equal(d.rewards.length,free);assert.ok(free<=(rules.grandSlots??(rules.grand?1:0)));assert.equal(d.grandMembers.filter(m=>m.reward).length,free);if(rules.grandPositions?.length)assert.ok(d.grandMembers.every(m=>rules.grandPositions.includes(m.position)));if(rules.grandSlots>1){const cls=new Map();d.grandMembers.forEach(m=>cls.set(m.row.ruleRole>>8,(cls.get(m.row.ruleRole>>8)||0)+1));assert.ok([...cls].every(([cl,n])=>n<=(cl===8?2:1)))} }
 }
 assert.ok(maxSecond<=6000,'Current bonus exceeds +500% cap: '+s.tag)
 result.push({tag:s.tag,curves:records.length,freeRewardWitnesses:rewards,doubleSupportWitnesses:doubleSupports,maxSecond,passed:true});console.log(s.tag,records.length,'loadouts verified');global.gc?.()
}
const verified=new Set(result.map(s=>s.tag))
fs.writeFileSync(dir+'/quest-bank-validation.json',JSON.stringify({passed:result.length===scenes.length,availableBanksPassed:true,missingActualBanks:scenes.filter(s=>!verified.has(s.tag)).map(s=>s.tag),scenes:result,total:result.reduce((n,x)=>n+x.curves,0)},null,2))
