import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {wideCases} from './performance-wide-cases.mjs'
const [dir,out='docs/test-results']=process.argv.slice(2)
if(!dir)throw Error('Usage: node scripts/render-performance-wide.mjs artifact-directory output-directory')
const rawFiles=readdirSync(dir,{recursive:true}).filter(p=>/^performance-wide-\d+\.json$/.test(p.split('/').at(-1)))
const files=rawFiles.map(p=>JSON.parse(readFileSync(dir+'/'+p))),records=files.flatMap(x=>x.records)
const browserPath=readdirSync(dir,{recursive:true}).find(p=>p.split('/').at(-1)==='performance-wide-browser.json')
const browser=browserPath?JSON.parse(readFileSync(dir+'/'+browserPath)):null
const all=wideCases(),done=new Set(records.map(x=>x.id)),pending=all.filter(c=>!done.has(c.id)).map(c=>({id:c.id,kind:c.kind,cohort:c.cohort,domain:c.domain}))
const merged={...files[0],status:pending.length?'incomplete':'complete',records,
 versions:files[0]?.versions||{},environment:{scope:'Separate GitHub-hosted runners per shard; each paired case sequential on one runner.',runners:files.map(f=>f.environment)}}
writeFileSync(out+'/performance-wide-cloud-raw.json',JSON.stringify(merged)+'\n')
execFileSync(process.execPath,['scripts/summarize-performance-wide.mjs',out+'/performance-wide-cloud-raw.json',out+'/performance-wide-cloud-summary.json'],{stdio:'ignore'})
const s=JSON.parse(readFileSync(out+'/performance-wide-cloud-summary.json'))
const n=v=>Number.isFinite(v)?v.toFixed(v<1?4:2):'—'
const pct=v=>Number.isFinite(v)?((v-1)*100).toFixed(1)+'%':'—'
const names=['2.0.0','2.1.2','2.1-interval'],t=[]
t.push('# 2.0.0、2.1.2 与当前区间优化版性能对照\n')
t.push(`更新：${new Date().toISOString()}（UTC）。132 个预先定义的核心/完整请求条件，已完成 ${records.length} 个，尚未完成 ${pending.length} 个。浏览器记录 ${browser?.records?.length||0} / 108 组。**未完成时不得把本报告当作全矩阵最终结论。**\n`)
t.push('基线 2.0.0：`6320a8f`；已发布 2.1.2 同代码数据快照：`13d8fa7`；当前区间剪枝源码：`0ae9b27`（核心源码同 `a81732d`）。两种 2.1 都请求开启 AI；特殊求解路径可能不使用模型。三版使用同一输入图鉴、形态与库存，没有给旧版使用旧图鉴。\n')
t.push('条件含国服 445 / 日服 470 名候选，最多 2808 / 2969 个形态；全部普通向量羁绊礼装 34 / 59 种，每种最多 6 张，混合满破与非满破，共 204 / 354 张。另含活动自身/全体加成、特性命中、满羁绊光环、不限 COST、零预算、零基数、无解、空位、前后排锁定、无助战、自出六人、主练优先、冠位、茶壶、系统助战和复合礼装。全部礼装图鉴在完整请求中传入，但库存仍按各条件定义，不能把普通向量礼装范围解释成游戏所有特殊效果均走同一核心。\n')
t.push('每个核心/完整请求条件每版 5 轮正式测量，各有 1 轮预先排除的预热，版本顺序轮换。没有每次查询超时、人工 Worker 堆上限或慢样本删除。GitHub 托管作业自身存在 360 分钟基础设施上限；如果触发，必须列为未完成，不能记为已算出最优。各分片运行在不同机器，只有同一条件的三版配对比值可直接比较。\n')
t.push('## 分类结果\n\n时间单位 ms；每项为各条件中位耗时的合计。耗时变化相对 2.0.0，负值表示更快。核心与完整请求分开，表中只对目标一致的已完成条件计算速度比。全部条件及不一致项仍保留。\n')
t.push('| 类别 | 完成/一致 | 2.0.0 | 2.1.2 AI | 当前 AI | 2.1.2 变化 | 当前变化 |\n|---|---:|---:|---:|---:|---:|---:|')
for(const [key,g]of Object.entries(s.groups)){
 if(!g.conditions)continue
 t.push(`| ${key} | ${g.complete}/${g.matching} | ${n(g.matchingOnly['2.0.0'].sumOfQueryMediansMs)} | ${n(g.matchingOnly['2.1.2'].sumOfQueryMediansMs)} | ${n(g.matchingOnly['2.1-interval'].sumOfQueryMediansMs)} | ${pct(g.comparisons['2.1.2'].pairedSumRatio)} | ${pct(g.comparisons['2.1-interval'].pairedSumRatio)} |`)
}
t.push('\n## 正确性与资源口径\n')
t.push(`全局目标不一致：${s.mismatches.length} 条。请求全部助战/位置最优但返回目标不同：${s.records.filter(r=>r.requestedAlternativesMatch===false).length} 条。只请求全局最优时的附带候选差异：${s.auxiliaryDifferences.filter(r=>!r.allSupportAlternatives).length} 条。附带候选不保证各自已求到最优，不能把这类差异混为全局求解错误。全部差异可在 JSON 中逐条检查。\n`)
t.push('Node 的 heapUsed 为查询结束后的 Worker 堆观察值，不是峰值内存或手机内存。原始 JSON 保留每轮耗时、分数/COST/主练等目标、初始下界、推理和起点耗时、节点与剪枝统计。完整请求包括输入/输出克隆和推荐处理，纯核心不含数据传输、持久化和界面。\n')
t.push('## AI 开销与精确搜索\n\n推理和起点耗时均取每条件正式轮次的中位数。起点耗时包含精确核实，不应误称为神经网络推理；相减只能表示扣除这些阶段的剩余耗时，不能预测关闭 AI 的真实速度，因为搜索顺序和节点数也会变化。\n\n| 条件 | 版本 | 总耗时 ms | 模型推理 ms | 起点核实 ms | 已核实初始分数 | 最优分数 | DP 跳过次数 |\n|---|---|---:|---:|---:|---:|---:|---:|')
for(const r of s.records)for(const name of names.slice(1)){
 const v=r.stats[name],a=v.ai
 if(!a?.enabled)continue
 t.push(`| ${r.id} | ${name} | ${n(v.medianMs)} | ${n(v.inferenceMedianMs)} | ${n(v.seedMedianMs)} | ${a.initialLowerBound??a.seedBestScore??'—'} | ${v.facts?.[0]??'—'} | ${a.dpStatePruned??'—'} |`)
}
t.push('## 逐条件核心与完整请求\n\n| 条件 | 类别 | 人数 | 礼装张数 | COST | 基数 | 2.0.0 ms | 2.1.2 ms | 当前 ms | 当前变化 | 全局目标一致 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|')
for(const r of s.records.toSorted((a,b)=>a.id.localeCompare(b.id)))t.push(`| ${r.id} | ${r.cohort} | ${r.domain.identities} | ${r.domain.ceCopies} | ${r.domain.costLimit??'不限'} | ${r.domain.base} | ${n(r.stats['2.0.0'].medianMs)} | ${n(r.stats['2.1.2'].medianMs)} | ${n(r.stats['2.1-interval'].medianMs)} | ${pct(r.ratioInterval)} | ${r.objectivesMatch?'是':'否'} |`)
t.push('\n## 浏览器：重复、重启与持久化\n')
if(browser){
 t.push('真实 Chromium；每条件每版 3 轮，每轮使用独立浏览器上下文。首次包含 Worker 启动，原地重复、重启 Worker 后查询和修改基数后查询分别测量。使用真实 IndexedDB / OPFS。AI 同样开启。该测试不含 DOM 渲染、人手点击或 Android WebView。\n')
 t.push('| 条件 | 版本 | 首次 ms | 原地重复 ms | 重启 ms | 改基数 ms | OPFS 文件数/最大字节 |\n|---|---|---:|---:|---:|---:|---:|')
 const median=a=>{const x=a.toSorted((a,b)=>a-b);return x.length?x[Math.floor(x.length/2)]:NaN}
 for(const id of new Set(browser.records.map(r=>r.id)))for(const name of names){
  const rows=browser.records.filter(r=>r.id===id&&r.version===name)
  const times=['cold','retained','restart','changed'].map(k=>median(rows.flatMap(r=>(r.measurements||[]).filter(m=>m.kind===k).map(m=>m.ms))))
  const count=Math.max(0,...rows.map(r=>(r.opfsFiles||[]).length)),bytes=Math.max(0,...rows.map(r=>(r.opfsFiles||[]).reduce((s,f)=>s+f.bytes,0)))
  t.push(`| ${id} | ${name} (${rows.length}/3) | ${times.map(n).join(' | ')} | ${count} / ${bytes} |`)
 }
 const errors=browser.records.filter(r=>r.status==='error');t.push(`\n浏览器外层错误记录：${errors.length}。返回“不满足约束”的查询另见每条 valid/error，不能算作成功找到合法队伍。`)
 const matches=[]
 for(const id of new Set(browser.records.map(r=>r.id)))for(let round=0;round<browser.rounds;round++)for(const kind of ['cold','retained','restart','changed']){
  const rows=browser.records.filter(r=>r.id===id&&r.round===round)
  const facts=rows.map(r=>(r.measurements||[]).find(m=>m.kind===kind)).filter(Boolean)
  if(facts.length===3)matches.push({id,round,kind,match:new Set(facts.map(x=>JSON.stringify(x.facts))).size===1})
 }
 t.push(`\n已形成完整三版配对的浏览器阶段 ${matches.length} 组，目标不同 ${matches.filter(x=>!x.match).length} 组。配对不足的轮次不算验证通过。`)
 for(const name of names){
  const rows=browser.records.filter(r=>r.version===name)
  const hits=Object.fromEntries(['cold','retained','restart','changed'].map(k=>[k,rows.reduce((s,r)=>s+(r.measurements||[]).filter(m=>m.kind===k&&m.cacheHit).length,0)]))
  t.push(`\n${name}：${rows.length} 个上下文，各阶段缓存命中数 ${JSON.stringify(hits)}。存储 usage 最大观察值 ${Math.max(0,...rows.map(r=>r.storageUsage||0))} 字节；这含 IndexedDB 等持久数据，不是全部临时方案文件。`)
 }
 writeFileSync(out+'/performance-wide-browser.json',JSON.stringify(browser)+'\n')
}
else t.push('浏览器作业尚未上传结果，暂无最终数据。')
t.push('\n## 尚未完成的条件\n\n| 条件 | 类别 | 人数 | 礼装张数 | COST |\n|---|---|---:|---:|---:|')
for(const c of pending)t.push(`| ${c.id} | ${c.cohort} | ${c.domain.identities} | ${c.domain.ceCopies} | ${c.domain.costLimit??'不限'} |`)
t.push('\n这是有限预设测试矩阵，不是所有可能账号、条件和未来活动的穷尽证明。未完成的压力条件没有可报告的完整耗时，不能用已完成小条件推断它们也能提速。没有训练模型、没有恢复预计算扩仓，也没有改动 main 或发布安装包。')
if(existsSync(out+'/performance-wide-local-summary.json')){
 const local=JSON.parse(readFileSync(out+'/performance-wide-local-summary.json')),g=local.groups.core
 t.push('\n## 本地单独测量快照\n')
 t.push(`本地已完成快照 ${local.records.length} 个条件，每版各 5 轮。它与上面的云端配对独立统计，未与不同机器数据合并。原始状态为 ${local.status}，后续无限库存条件尚未包含，不能代表整个矩阵。\n`)
 t.push('| 项目 | 2.0.0 | 2.1.2 AI | 当前 AI |\n|---|---:|---:|---:|')
 t.push(`| 核心中位耗时合计 ms | ${names.map(name=>n(g.matchingOnly[name].sumOfQueryMediansMs)).join(' | ')} |`)
 t.push(`| 条件耗时中位数 ms | ${names.map(name=>n(g.matchingOnly[name].medianQueryMs)).join(' | ')} |`)
 t.push(`| 条件耗时 P95 ms | ${names.map(name=>n(g.matchingOnly[name].p95QueryMs)).join(' | ')} |`)
 t.push(`| 最大单条件中位耗时 ms | ${names.map(name=>n(g.matchingOnly[name].maxQueryMs)).join(' | ')} |`)
 t.push('\n[本地逐条件各轮证据摘要](performance-wide-local-summary.json)。')
}
writeFileSync(out+'/performance-wide-report.md',t.join('\n')+'\n')
writeFileSync(out+'/performance-wide-status.json',JSON.stringify({updatedAt:new Date().toISOString(),completed:records.length,expected:132,pending,browserRecords:browser?.records?.length||0},null,2)+'\n')
console.log(JSON.stringify({completed:records.length,pending:pending.length,browser:browser?.records?.length||0}))
