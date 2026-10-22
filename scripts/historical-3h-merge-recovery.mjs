export const RECOVERY_CASE_IDS=['CN-open','JP-open']
function primary(report){
 if(report.primaryRecords)return report.primaryRecords
 const selected=new Map();for(const r of report.records||[]){const k=r.id+'/'+r.version;if(!selected.has(k)||r.cohort==='models')selected.set(k,r)}return [...selected.values()]
}
export function mergeRecovery(original,recovery){
 const previous=primary(original),fresh=primary(recovery),errors=[...recovery.errors],pressure=new Set(RECOVERY_CASE_IDS)
 const preserved=previous.filter(r=>!pressure.has(r.id)),priorPressureResults=previous.filter(r=>pressure.has(r.id))
 for(const r of preserved)if(r.status!=='complete'||!r.validated)errors.push('Preserved query was not complete: '+r.id+'/'+r.version)
 for(const id of RECOVERY_CASE_IDS)for(const version of Object.keys(original.versions)){
  const rows=fresh.filter(r=>r.id===id&&r.version===version),old=priorPressureResults.find(r=>r.id===id&&r.version===version)
  if(rows.length!==1){errors.push('Missing or duplicate recovery query: '+id+'/'+version);continue}
  const r=rows[0]
  if(!old||r.inputSha256!==old.inputSha256)errors.push('Recovery input changed: '+id+'/'+version)
  for(const key of ['recommendSha256','coreSha256','modelSha256'])if(r.source?.[key]!==old?.source?.[key])errors.push('Runtime source changed: '+id+'/'+version+'/'+key)
  if(JSON.stringify(r.source?.runtimeSha256)!==JSON.stringify(old?.source?.runtimeSha256))errors.push('AI policy source changed: '+id+'/'+version)
  if(r.memory?.profile!=='paired-auto'||r.memory.heapMiB<2048)errors.push('Wrong recovery memory profile: '+id+'/'+version)
 }
 const records=[...preserved,...fresh]
 if(records.length!==135)errors.push('Expected 135 unique version/condition combinations, received '+records.length)
 const summary=Object.fromEntries(Object.keys(original.versions).map(version=>{const rows=records.filter(r=>r.version===version);return [version,{complete:rows.filter(r=>r.status==='complete'&&r.validated).length,timeout:rows.filter(r=>r.status==='timeout').length,memoryLimit:rows.filter(r=>r.status==='memory-limit').length,errors:rows.filter(r=>!['complete','timeout','memory-limit'].includes(r.status)).length}]}))
 return {schema:1,status:errors.length?'failed':'complete',perQueryLimitMs:10800000,conditions:15,distinctQueries:records.length,
  originalRunId:39707712702,recoveryRunId:process.env.GITHUB_RUN_ID||'local',versions:original.versions,errors,summary,records,
  preservedQueries:preserved.length,recoveredQueries:fresh.length,priorPressureResults,
  note:'Original 768 MiB results remain unchanged. Only CN-open and JP-open are rerun with two single-core processes and a host-derived shared memory budget. Compare elapsed times within the same-host recovery pairs; do not mix memory tiers into one speed ranking.'}
}
