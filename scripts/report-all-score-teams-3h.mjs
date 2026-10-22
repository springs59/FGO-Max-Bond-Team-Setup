import {readdirSync,readFileSync,mkdirSync,writeFileSync,existsSync,copyFileSync} from 'node:fs'
import {resolve,join,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {compareCases,LABELS,MODELS,writeJson} from './all-score-teams-3h-lib.mjs'
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)])}
export function buildReport(cases,regression,{ids=WIDE_CASE_IDS,runId='local',runUrl='',sourceCommit='',benchmark=null}={}){
 const comparison=compareCases(cases,ids),errors=[...comparison.errors]
 if(regression?.status!=='passed')errors.push('完整回归未全部通过或缺少回归结果')
 if(sourceCommit&&(regression?.sourceCommit!==sourceCommit||cases.some(c=>c.source.commit!==sourceCommit)))errors.push('实际测试提交与固定请求提交不一致')
 const sources=new Set(cases.map(c=>c.source.commit));if(sources.size!==1)errors.push('不同条件未固定到相同源代码提交')
 const datasets=new Set(cases.map(c=>JSON.stringify(c.source.gitBlobs)));if(datasets.size!==1)errors.push('不同条件使用了不同冻结数据或求解引擎')
 const report={schema:1,status:errors.length?'failed':'finished-with-explicit-timeout-classification',generatedAt:new Date().toISOString(),runId,runUrl,sourceCommit,errors,
  protocol:{longLimitMs:10800000,normalControlMs:15000,stressControlMs:45000,cases:ids.length,models:MODELS,method:'Per condition, all four model choices run on four distinct verified CPU cores of one frozen host. Short controls precede long runs; each run uses a fresh process. Host-to-host or archived timing ratios are not used to rank models.'},
  short:comparison.short,long:comparison.long,regression,
  caseSources:cases.map(c=>({id:c.id,source:c.source,environment:c.environment,inputSha256:c.inputSha256,cpuMapping:c.cpuMapping})),
  records:comparison.records.map(({checkpoints,...row})=>({...row,checkpointCount:checkpoints.length,rawCase:'cases/'+row.id+'.json'}))}
 const rows=comparison.records,peak=Math.max(0,...rows.map(r=>r.long?.maxRssMiB||0)),fmt=n=>n==null?'—':Number(n).toLocaleString('en-US'),seconds=n=>n==null?'—':(n/1000).toFixed(2)
 const md=['# 全部最高分配队：3小时限时全量重跑对比','','状态：'+report.status+'。每个查询最多3小时；超时结果仍未证明最优或同分完整。','','- 工作流：'+runUrl,'- 固定提交：`'+sourceCommit+'`','- 同机短测：'+report.short.complete+'格完成，'+report.short.timeout+'格超时。','- 3小时长测：'+report.long.complete+'格完成，'+report.long.timeout+'格超时，'+report.long.errors+'格异常或缺失。','- 完整回归：'+(regression?.status||'缺失')+'；长测引擎峰值RSS最高'+peak.toFixed(1)+'MiB。','','## 四种选择的总体结果','','| 选择 | 短测完成 | 长测完成 | 长测超时 | 长测异常 |','|---|---:|---:|---:|---:|']
 for(const model of MODELS){const group=rows.filter(r=>r.model===model);md.push('| '+LABELS[model]+' | '+group.filter(r=>r.short?.status==='complete').length+' | '+group.filter(r=>r.long?.status==='complete').length+' | '+group.filter(r=>r.long?.status==='timeout').length+' | '+group.filter(r=>!['complete','timeout'].includes(r.long?.status)).length+' |')}
 md.push('','## 每个条件的同机短测与长测','','| 条件 | 选择 | 短测状态/当前分 | 长测状态/当前分 | 长测同分数 | 长测秒数 | 峰值MiB |','|---|---|---|---|---:|---:|---:|')
 for(const r of rows)md.push('| '+r.id+' | '+LABELS[r.model]+' | '+(r.short?.status||'missing')+'/'+fmt(r.short?.best)+' | '+(r.long?.status||'missing')+'/'+fmt(r.long?.best)+' | '+fmt(r.long?.tiedTeams)+' | '+seconds(r.long?.ms)+' | '+(r.long?.maxRssMiB?.toFixed(1)||'—')+' |')
 const previous=cases.flatMap(c=>c.archivedPrevious||[])
 report.archivedPrevious={complete:previous.filter(r=>r.status==='complete').length,timeout:previous.filter(r=>r.status==='timeout').length}
 report.resolvedShortTimeouts=rows.filter(r=>r.short?.status==='timeout'&&r.long?.status==='complete').length
 md.push('','## 相比短时限增加了什么','','上一轮历史归档：'+report.archivedPrevious.complete+'格完成、'+report.archivedPrevious.timeout+'格超时（历史机器仅作参考）。本轮有'+report.resolvedShortTimeouts+'格从同机短测超时转为长测完整结束。','','## 大规模用例的起点和枚举进度','','| 条件 | 选择 | 首个可行解秒数 | AI起点 | 长测当前分 | 首次枚举秒数 | 状态 |','|---|---|---:|---:|---:|---:|---|')
 for(const r of rows.filter(r=>['CN-medium','JP-medium','CN-open','JP-open','dense-zero'].includes(r.id)))md.push('| '+r.id+' | '+LABELS[r.model]+' | '+seconds(r.long?.firstFeasibleMs)+' | '+fmt(r.long?.initialScore)+' | '+fmt(r.long?.best)+' | '+seconds(r.long?.firstEnumeratedMs)+' | '+(r.long?.status||'missing')+' |')
 if(benchmark){md.push('','## 重跑的七轮完整配队域剪枝对照','','| 场景 | 关闭剪枝中位毫秒 | 开启剪枝中位毫秒 | 耗时比 |','|---|---:|---:|---:|');for(const c of benchmark.cases||[])md.push('| '+c.id+' | '+c.referenceMs.toFixed(2)+' | '+c.optimizedMs.toFixed(2)+' | '+c.ratio.toFixed(3)+' |');report.regressionBenchmark={passed:benchmark.passed,rounds:benchmark.rounds,environment:benchmark.environment}}
 md.push('','## 如何解释这些结果','','完整结束的查询必须满足最高分、全部同分队伍数量和SHA256一致；只要存在矛盾，报告即标为失败。部分结果不能超过另一个同条件已完成查询证明的最高分。同机短测已完成时，长测也必须给出相同完整结果。','','AI起点已精确结算，和实际枚举队伍分开记录；起点存在、枚举数为0并不代表没有可行队伍。途中其他合法队伍不额外穷举。大量同分必须保留，耗时可能主要来自枚举和完整性证明。','','上一轮归档只作历史参考。新一轮短测和3小时长测使用同一主机、同一CPU绑定、相同数据和模型；四种选择各占一个核心，同时运行。不同条件所在主机、历史归档环境的绝对时间不直接混合排名。本轮每格一次，不能据此宣称某个模型普遍最快。','','引擎测试包含抽样精确复核和流式队伍指纹，不把所有队伍写入临时档案；RSS不等于浏览器全量OPFS归档容量。分页、导出、停止、缓存、移动布局、AI更新及原有功能由完整回归单独覆盖。','','- [完整数值](report.json)','- [全体原始分格结果和时间检查点](cases/)','- [完整回归摘要](regression-summary.json)','- [七轮性能原始记录](regression/benchmark.json)','- [独立穷举逐例记录](regression/random-oracle.json)')
 if(errors.length)md.push('','## 失败或缺失项','',...errors.map(e=>'- '+e))
 return {report,markdown:md.join('\n')+'\n'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const input=resolve(process.argv[2]||'test-output/all-score-3h/downloaded'),output=resolve(process.argv[3]||'test-output/all-score-3h/report')
 const all=existsSync(input)?files(input):[],cases=all.filter(p=>p.endsWith('/case.json')).map(p=>JSON.parse(readFileSync(p,'utf8')))
 const summary=all.find(p=>p.endsWith('/summary.json')),regression=summary?JSON.parse(readFileSync(summary,'utf8')):null
 const benchmarkPath=summary?join(dirname(summary),'benchmark.json'):null,benchmark=benchmarkPath&&existsSync(benchmarkPath)?JSON.parse(readFileSync(benchmarkPath,'utf8')):null
 const {report,markdown}=buildReport(cases,regression,{runId:process.env.GITHUB_RUN_ID||'local',runUrl:process.env.GITHUB_SERVER_URL&&process.env.GITHUB_REPOSITORY?process.env.GITHUB_SERVER_URL+'/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID:'',sourceCommit:process.env.FGO_SCORE_SOURCE_COMMIT||'',benchmark})
 mkdirSync(output,{recursive:true});writeJson(output+'/report.json',report);writeFileSync(output+'/README.md',markdown);writeJson(output+'/regression-summary.json',regression)
 for(const item of cases)writeJson(output+'/cases/'+item.id+'.json',item)
 if(summary)for(const [name,target] of [['benchmark.json','benchmark.json'],['random.json','random-oracle.json']]){const path=join(dirname(summary),name);if(existsSync(path)){mkdirSync(output+'/regression',{recursive:true});copyFileSync(path,output+'/regression/'+target)}}
 console.log(JSON.stringify({status:report.status,short:report.short,long:report.long,errors:report.errors}))
 if(report.errors.length)process.exitCode=1
}
