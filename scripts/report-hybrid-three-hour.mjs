import {readdirSync,readFileSync,statSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {MODELS,writeJson,validateRows} from './all-score-teams-3h-lib.mjs'

export function buildReport(cases,ids=WIDE_CASE_IDS,models=MODELS){
 const errors=[],records=[],seen=new Set()
 for(const item of cases){const key=item.id+'/'+item.model;if(seen.has(key))errors.push('Duplicate pair: '+key);seen.add(key)}
 const median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1]
 for(const id of ids){
  const domain=cases.filter(c=>c.id===id)
  if(new Set(domain.map(c=>c.inputSha256)).size>1)errors.push('Input mismatch: '+id)
  errors.push(...validateRows(domain.flatMap(c=>c.samples||[])).map(e=>id+': '+e))
  for(const model of models){
   const item=domain.find(c=>c.model===model)
   if(!item){errors.push('Missing pair: '+id+'/'+model);continue}
   if(!item.finished||item.status==='failed')errors.push('Unfinished or failed pair: '+id+'/'+model)
   errors.push(...(item.errors||[]).map(e=>id+'/'+model+': '+e))
   const groups={}
   for(const resources of ['off','on']){
    const samples=item.samples.filter(s=>s.resources===resources)
    if(samples.length!==item.rounds||new Set(samples.map(s=>s.round)).size!==item.rounds)errors.push('Missing or duplicate repeats: '+id+'/'+model+'/'+resources)
    if(samples.some(s=>!s.affinityVerified))errors.push('CPU affinity missing: '+id+'/'+model+'/'+resources)
    groups[resources]={status:samples.length&&samples.every(s=>s.status==='complete')?'complete':samples.length&&samples.every(s=>s.status==='timeout')?'timeout':'error',
     medianMs:samples.length?median(samples.map(s=>s.ms)):null,best:samples[0]?.best??null,
     maxRssMiB:samples.length?Math.max(...samples.map(s=>s.maxRssMiB||0)):null,samples}
   }
   records.push({id,model,inputSha256:item.inputSha256,off:groups.off,on:groups.on,
    ratio:groups.off.status==='complete'&&groups.on.status==='complete'?groups.on.medianMs/groups.off.medianMs:null})
  }
 }
 if(new Set(cases.map(c=>c.source?.commit)).size>1)errors.push('Mixed source commits')
 const count=status=>records.flatMap(r=>[r.off,r.on]).filter(x=>x.status===status).length
 return {schema:1,source:cases[0]?.source??null,errors,records,complete:count('complete'),timeout:count('timeout'),failed:count('error')}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2),cases=[]
 function walk(path){for(const name of readdirSync(path)){const p=join(path,name);if(statSync(p).isDirectory())walk(p);else if(name==='case.json')cases.push(JSON.parse(readFileSync(p,'utf8')))}}
 walk(input);const report=buildReport(cases);writeJson(join(output,'report.json'),report)
 const lines=['# 资源剪枝开关同机三小时对照','',`源提交：\`${report.source?.commit}\`。完成 ${report.complete}，超时 ${report.timeout}，异常 ${report.failed}；报告校验错误 ${report.errors.length}。`,
  '', '每个压力查询独立限时3小时；超时不代表已证明最优或收齐方案。普通条件为三次冷进程中位数。仅完整完成的两侧给出耗时比，跨机器绝对耗时不作排名。',
  '', '| 条件 | AI | 关闭资源剪枝 | 开启资源剪枝 | 开启/关闭耗时比 |','|---|---|---:|---:|---:|']
 for(const r of report.records){const cell=x=>x.status==='complete'?`${x.medianMs.toFixed(2)} ms`:`${x.status} (${x.medianMs?.toFixed(0)} ms)`;lines.push(`| ${r.id} | ${r.model} | ${cell(r.off)} | ${cell(r.on)} | ${r.ratio==null?'—':r.ratio.toFixed(3)} |`)}
 if(report.errors.length)lines.push('','校验错误：',...report.errors.map(e=>'- '+e))
 const {writeFileSync}=await import('node:fs');writeFileSync(join(output,'README.md'),lines.join('\n')+'\n')
 console.log(JSON.stringify({complete:report.complete,timeout:report.timeout,failed:report.failed,errors:report.errors}))
 if(report.errors.length)process.exitCode=1
}
