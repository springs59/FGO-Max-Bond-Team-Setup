import {readFileSync,readdirSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs'
import {join,dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {WIDE_CASE_IDS,wideFixture} from './all-score-teams-wide-fixtures.mjs'
import {VERSIONS,COHORTS} from './historical-3h-versions.mjs'
export function buildHistoricalReport(cells,references=[],{ids=WIDE_CASE_IDS,cohorts=Object.keys(COHORTS),allowSmoke=false,limitMs=10800000}={}){
 const errors=[],optimalityFindings=[],records=[],known=new Map()
 for(const c of references)for(const r of Object.values(c.stages?.long?.models||{}))if(r.status==='complete'&&r.complete&&r.maximumProven){
  if(known.has(c.id)&&known.get(c.id).score!==r.best)errors.push('Full-enumeration reference contradicts itself: '+c.id)
  known.set(c.id,{score:r.best,inputSha256:c.inputSha256})
 }
 for(const id of ids){
  const inputs=new Set(),completed=[],o=wideFixture(id).opts,referenceObjectiveCompatible=o.optimizeBy!=='prefer'||!(o.lockSvtIds||[]).some(x=>!(o.preferSvtIds||[]).includes(x))
  for(const cohort of cohorts){
   const found=cells.filter(c=>c.id===id&&c.cohort===cohort)
   if(found.length!==1){errors.push('Missing or duplicate cell '+id+'/'+cohort);continue}
   const c=found[0];inputs.add(c.inputSha256)
   if(!c.finished)errors.push('Unfinished cell '+id+'/'+cohort)
   if(c.localSmoke&&!allowSmoke)errors.push('Smoke results cannot substitute for the full run '+id+'/'+cohort)
   if(c.limitMs!==limitMs)errors.push('Unexpected query deadline '+id+'/'+cohort)
   errors.push(...c.errors.map(e=>id+'/'+cohort+': '+e))
   if(new Set(Object.values(c.cpuMapping)).size!==4)errors.push('CPU cores overlap '+id+'/'+cohort)
   const anchor=c.models['current-off']
   for(const version of COHORTS[cohort]){
    const r=c.models[version]
    if(!r){errors.push('Missing version '+id+'/'+cohort+'/'+version);continue}
    if(!r.affinityVerified)errors.push('Affinity was not verified '+id+'/'+version)
    if(!['complete','timeout'].includes(r.status))errors.push('Query failed '+id+'/'+version+': '+(r.error||r.status))
    if(r.status==='complete'&&!r.validated)errors.push('Unvalidated completed query '+id+'/'+version)
    if(r.status==='complete')completed.push(r)
    const ref=known.get(id),referenceMatched=!!ref&&ref.inputSha256===c.inputSha256&&referenceObjectiveCompatible
    const maximumDiffers=referenceMatched&&r.status==='complete'&&r.score!==ref.score
    if(maximumDiffers)optimalityFindings.push({id,cohort,version,nativeScore:r.score,fullEnumerationScore:ref.score})
    const paired=r.status==='complete'&&r.validated&&anchor?.status==='complete'&&anchor.validated&&anchor.score===r.score&&!maximumDiffers
    records.push({id,cohort,version,...r,source:c.sources[version],inputSha256:c.inputSha256,
     sameHostCurrentOffMs:anchor?.status==='complete'?anchor.ms:null,sameHostRatio:paired?r.ms/anchor.ms:null,
     maximumVerifiedByFullEnumeration:referenceMatched&&r.status==='complete'&&r.score===ref.score,
     fullEnumerationReferenceScore:referenceMatched?ref.score:null,referenceObjectiveCompatible,
     referenceExclusion:referenceObjectiveCompatible?null:'原生指定收益目标只包含 preferSvtIds；全部同分路径还包含 lockSvtIds，不能直接比较主分值。',allScoreTeamsComplete:false})
   }
  }
  if(inputs.size>1)errors.push('Different inputs across cohorts: '+id)
  if(new Set(completed.map(r=>r.score)).size>1)errors.push('Completed native maxima disagree across versions: '+id)
 }
 const primary=records.filter(r=>r.version.startsWith('current-')?r.cohort==='models':true)
 const report={schema:1,status:errors.length?'failed':optimalityFindings.length?'complete-with-correctness-differences':'complete',limitMs,conditions:ids.length,cohorts:cohorts.length,physicalQueries:records.length,distinctQueries:primary.length,
  nativeComplete:primary.filter(r=>r.status==='complete').length,nativeTimeout:primary.filter(r=>r.status==='timeout').length,
  versions:VERSIONS,errors,optimalityFindings,records,summary:Object.fromEntries(Object.keys(VERSIONS).map(v=>{const rows=primary.filter(r=>r.version===v),ratios=rows.map(r=>r.sameHostRatio).filter(Number.isFinite).sort((a,b)=>a-b);return [v,{complete:rows.filter(r=>r.status==='complete').length,timeout:rows.filter(r=>r.status==='timeout').length,errors:rows.filter(r=>!['complete','timeout'].includes(r.status)).length,maximumVerified:rows.filter(r=>r.maximumVerifiedByFullEnumeration).length,maximumDiffers:rows.filter(r=>r.fullEnumerationReferenceScore!=null&&r.status==='complete'&&!r.maximumVerifiedByFullEnumeration).length,pairedRatioMedian:ratios.length?ratios[Math.floor(ratios.length/2)]:null}]}))}
 const n=x=>Number.isFinite(x)?x.toFixed(3):'—'
 const md=['# 历史优势求解器与当前四种模式：统一三小时测试','','状态：'+report.status+'；'+ids.length+'种统一条件，'+primary.length+'种版本/条件组合，含同机锚点复测共'+records.length+'次查询。每次最多3小时。',
  '','## 对比口径','','所有版本使用原生 `recommendTeam`，相同公开数据快照、账号合成规则、输入条件、冷进程与单核绑定。历史模型保留各版本原生 AI 用法，2.0 原版关闭 AI；当前三个模型使用各自策略。',
  '','本表比较最优代表解查询。原生返回并通过当前精确结算，不等于已收集全部最高分队伍。全部同分队伍的三小时测试继续独立保留：[原始全量长跑](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39702948902)。若该长跑已有相同输入的完整结果，本报告额外交叉验证最高分。',
  '','每个同机分组都有当前关闭 AI 的锚点。耗时比仅在同机、同输入、已完成且同分时计算；跨主机的毫秒数不能直接排名。每格一次，结果只描述本轮。',
  '','## 总体结果','','| 版本 | 原生完成 | 超时 | 异常 | 最高分核对通过 | 最高分不一致 | 同机耗时比中位数 |','|---|---:|---:|---:|---:|---:|---:|']
 for(const [v,s] of Object.entries(report.summary))md.push('| '+VERSIONS[v].label+' | '+s.complete+' | '+s.timeout+' | '+s.errors+' | '+s.maximumVerified+' | '+s.maximumDiffers+' | '+n(s.pairedRatioMedian)+' |')
 md.push('','耗时比 = 该版本原生查询耗时 / 同机当前关闭 AI 耗时。小于1表示本次配对更快。','','## 全部条件和版本','','| 条件 | 分组 | 版本 | 状态 | 最高分 | 毫秒 | 同机耗时比 | 峰值RSS MiB | 穷举最高分核对 |','|---|---|---|---|---:|---:|---:|---:|---|')
 for(const r of records)md.push('| '+[r.id,r.cohort,VERSIONS[r.version].label,r.status,r.score??r.bestValidated?.score??'—',n(r.ms),n(r.sameHostRatio),n(r.maxRssMiB),r.maximumVerifiedByFullEnumeration?'通过':'未证明'].join(' | ')+' |')
 md.push('','## 固定版本','','| 版本 | 提交 |','|---|---|');for(const v of Object.values(VERSIONS))md.push('| '+v.label+' | `'+v.ref+'` |')
 md.push('','## 最高分差异与目标范围','','原生完成只表示该版本返回结果，不自动计为最优性验证通过。若完整枚举给出更高分，本表明确记录差异，并排除该格的性能优势排名。指定收益同时带锁定从者时，两个接口的目标范围不同，分值不可直接对照；同分枚举结果继续按原协议报告。',
  '',...optimalityFindings.map(f=>'- '+f.id+'/'+f.cohort+'/'+f.version+'：原生 '+f.nativeScore+'，完整枚举 '+f.fullEnumerationScore+'。'),
  '','## 异常与范围','','超时、进程错误、结果不一致全部保留。超时前上报分数与经过精确结算的可行分数分开记录；没有合法队伍检查点时不把上报数值当作解。旧版本的代表解、压缩替代成员或 plans 数量均不视为全部同分队伍数量。',
  '','测试包含条件命中、固定增量、无助战六人、指定收益、锁位/库存/满绊、活动、冠位、固定 NPC、国日服小中大账号及大量零分同分队伍。无额外低分队伍穷举，不保存逐队大档案。',
  '',...errors.map(e=>'- '+e),'','- [完整数值和全部同机对照](report.json)','- [原始记录、检查点与来源指纹](cells/)')
 return {report,markdown:md.join('\n')+'\n'}
}
function files(root){try{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)])}catch{return []}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input='test-output/historical-3h/downloaded',output='test-output/historical-3h/report']=process.argv.slice(2),paths=files(input),cellPaths=paths.filter(p=>p.endsWith('/cell.json')),references=paths.filter(p=>p.endsWith('/case.json')).map(p=>JSON.parse(readFileSync(p))),cells=cellPaths.map(p=>JSON.parse(readFileSync(p)))
 const {report,markdown}=buildHistoricalReport(cells,references)
 mkdirSync(output,{recursive:true});mkdirSync(output+'/cells',{recursive:true});writeFileSync(output+'/report.json',JSON.stringify(report,null,2)+'\n');writeFileSync(output+'/README.md',markdown)
 for(const p of cellPaths){const c=JSON.parse(readFileSync(p));copyFileSync(p,output+'/cells/'+c.id+'-'+c.cohort+'.json')}
 console.log(JSON.stringify({status:report.status,physicalQueries:report.physicalQueries,distinctQueries:report.distinctQueries,complete:report.nativeComplete,timeout:report.nativeTimeout,errors:report.errors}))
 if(report.errors.length)process.exitCode=1
}
