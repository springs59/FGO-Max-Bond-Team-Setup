import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeDiverseCase, materialize } from './ai-diverse-cases.mjs'
import { prepareConfig, configFeatures, legalCounts, proposeConfigs, validConditionedModel } from './conditioned-config.mjs'
import { settleProposals, verifyConfigPlan } from './config-settler.mjs'
const model=JSON.parse(readFileSync('experiments/ai-conditioned/models/conditioned-128.json'))
assert.ok(validConditionedModel(model))
const broken=structuredClone(model);broken.layers[0].w[0].pop();assert.equal(validConditionedModel(broken),false)
const invalid=structuredClone(model);invalid.layers[1].b[0]=Infinity;assert.equal(validConditionedModel(invalid),false)
const rows=gunzipSync(readFileSync('experiments/ai-conditioned/data/validation.jsonl.gz')).toString().trim().split('\n').map(JSON.parse)
let checked=0
for(const row of rows.slice(0,72)) {
  const c=makeDiverseCase('validation',row.index),opts=materialize(c.opts),ctx=prepareConfig(opts)
  for(let i=0;i<row.counts.length;i++){
    assert.ok(legalCounts(ctx,i,row.counts.slice(0,i)).includes(row.counts[i]))
    assert.deepEqual(configFeatures(ctx,i,row.counts.slice(0,i)).x,row.steps[i].x)
  }
  // The known exact teacher configuration must reproduce its score and COST
  // through the partial completion path, which must never claim optimality.
  const exact=settleProposals(opts,[row.counts])
  assert.ok(exact);verifyConfigPlan(opts,exact)
  assert.deepEqual([exact.score,exact.cost],row.facts)
  const counts=proposeConfigs(ctx,model,{width:32,top:4})
  const zero=ctx.groups.map(()=>0)
  const approximate=settleProposals(opts,[...counts,zero])
  assert.ok(approximate);verifyConfigPlan(opts,approximate)
  assert.ok(approximate.score<=exact.score)
  const tampered=structuredClone(approximate);tampered.score++
  assert.throws(()=>verifyConfigPlan(opts,tampered),/score mismatch/)
  checked++
}
console.log('Conditioned model: structure guards, teacher masks/features, 72 exact configuration replays, independent legal scoring, approximate status and tamper rejection passed',checked)
