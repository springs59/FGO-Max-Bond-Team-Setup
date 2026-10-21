import assert from 'node:assert/strict'
import {scoreTeamResultsHtml,scoreTeamProgressText} from './score-team-results.js'
assert.equal(scoreTeamResultsHtml(null),'')
const info={bestScore:10039,bestCount:129,otherCount:17,complete:false,maximumProven:false,pageSize:64,kind:'best',offset:64}
assert.match(scoreTeamProgressText(info),/正在证明/);assert.doesNotMatch(scoreTeamProgressText(info),/已列全/)
const html=scoreTeamResultsHtml(info)
assert.match(html,/最高分配队（129）/);assert.match(html,/途中其他队伍（17）/)
assert.match(html,/data-score-page="128"/);assert.match(html,/不截断全部同分结果/)
assert.match(scoreTeamProgressText({...info,complete:true,maximumProven:true}),/已列全/)
assert.match(scoreTeamProgressText({...info,stopped:true}),/尚未证明完整/)
console.log('All-score UI: completeness labels, full counts, both result categories and pagination passed')
