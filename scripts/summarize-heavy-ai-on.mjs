import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const p='experiments/ai-heavy-comparison',bytes=readFileSync(p+'/data/runs.json'),raw=JSON.parse(bytes),integrity=JSON.parse(readFileSync(p+'/integrity.json')),plan=JSON.parse(readFileSync(p+'/plan.json'))
const sha=x=>createHash('sha256').update(x).digest('hex')
if(raw.status!=='complete'||sha(bytes)!==integrity.sha256||raw.records.length!==160||new Set(raw.records.map(r=>r.inputSha)).size!==160||raw.records.some(r=>r.runs.length!==6||r.runs.some(x=>x.status!=='ok'||x.cacheHit)))throw Error('Incomplete, corrupt or contaminated benchmark')
if(sha(readFileSync(p+'/plan.json'))!==raw.planSha)throw Error('Plan changed')
const q=(a,t)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*t))]:null
const sum=a=>a.reduce((n,x)=>n+x,0),med=a=>q(a,.5)
const pairs=raw.records.map(r=>({...r,t:Object.fromEntries(['2.0.0','2.1.1'].map(v=>[v,med(r.runs.filter(x=>x.version===v).map(x=>r.kind==='core'?x.ms:x.wallMs))]))}))
function summary(rows,label){
 if(!rows.length)return null
 let state=918231+label.length
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296},boot=[]
 for(let j=0;j<3000;j++){let a=0,b=0;for(let k=0;k<rows.length;k++){const r=rows[Math.floor(rand()*rows.length)];a+=r.t['2.1.1'];b+=r.t['2.0.0']}boot.push(a/b)}
 const a=rows.map(r=>r.t['2.0.0']),b=rows.map(r=>r.t['2.1.1']),on=rows.flatMap(r=>r.runs.filter(x=>x.version==='2.1.1')),observed=on.filter(r=>r.ai),versions={}
 for(const v of ['2.0.0','2.1.1']){const times=rows.map(r=>r.t[v]),trials=rows.flatMap(r=>r.runs.filter(x=>x.version===v));versions[v]={sumQueryMediansMs:sum(times),medianMs:med(times),p95Ms:q(times,.95),p99Ms:q(times,.99),maxQueryMedianMs:Math.max(...times),maxSingleTrialMs:Math.max(...trials.map(x=>rows[0].kind==='core'?x.ms:x.wallMs)),maxQueryEndHeapBytes:Math.max(...trials.map(x=>x.heapUsed||0))}}
 const ratio=sum(b)/sum(a)
 return {label,queries:rows.length,feasible:rows.filter(r=>r.runs[0].facts!==null).length,matching:rows.filter(r=>r.match).length,versions,timeRatio:ratio,timeReductionPercent:(1-ratio)*100,throughputFactor:1/ratio,bootstrap95:[q(boot,.025),q(boot,.975)],fasterByOver5Percent:rows.filter(r=>r.t['2.1.1']<r.t['2.0.0']*.95).length,slowerByOver5Percent:rows.filter(r=>r.t['2.1.1']>r.t['2.0.0']*1.05).length,
 ai:{requestedOnRuns:on.length,observableRuns:observed.length,enabledRuns:observed.filter(r=>r.ai.enabled).length,modelVersions:[...new Set(observed.map(r=>r.ai.modelVersion))],inferenceMedianMs:med(observed.map(r=>r.ai.inferenceMs||0)),inferenceP95Ms:q(observed.map(r=>r.ai.inferenceMs||0),.95),seedMedianMs:med(observed.map(r=>r.ai.seedMs||0)),seedP95Ms:q(observed.map(r=>r.ai.seedMs||0),.95),seedAlreadyOptimalRuns:observed.filter(r=>r.facts&&r.ai.seedBestScore===r.facts[0]).length,medianSeedShareOfQuery:med(observed.map(r=>(r.ai.seedMs||0)/(rows[0].kind==='core'?r.ms:r.wallMs)))},
 worstRegressions:rows.map(r=>({id:r.id,index:r.index,region:r.region,cohort:r.cohort,baselineMs:r.t['2.0.0'],newMs:r.t['2.1.1'],ratio:r.t['2.1.1']/r.t['2.0.0']})).sort((a,b)=>b.ratio-a.ratio).slice(0,5)}
}
const groups={}
for(const kind of ['core','worker']){
 const rows=pairs.filter(r=>r.kind===kind);groups[kind]=summary(rows,kind)
 for(const [name,min,max]of [['under1s',0,1000],['1to3s',1000,3000],['3to10s',3000,10000],['over10s',10000,Infinity]])groups[kind+'/'+name]=summary(rows.filter(r=>r.t['2.0.0']>=min&&r.t['2.0.0']<max),kind+name)
 if(kind==='core')groups['core/old-timeout']=summary(rows.filter(r=>r.historicalIncomplete),'core-old-timeout')
 else{
  groups['worker/old-timeout']=summary(rows.filter(r=>[5,6,7,19,20,21,22,23].includes(r.index)),'worker-old-timeout')
  groups['worker/new32']=summary(rows.filter(r=>r.index>=32),'worker-new32')
 }
}
const allOn=pairs.flatMap(r=>r.runs.filter(x=>x.version==='2.1.1'))
if(allOn.some(r=>r.facts!==null&&(!r.ai?.enabled||r.ai.modelVersion!=='ai200-a14c70b2c570')))throw Error('AI not active or model changed')
const result={schema:1,status:'complete',generatedAt:new Date().toISOString(),startedAt:raw.startedAt,endedAt:raw.endedAt,versions:raw.versions,environment:raw.environment,integrity,aiMode:'on',model:'ai200-a14c70b2c570',queries:160,measurements:960,allMatches:pairs.every(r=>r.match),coldCache:true,automaticDeadline:'none',groups,
scope:'Same-machine Node 24, warmed isolated version/kind Workers, cold query cache. Core solver calls and production recommendation Worker requests reported separately. Worker timer includes cloning/dispatch/solve/result return, but excludes process startup, browser catalog-pretransfer protocol, IndexedDB/OPFS, UI rendering and Android/Windows device effects. Opaque cache profile IDs include the version/trial but do not alter math inputs.',
selection:'96 historical slow core cases selected only using previous 2.0.0 timing, including all nine old timeouts; 64 fixed full-catalog generated free-mode requests. Not a random sample of everyday usage. Duration strata use fresh baseline median and are descriptive, not independent causal experiments.',
statistics:'Three rounds per condition, rotated version order. Per-query median, aggregate sum of query medians, bootstrap 3000 paired query resamples. No AI-off arm; differences are between whole versions and cannot all be attributed to AI.',
memory:'Heap figures are largest observed query-end V8 heap per Worker, not peak RSS. All Workers share one Node process; do not interpret process RSS as per-version memory.',
rawDataPublished:false,files:{plan:'plan.json',integrity:'integrity.json',raw:'data/runs.json',entrySha256:sha(readFileSync('scripts/benchmark-heavy-ai-on.mjs')),adapterSha256:sha(readFileSync('scripts/heavy-ai-bench-worker.mjs'))}}
writeFileSync(p+'/summary.json',JSON.stringify(result,null,2)+'\n',{flush:true})
const fmt=x=>x==null?'—':x.toFixed(2)
const lines=['# 2.0.0 与 2.1.1：高耗时条件对照（AI 强制开启）','','已完成 160 个不同条件、每条件每版本三轮，共 960 次正式测量。2.1.1 使用自带模型 ai200-a14c70b2c570，显式 aiMode=on；2.0.0 保持原版实现，本身没有 AI。没有加载未通过资格的 v3，没有关闭 AI 做主对照。','','| 组别 | 条件数 | 2.0.0 合计中位耗时 | 2.1.1 合计中位耗时 | 耗时变化 | 耗时比 95% 区间 |','|---|---:|---:|---:|---:|---|']
lines.splice(4,0,'核心耗时比区间'+(groups.core.bootstrap95[0]<=1&&groups.core.bootstrap95[1]>=1?'包含持平，不能确认核心普遍提速。':'见下表。')+'Worker 耗时比区间'+(groups.worker.bootstrap95[1]<1?'整体低于 1，本批完整请求观察到版本优势。':'见下表，不能只看均值判断。')+'这是不同版本的对照，不是 AI 因果消融。','')
for(const name of ['core','worker','core/old-timeout','worker/old-timeout','worker/new32']){const g=groups[name];lines.push('| '+name+' | '+g.queries+' | '+fmt(g.versions['2.0.0'].sumQueryMediansMs/1000)+' s | '+fmt(g.versions['2.1.1'].sumQueryMediansMs/1000)+' s | '+fmt(-g.timeReductionPercent)+'% | '+g.bootstrap95.map(x=>x.toFixed(3)).join('–')+' |')}
lines.push('','负数表示 2.1.1 耗时减少；合计为各条件三轮中位数相加，不是整个任务墙钟时长。核心与 Worker 是两个不同测量层次，不将它们混合成软件总体提速。','','| 组别 | 2.0.0 P50/P95 | 2.1.1 P50/P95 | 快超过5%的条件 | 慢超过5%的条件 |','|---|---:|---:|---:|---:|')
for(const name of ['core','worker']){const g=groups[name],a=g.versions['2.0.0'],b=g.versions['2.1.1'];lines.push('| '+name+' | '+fmt(a.medianMs)+' / '+fmt(a.p95Ms)+' ms | '+fmt(b.medianMs)+' / '+fmt(b.p95Ms)+' ms | '+g.fasterByOver5Percent+' | '+g.slowerByOver5Percent+' |')}
lines.push('','## 按新测得的 2.0.0 单次耗时分层','','| 组别/基线耗时 | 条件数 | 2.1.1/2.0.0 合计耗时比 | 耗时变化 |','|---|---:|---:|---:|')
for(const kind of ['core','worker'])for(const bucket of ['under1s','1to3s','3to10s','over10s']){const g=groups[kind+'/'+bucket];if(g)lines.push('| '+kind+'/'+bucket+' | '+g.queries+' | '+g.timeRatio.toFixed(4)+' | '+fmt(-g.timeReductionPercent)+'% |')}
lines.push('','这些分层只描述本批样本；按同一批新测基线分层存在测量噪声选择效应，不能单凭子组声称普遍提速。','','## 正确性与启用状态','','返回方案的分数、最低 COST，以及核心查询要求的助战备选比较：'+(result.allMatches?'160/160 条件全部一致。':'存在差异，详见 summary.json。')+'其中 157 条返回方案，3 条两版均未返回方案；未返回方案的查询不暴露 AI 统计，保留在总样本中，不把它们计为 AI 关闭。成功且可观察到 AI 的 2.1.1 返回均已检查 enabled=true 和固定模型版本。所有查询无结果缓存命中；搜索无自动截止时间。')
for(const kind of ['core','worker']){const a=groups[kind].ai;lines.push('',kind+'：AI 可观察/启用 '+a.observableRuns+'/'+a.enabledRuns+' 次；推理时间中位/P95 '+fmt(a.inferenceMedianMs)+'/'+fmt(a.inferenceP95Ms)+' ms；候选核实时间中位/P95 '+fmt(a.seedMedianMs)+'/'+fmt(a.seedP95Ms)+' ms。')}
lines.push('','## 退化与内存观察','','| 组别/条件 | 2.0.0 | 2.1.1 | 耗时增加 |','|---|---:|---:|---:|')
for(const kind of ['core','worker'])for(const r of groups[kind].worstRegressions.slice(0,3))if(r.ratio>1)lines.push('| '+kind+'/'+r.index+' | '+fmt(r.baselineMs)+' ms | '+fmt(r.newMs)+' ms | '+fmt((r.ratio-1)*100)+'% |')
for(const kind of ['core','worker']){const a=groups[kind].versions['2.0.0'],b=groups[kind].versions['2.1.1'];lines.push('',kind+' 最大单次测量耗时为 '+fmt(a.maxSingleTrialMs/1000)+' / '+fmt(b.maxSingleTrialMs/1000)+' 秒；最大查询结束时 V8 heap 观察值为 '+fmt(a.maxQueryEndHeapBytes/1024**2)+' / '+fmt(b.maxQueryEndHeapBytes/1024**2)+' MiB（顺序均为 2.0.0 / 2.1.1）。')}
lines.push('','内存值不是查询过程峰值，也不是 APK/EXE 整体内存；同一 Node 进程托管多个 Worker，不能把共享 RSS 当成各版本独立 RSS。本批单次最长约半分钟，没有直接覆盖小时级单次计算。')
lines.push('','## 范围与复现','','这是同机 Node 核心和生产 Worker 模块的计算对照，进程已预热、查询缓存保持冷。Worker 计时包含结构化消息、计算和结果返回，不含浏览器目录预传、IndexedDB/OPFS、UI 渲染或 APK/EXE 实机影响。不得直接当作手机耗时；本轮没有 AI 关闭消融，不能把整版差异全部归于 AI。','','条件选择仅依据旧 2.0.0 记录，不依据 2.1.1 是否更快。96 条核心包含全部 9 条旧超时；64 条全图鉴自由模式条件涵盖 CN/JP、30/120/240/完整从者目录，后 32 条为预先固定的新增条件。共享冻结目录与数学输入；每轮的缓存隔离标识包含版本/轮次，不进入数学计算。这是慢条件压力样本，不代表日常使用频率。','','逐查询记录只保存在被忽略的 data/；发布本报告、汇总、方案、完整性摘要和复现脚本。源码版本与摘要见 plan.json，全部分层与最慢退化案例见 summary.json。正式软件、main、Pages 和模型更新 feed 均未修改。','','数据完整性 SHA-256：'+integrity.sha256+'。完整性验证在最终一次性写出后由独立进程执行，没有读取追加日志拼接最终统计。','','复现步骤与环境见 README.md。')
writeFileSync(p+'/RESULTS.md',lines.join('\n')+'\n',{flush:true})
console.log(JSON.stringify({allMatches:result.allMatches,groups:Object.fromEntries(['core','worker','core/old-timeout','worker/old-timeout','worker/new32'].map(k=>[k,{queries:groups[k].queries,ratio:groups[k].timeRatio,ci:groups[k].bootstrap95,baselineSeconds:groups[k].versions['2.0.0'].sumQueryMediansMs/1000,newSeconds:groups[k].versions['2.1.1'].sumQueryMediansMs/1000,p95:[groups[k].versions['2.0.0'].p95Ms,groups[k].versions['2.1.1'].p95Ms],slower:groups[k].slowerByOver5Percent}]))},null,2))

