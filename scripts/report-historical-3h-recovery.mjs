import {readFileSync,readdirSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs'
import {join} from 'node:path'
import {RECOVERY_COHORTS,VERSIONS} from './historical-3h-versions.mjs'
import {buildHistoricalReport} from './report-historical-3h.mjs'
import {mergeRecovery,RECOVERY_CASE_IDS} from './historical-3h-merge-recovery.mjs'
const [input='test-output/historical-memory/downloaded',output='test-output/historical-memory/report']=process.argv.slice(2)
function files(root){try{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)])}catch{return []}}
const paths=files(input),cells=paths.filter(p=>p.endsWith('/cell.json')).map(p=>JSON.parse(readFileSync(p))),references=paths.filter(p=>p.endsWith('/case.json')).map(p=>JSON.parse(readFileSync(p)))
const original=JSON.parse(readFileSync(join(input,'original/report.json')))
const recovery=buildHistoricalReport(cells,references,{ids:RECOVERY_CASE_IDS,cohorts:Object.keys(RECOVERY_COHORTS)}),report=mergeRecovery(original,recovery.report)
mkdirSync(output,{recursive:true});mkdirSync(output+'/cells',{recursive:true})
writeFileSync(output+'/report.json',JSON.stringify(report,null,2)+'\n');writeFileSync(output+'/recovery-report.json',JSON.stringify(recovery.report,null,2)+'\n');writeFileSync(output+'/recovery-details.md',recovery.markdown)
copyFileSync(join(input,'original/report.json'),output+'/original-report.json')
for(const c of cells)writeFileSync(output+'/cells/'+c.id+'-'+c.cohort+'.json',JSON.stringify(c,null,2)+'\n')
const oldErrors=report.priorPressureResults.filter(r=>r.status!=='complete'),md=['# 三小时统一测试：内存修正与压力补跑','','状态：'+report.status+'。原轮135种组合中121种完成，14种发生V8堆内存不足。失败仅涉及CN-open/JP-open；39个其他分组成功。原始失败记录完整保留。',
 '','原配置每进程768 MiB堆上限，四进程并发。补跑改为同机两个独立单核进程（一个版本与当前关闭AI锚点），依据实际物理内存和cgroup限制分配，16 GiB主机每进程最多6144 MiB，预留系统及额外内存。查询仍各自限时3小时，不修改求解器或模型。',
 '','保留'+report.preservedQueries+'种其他条件结果，补跑'+report.recoveredQueries+'种压力版本组合。所有输入及求解器/模型指纹必须与原轮一致。排队时间、模块启动和原生查询耗时分别记录。',
 '','## 全部15条件的最终状态','','| 版本 | 原生完成 | 三小时超时 | 内存不足 | 其他异常 |','|---|---:|---:|---:|---:|']
for(const [v,s] of Object.entries(report.summary))md.push('| '+VERSIONS[v].label+' | '+s.complete+' | '+s.timeout+' | '+s.memoryLimit+' | '+s.errors+' |')
md.push('','“原生完成”是通过精确结算的代表解，不表示全部同分队伍完整。全部同分长跑39702948902继续单独报告。内存修正前后的耗时不混合做整体排名；补跑性能使用同机锚点比较。',
 '','## 原轮失败证据','','| 条件 | 版本 | 退出前墙钟分钟 | 原因 |','|---|---|---:|---|')
for(const r of oldErrors)md.push('| '+r.id+' | '+VERSIONS[r.version].label+' | '+(r.wallMs/60000).toFixed(1)+' | V8 heap out of memory，原堆上限768 MiB |')
md.push('','## 核查与明细','',...report.errors.map(e=>'- '+e),'','- [补跑同机性能、最高分与内存明细](recovery-details.md)','- [合并后的135种组合](report.json)','- [原轮完整数值与失败记录](original-report.json)','- [补跑全部分组记录](cells/)','- [原始工作流](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39707712702)')
writeFileSync(output+'/README.md',md.join('\n')+'\n')
console.log(JSON.stringify({status:report.status,errors:report.errors,summary:report.summary}));if(report.errors.length)process.exitCode=1
