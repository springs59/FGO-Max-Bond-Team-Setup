import assert from 'node:assert/strict'
import {resolveServantState,abilitiesForState} from './servant-state.js'
const mash={id:800100,rarity:4,cost:0,attribute:'earth',traitIds:[201,2780],forms:[{key:'c800190',costumeId:17,name:'圣骑士',rarity:5,cost:16,attribute:'human',traitIds:[201,2780,2849]},{key:'a0',rarity:3}]}
assert.deepEqual([resolveServantState(mash,'c800190').rarity,resolveServantState(mash,'c800190').attribute,resolveServantState(mash,'c800190').cost],[5,'human',16])
assert.deepEqual(resolveServantState(mash,'c800190').traitIds,[2780,2849,202])
assert.equal(resolveServantState(mash,'a0').rarity,3)
assert.equal(resolveServantState(mash,'').rarity,4)
const nice={id:800100,skills:[{id:1,name:'通常技能',num:1,priority:1,skillSvts:[{svtId:800100,num:1,priority:1,releaseConditions:[]}]},{id:2,name:'圣骑士技能',num:1,priority:10,skillSvts:[{svtId:800100,num:1,priority:10,releaseConditions:[{condType:'equipWithTargetCostume',condNum:17}]}]}],classPassive:[],noblePhantasms:[]}
assert.equal(abilitiesForState(nice,resolveServantState(mash,''))[0].name,'通常技能')
assert.equal(abilitiesForState(nice,resolveServantState(mash,'c800190'))[0].name,'圣骑士技能')
console.log('servant-state.test.js ok')
const {readFileSync}=await import('node:fs')
const realMash=JSON.parse(readFileSync(new URL('./data/servants.json',import.meta.url))).find(s=>s.id===800100)
assert.ok(!abilitiesForState(null,resolveServantState(realMash,'')).some(s=>s.name==='印证希望的人理之剑'))
for(const key of ['c800190','c800200']){
  const selected=resolveServantState(realMash,key), abilities=abilitiesForState(null,selected)
  assert.deepEqual([selected.rarity,selected.attribute,selected.cost],[5,'human',16])
  assert.equal(abilities.filter(s=>s.group==='职阶技能').length,4)
  assert.ok(abilities.some(s=>s.name==='荣光崇高的雪花之盾 B'))
  assert.ok(abilities.some(s=>s.name==='己阵防御 C'))
  assert.ok(abilities.some(s=>s.name==='印证希望的人理之剑'))
}
