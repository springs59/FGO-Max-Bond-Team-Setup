import assert from 'node:assert/strict'
import {createUnorderedResultDigest,canonicalResultJson} from './score-team-result-digest.mjs'
const a={domain:0,slots:[{p:1,svt:101,mlb:true}]},b={domain:0,slots:[{svt:102,p:1,mlb:false}]}
const digest=items=>{const h=createUnorderedResultDigest();for(const x of items)h.update(x);return h.digest()}
assert.equal(digest([a,b]),digest([b,a]),'AI visitation order must not change an equal result multiset')
assert.equal(digest([a]),digest([{slots:[{mlb:true,svt:101,p:1}],domain:0}]),'Object key insertion order is irrelevant')
assert.notEqual(digest([a,b]),digest([a,a]),'Equal counts cannot hide a changed physical identity')
assert.notEqual(digest([a]),digest([a,a]),'Duplicate records must remain observable')
assert.notEqual(digest([a]),digest([{...a,domain:1}]),'Domain constraints are part of the result')
assert.notEqual(digest([a]),digest([{domain:0,slots:[{p:1,svt:101,mlb:false}]}]),'MLB states must remain distinct')
assert.notEqual(canonicalResultJson([a,b]),canonicalResultJson([b,a]),'Within a record, array order is preserved')
console.log('Result digests: unordered multiset comparison preserves identity, domain, MLB state and duplicate sensitivity')
