import {readdirSync,readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {VERSIONS,CONTENDERS,ANCHOR,SOURCE,PREVIOUS,FULL,expectedCommit} from './comprehensive-3h-config.mjs'
import {WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {writeJson} from './all-score-teams-3h-lib.mjs'
export const median=xs=>xs.length?xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)]:null
const fmt=n=>n==null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:2})
const seconds=n=>n==null?'—':fmt(n/1000)
const good=r=>r?.status==='complete'&&r.validated
export function buildComparison(cells,{ids=WIDE_CASE_IDS,contenders=CONTENDERS,limitMs=10800000,allowSmoke=false,regression=null,browser=null,runUrl=''}={}){
 const errors=[],findings=[],byPair=new Map(),records=[],allRows=[]
 for(const c of cells){const key=c.id+'/'+c.contender;if(byPair.has(key))errors.push('Duplicate pair '+key);byPair.set(key,c)}
 for(const id of ids)for(const contender of contenders){
  const c=byPair.get(id+'/'+contender)
  if(!c){errors.push('Missing pair '+id+'/'+contender);records.push({id,contender,missing:true});continue}
  if(!c.finished||c.status==='infrastructure-failure')errors.push('Unfinished/infrastructure pair '+id+'/'+contender)
  if(c.limitMs!==limitMs)errors.push('Wrong deadline '+id+'/'+contender)
  if(c.localSmoke&&!allowSmoke)errors.push('Smoke result cannot replace formal run '+id+'/'+contender)
  if(!c.rounds?.length)errors.push('No rounds '+id+'/'+contender)
  for(const v of [contender,ANCHOR])if(c.sources?.[v]?.expectedCommit!==expectedCommit(v))errors.push('Wrong source '+id+'/'+v)
  for(const round of c.rounds||[]){
   if(round.rows?.length!==2||new Set(round.rows.map(r=>r.cpuCore)).size!==2)errors.push('Pair must have two distinct cores '+id+'/'+contender)
   for(const v of [contender,ANCHOR]){
    const r=round.rows?.find(r=>r.version===v)
    if(!r){errors.push('Missing variant '+id+'/'+v);continue}
    allRows.push({id,contender,round:round.round,...r,inputSha256:c.inputSha256,datasetSha256:c.datasetSha256})
    if(!r.affinityVerified)errors.push('CPU pinning missing '+id+'/'+v)
    if(!['complete','timeout'].includes(r.status))errors.push('Runtime failure '+id+'/'+v+': '+(r.error||r.status))
    if(r.status==='complete'&&!r.validated)errors.push('Completed result not validated '+id+'/'+v)
    if(r.status==='timeout'&&(r.maximumProvenInUnifiedDomain||r.allOptimalCovered))errors.push('Timeout falsely marked complete '+id+'/'+v)
    if(good(r)&&FULL(v)&&(!r.maximumProvenInUnifiedDomain||!r.allOptimalCovered||!r.recordsSha256||!r.optimalRecords))errors.push('Full result missing proof/coverage '+id+'/'+v)
    if(good(r)&&!FULL(v)&&r.allOptimalCovered)errors.push('Native representative falsely marked all-optimal '+id+'/'+v)
   }
  }
  const a=(c.rounds||[]).map(r=>r.rows.find(r=>r.version===contender)),b=(c.rounds||[]).map(r=>r.rows.find(r=>r.version===ANCHOR))
  const completed=a.every(good)&&b.every(good),scores=new Set([...a,...b].filter(good).map(r=>r.score))
  const row={id,contender,label:VERSIONS[contender].label,mode:VERSIONS[contender].mode,outputUnit:VERSIONS[contender].mode==='native'?'representative':VERSIONS[contender].mode==='literal'?'physical-teams':'equivalence-groups',
   rounds:c.rounds?.length||0,completedPair:completed,contenderMs:median(a.filter(good).map(r=>r.ms)),anchorMs:median(b.filter(good).map(r=>r.ms)),
   sameScore:completed&&scores.size===1,score:a[0]?.score??a[0]?.bestValidated?.score??null,anchorScore:b[0]?.score??b[0]?.bestValidated?.score??null,
   status:a[0]?.status||'missing',anchorStatus:b[0]?.status||'missing',contenderRecords:a[0]?.optimalRecords,anchorRecords:b[0]?.optimalRecords,
   ratio:completed&&scores.size===1?median(a.map((r,i)=>r.ms/b[i].ms)):null,
   comparableFullCoverage:completed&&scores.size===1&&FULL(contender),maxRssMiB:Math.max(0,...a.map(r=>r?.maxRssMiB||0)),
   anchorMaxRssMiB:Math.max(0,...b.map(r=>r?.maxRssMiB||0)),inputSha256:c.inputSha256,
   minimumMs:a[0]?.status==='timeout'?limitMs:null,diagnostics:[],rawCell:'cells/'+id+'-'+contender+'.json'}
  for(let i=0;i<a.length;i++)if(good(a[i])&&good(b[i])&&a[i].score===b[i].score&&a[i].physicalFingerprint&&b[i].physicalFingerprint){
   if(a[i].physicalCount!==b[i].physicalCount||a[i].physicalFingerprint!==b[i].physicalFingerprint)errors.push('Recoverable full optimal set differs '+id+'/'+contender+'/'+i)
   else row.physicalSetCrossCheck='complete digest and count agree'
  }
  const ar=a[0],br=b[0]
  if(VERSIONS[contender].mode==='literal'&&row.sameScore&&row.contenderRecords&&row.anchorRecords)
   row.diagnostics.push({cause:'representation',evidence:{physicalRecords:row.contenderRecords,equivalenceGroups:row.anchorRecords,
    recordRatio:row.contenderRecords/row.anchorRecords,contenderSearch:ar.search,anchorSearch:br.search,compression:br.compression},
    explanation:'Pinned literal enumeration versus directly searched recoverable families: fewer distinct stored/enumerated records. Counts use different units; equal coverage is checked separately.'})
  if(contender==='group-no-bounds')row.diagnostics.push({cause:'safe-score-bound-ablation',evidence:{withoutBounds:ar?.search,withBounds:br?.search},
   explanation:'Same frozen runtime and AI-off; only scoreTeamAudit.bounds changes. This pair isolates the bound/pruning effect within the grouped engine.'})
  if(contender.startsWith('group-')&&contender!=='group-no-bounds')row.diagnostics.push({cause:'ai-ablation',evidence:{model:VERSIONS[contender].model,
   initialScore:ar?.initialScore,anchorInitialScore:br?.initialScore,firstFeasibleMs:ar?.firstFeasibleMs,anchorFirstFeasibleMs:br?.firstFeasibleMs,
   postLastImprovementMs:ar?.postLastVerifiedImprovementMs,anchorPostLastImprovementMs:br?.postLastVerifiedImprovementMs},
   explanation:'Same grouped runtime, different AI policy. Initial quality, traversal and work after last target improvement are measured; a better starting score is not by itself proof of a faster finish.'})
  if(br?.compression?.length&&br.compression.every(c=>c===null))row.diagnostics.push({cause:'exact-fallback',explanation:'This fixture uses the literal exact fallback; grouped-domain compression is not active, so any timing difference cannot be assigned to equivalence merging.'})
  if(!FULL(contender))row.diagnostics.push({cause:'different-output-contract',explanation:'Legacy/native query returns representative plans. Current anchor preserves all optimal choices as reversible families. Timings are end-to-end task observations, not equal-output algorithm rankings.'})
  row.improvementTailMs=ar?.postLastVerifiedImprovementMs??null
  records.push(row)
 }
 for(const id of ids){
  const rows=allRows.filter(r=>r.id===id),inputs=new Set(rows.map(r=>r.inputSha256)),data=new Set(rows.map(r=>JSON.stringify(r.datasetSha256)))
  if(inputs.size>1||data.size>1)errors.push('Frozen input/data mismatch '+id)
  const proven=rows.filter(r=>good(r)&&FULL(r.version)),scores=new Set(proven.map(r=>r.score))
  if(scores.size>1)errors.push('Full engines disagree on proven primary maximum '+id)
  const feasible=rows.flatMap(r=>[r.validated?r.score:null,r.bestValidated?.score].filter(Number.isFinite)),bestKnown=feasible.length?Math.max(...feasible):null
  const provenScore=proven[0]?.score
  if(provenScore!=null&&bestKnown>provenScore)errors.push('Feasible score exceeds claimed proof '+id)
  for(const row of records.filter(r=>r.id===id&&!r.missing)){
   row.bestKnown=bestKnown;row.unifiedProvenScore=provenScore??null
   const native=rows.filter(r=>r.contender===row.contender&&r.version===row.contender&&good(r))
   if(native.some(r=>r.objectiveSemanticsMatch===false))findings.push({id,version:row.contender,type:'primary-objective-semantics',
    explanation:'Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.'})
   if(!FULL(row.contender)&&native.some(r=>bestKnown!=null&&r.score<bestKnown))findings.push({id,version:row.contender,type:'lower-than-verified-feasible',
    score:row.score,bestKnown,provenScore:provenScore??null,explanation:'Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.'})
  }
 }
 if(regression?.status!=='passed')errors.push('Full regression missing or failed')
 if(!browser?.passed)errors.push('Real Worker/OPFS/export/cache comparison missing or failed')
 const completedPairs=records.filter(r=>r.completedPair).length,timeouts=allRows.filter(r=>r.status==='timeout').length
 const report={schema:2,status:errors.length?'failed':findings.length?'complete-with-explicit-version-differences':'complete',
  generatedAt:new Date().toISOString(),runUrl,source:SOURCE,previous:PREVIOUS,limitMs,expectedPairs:ids.length*contenders.length,receivedPairs:cells.length,
  distinctVariants:new Set([ANCHOR,...contenders]).size,distinctVariantConditions:ids.length*new Set([ANCHOR,...contenders]).size,
  physicalQueryRuns:allRows.length,completedPairs,timeouts,errors,findings,regression,browser,versions:VERSIONS,records,
  method:'Same-host paired observations only. Native representative and recoverable full-optimal outputs are separate. Small fast fixtures have three alternating-core rounds; larger fixtures one cold run. Timeout is censored, never complete. Physical reconstruction checks use an explicit bounded validation budget outside engine timing; no result-set cap is applied to production search.',
  caseEnvironment:cells.map(c=>({id:c.id,contender:c.contender,environment:c.environment,memory:c.memory,inputSha256:c.inputSha256,datasetSha256:c.datasetSha256,sources:c.sources}))}
 const md=['# 当前合并版与历史优势版本：统一三小时对照','',`状态：${report.status}。完整收到 ${cells.length}/${report.expectedPairs} 个同机配对分组。`,
  '',`- 固定当前代码：\`${SOURCE}\`；上一版逐队代码：\`${PREVIOUS}\`。`,
  `- ${report.distinctVariants}种版本/模式 × ${ids.length}种条件，共${report.distinctVariantConditions}种独立组合；含重复参照及复测实际运行${allRows.length}次。`,
  '- 每个查询最多三小时；排队、启动、独立结果校验分别记录。内存按主机/cgroup分配，两个进程各最多6 GiB，不再使用768 MiB压力上限。',
  '- 低于30秒完成的小规模配对复测三轮，并交换CPU核心；压力和中等账号用例每格一次。不同主机绝对耗时不混排。',
  '- 代表解查询、逐队保留同分、可恢复等效合并分开解释；同分数量的单位不可混用。',
  '',`工作流：${runUrl}`,'','## 各版本完成情况','','| 版本/模式 | 配对完成 | 本模式超时 | 当前需求覆盖 |','|---|---:|---:|---|']
 for(const v of contenders){const rs=records.filter(r=>r.contender===v);md.push(`| ${VERSIONS[v].label} | ${rs.filter(r=>r.completedPair).length}/${ids.length} | ${rs.filter(r=>r.status==='timeout').length} | ${FULL(v)?'全部最高分可恢复':'原生代表队伍'} |`)}
 md.push('','## 每个条件的同机耗时与分数','','比值为“被测版本耗时÷当前关闭AI合并版耗时”。仅双方完成且分数相同才给比值；原生代表解即使给出观察比值，也不归入同等输出工作量排名。',
  '','| 条件 | 版本/模式 | 被测状态/分数 | 当前状态/分数 | 被测秒 | 当前秒 | 比值 | 被测峰值MiB |','|---|---|---|---|---:|---:|---:|---:|')
 for(const r of records)md.push(`| ${r.id} | ${r.label||r.contender} | ${r.status||'missing'}/${fmt(r.score)} | ${r.anchorStatus||'missing'}/${fmt(r.anchorScore)} | ${r.status==='timeout'?'>='+seconds(limitMs):seconds(r.contenderMs)} | ${r.anchorStatus==='timeout'?'>='+seconds(limitMs):seconds(r.anchorMs)} | ${r.ratio==null?'—':fmt(r.ratio)} | ${fmt(r.maxRssMiB)} |`)
 md.push('','## 真实 Worker、OPFS、导出与热缓存','','这里使用同一当前应用切换合并开关，隔离表示与保存开销；不冒充历史版本旧界面的性能测试。各场景三轮冷 Worker，随后验证热缓存新增搜索与结算均为0。',
  '','| 场景 | 逐队冷响应ms | 合并冷响应ms | 逐队导出ms | 合并导出ms | 逐队导出字节 | 合并导出字节 |','|---|---:|---:|---:|---:|---:|---:|')
 for(const c of browser?.cases||[])md.push(`| ${c.id} | ${fmt(c.physicalColdMs)} | ${fmt(c.groupedColdMs)} | ${fmt(c.physicalExportMs)} | ${fmt(c.groupedExportMs)} | ${fmt(c.physicalExportBytes)} | ${fmt(c.groupedExportBytes)} |`)
 md.push('','引擎倍数不能直接当成点击到显示结果的倍数；真实响应还包含 Worker 初始化、模块加载与结果保存等固定开销。')
 md.push('','## 差距原因与证据','','- **等效合并**：逐队版本与合并版使用相同冻结条件；比较搜索节点、实际结算数、输出记录数、形态/角色/礼装类别压缩。小域完整展开后的集合指纹另行核对，不靠只保留低 COST 或 Top-K 提速。',
  '- **上界剪枝**：`group-no-bounds` 仅关闭当前版分数上界，其他代码、AI和数据一致；这是控制变量对照。',
  '- **AI作用**：四种选择固定同一求解器，记录已验证起点、首次可行解及最后一次提高主目标之后的剩余时间。剩余时间包含证明、同分收集及摘要计算，不能全部称为验证开销。',
  '- **特殊规则回退**：压缩目录全为 null 的条件未启用普通域合并；不把此类耗时差归因于压缩。',
  '- **搜索范围/目标差异**：原生接口返回较低分，或主练/锁定目标定义不一致，分别列为版本差异。先看合法性和主目标，再谈速度。',
  '- **实现与模型差异**：代码和权重各自固定提交与SHA256，原有DP/剪枝统计按版本原始定义记录。不能将不同算法的节点计数直接当同一种工作量。',
  '- **内存与GC**：记录各进程相同堆上限、实际峰值和内存不足退出。OOM是运行异常，不视为三小时超时或成功。')
 md.push('','## 每个配对的诊断记录','','详见 [report.json](report.json) 的 `records[].diagnostics`、`caseEnvironment` 和各个 [原始分组](cells/)：包括起点、进展检查点、已验证分数、首次观测时间、最后一次主目标改善、节点、剪枝、结算次数、内存及指纹。',
  '','## 正确性、边界与回归','','所有输出按冻结当前规则重新验证身份、形态、库存、COST、锁定、助战与羁绊结算。原生“运行完成”不自动等于当前完整解空间已证明最优；能与完整枚举/合并结果对齐时才标为交叉确认。',
  '',`完整回归状态：${regression?.status||'missing'}。分组错漏、超时被误标完整、输入/源码不一致、已证明分数与更高可行解矛盾，均会使报告失败。`,
  '','物理展开对照只用于独立校验，有显式预算。超过校验预算不再展开，也不宣称该域已通过完整物理指纹对照；这不会截断生产求解器的结果或解集。',
  '','单次压力结果可以说明本条件表现，不能证明一个模型或版本对所有账号普遍最快。')
 if(findings.length)md.push('','## 版本目标/搜索范围差异','',...findings.map(f=>`- ${f.id} / ${f.version}：${f.type}；${f.score!=null?'返回分 '+f.score+'，已验证可行分 '+f.bestKnown+'。':''}${f.explanation}`))
 if(errors.length)md.push('','## 异常或缺失','',...errors.map(e=>'- '+e))
 return {report,markdown:md.join('\n')+'\n'}
}
function files(root){return existsSync(root)?readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]):[]}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const input=resolve(process.argv[2]||'test-output/comprehensive/downloaded'),output=resolve(process.argv[3]||'test-output/comprehensive/report')
 const all=files(input),cells=all.filter(p=>p.endsWith('/cell.json')).map(p=>JSON.parse(readFileSync(p,'utf8')))
 const regressionFile=all.find(p=>p.endsWith('/summary.json')),regression=regressionFile?JSON.parse(readFileSync(regressionFile,'utf8')):null
 const browserFile=all.find(p=>p.endsWith('/comprehensive-browser.json')),browser=browserFile?JSON.parse(readFileSync(browserFile,'utf8')):null
 const runUrl=process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:''
 const {report,markdown}=buildComparison(cells,{regression,browser,runUrl});mkdirSync(output,{recursive:true});writeJson(output+'/report.json',report);writeFileSync(output+'/README.md',markdown)
 for(const c of cells)writeJson(output+'/cells/'+c.id+'-'+c.contender+'.json',c)
 if(regression)writeJson(output+'/regression-summary.json',regression)
 if(browser)writeJson(output+'/comprehensive-browser.json',browser)
 console.log(JSON.stringify({status:report.status,pairs:report.receivedPairs,expected:report.expectedPairs,errors:report.errors.length,findings:report.findings.length}))
 if(report.errors.length)process.exitCode=1
}
