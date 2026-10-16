import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
const target='docs/test-results/ai-21-large.json',report=JSON.parse(readFileSync(target)),recheck=JSON.parse(readFileSync('docs/test-results/ai-21-worker-recheck.json'))
assert.equal(report.status,'complete');assert.equal(recheck.status,'complete')
for(const version of Object.keys(report.versions))for(const field of ['coreSha256','workerSha256'])assert.equal(report.versions[version][field],recheck.versions[version][field],version+' production source changed')
if(!report.supersededProtocolRecords) {
  report.supersededProtocolRecords=[]
  report.initialRunnerSummary=report.summary;delete report.summary
  for(const replacement of recheck.records) {
    const index=report.records.findIndex(r=>r.id===replacement.id)
    assert.ok(index>=0);assert.equal(report.records[index].sha256,replacement.sha256)
    assert.equal(replacement.match,true);assert.ok(replacement.runs.every(r=>r.status==='ok'&&!r.cacheHit))
    report.supersededProtocolRecords.push(report.records[index])
    report.records[index]={...replacement,recheckSource:'ai-21-worker-recheck.json'}
  }
  report.protocolCorrection={at:new Date().toISOString(),queries:recheck.records.length,
    reason:'Node adapter initially did not bypass original 2.0.0 memory caching and mistook 2.0.9 chunked transport envelopes for errors. All seven affected conditions were rerun with unchanged production source and identical math-input hashes. All 63 original trial records remain in supersededProtocolRecords, including nine adapter-envelope errors; none are asserted to be product errors.',
    recheck:'ai-21-worker-recheck.json',invalidTrialRecords:report.supersededProtocolRecords.flatMap(r=>r.runs).length}
  writeFileSync(target,JSON.stringify(report)+'\n')
}
console.log(report.protocolCorrection)
