import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {wideCases} from './performance-wide-cases.mjs'
const [dir,out='docs/test-results']=process.argv.slice(2)
if(!dir)throw Error('Usage: node scripts/render-performance-wide.mjs artifact-directory output-directory')
mkdirSync(out,{recursive:true})
const paths=readdirSync(dir,{recursive:true})
const files=paths.filter(p=>/^performance-wide-\d+\.json$/.test(p.split('/').at(-1))).map(p=>JSON.parse(readFileSync(dir+'/'+p)))
if(!files.length)throw Error('No core/request artifacts; cannot publish an empty result as complete')
const identity=f=>JSON.stringify(Object.entries(f.versions).map(([n,v])=>[n,v.commit,v.coreSha256]))
if(new Set(files.map(identity)).size!==1)throw Error('Artifacts contain different fixed source versions; keep runs separate')
const names=Object.keys(files[0].versions),records=files.flatMap(f=>f.records)
if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('Duplicate case IDs across artifacts')
const browserPath=paths.find(p=>p.split('/').at(-1)==='performance-wide-browser.json')
const browser=browserPath?JSON.parse(readFileSync(dir+'/'+browserPath)):null
if(browser?.versions&&names.some(n=>browser.versions[n]?.commit!==files[0].versions[n].commit))throw Error('Browser source versions differ')
const all=wideCases(),done=new Set(records.filter(r=>r.complete&&names.every(n=>r.runs.filter(x=>x.name===n&&x.status==='ok').length===files[0].rounds)).map(r=>r.id))
const pending=all.filter(c=>!done.has(c.id)).map(c=>({id:c.id,kind:c.kind,cohort:c.cohort,domain:c.domain}))
const browserExpected=12*names.length*(browser?.rounds||3)
const browserComplete=browser?.status==='complete'&&browser.records.length===browserExpected&&browser.records.every(r=>r.status!=='error')
const merged={...files[0],status:pending.length||!browserComplete?'incomplete':'complete',records,
 environment:{scope:'Separate runners per shard; paired versions sequential on the same runner.',runners:files.map(f=>f.environment)}}
writeFileSync(out+'/performance-wide-cloud-raw.json',JSON.stringify(merged)+'\n')
execFileSync(process.execPath,['scripts/summarize-performance-wide.mjs',out+'/performance-wide-cloud-raw.json',out+'/performance-wide-cloud-summary.json'],{stdio:'ignore'})
const s=JSON.parse(readFileSync(out+'/performance-wide-cloud-summary.json'))
const n=v=>Number.isFinite(v)?v.toFixed(v<1?4:2):'—'
const pct=v=>Number.isFinite(v)?((v-1)*100).toFixed(1)+'%':'—'
const median=a=>{const x=a.toSorted((a,b)=>a-b);return !x.length?NaN:x.length%2?x[x.length>>1]:(x[x.length/2-1]+x[x.length/2])/2}
const t=['# 2.0.0 与 2.1 各固定版本性能对照\n',
 `更新：${new Date().toISOString()}。核心／完整请求完成 **${done.size}/${all.length}**；浏览器记录 **${browser?.records?.length||0}/${browserExpected}**。状态：**${merged.status}**。未完成时不能作为全矩阵最终结论。\n`,
 '## 固定版本\n\n| 版本 | 源码提交 | 求解核心 SHA-256 |\n|---|---|---|',
 ...names.map(name=>`| ${name} | ${files[0].versions[name].commit} | ${files[0].versions[name].coreSha256} |`),
 '\n2.1-workspace 是本次合入 main 的版本，包含保持下界质量的起点提前结束、独立队伍对比、复制与自由编队。它单独测量，不沿用区间剪枝版的数据。所有 2.1 版本请求开启 AI；非向量特殊路径可能不使用模型。\n',
 '三／四版使用同一序列化输入，并逐条件保留输入 SHA-256。核心与完整请求各版 5 轮正式测量，另有 1 轮排除的预热，轮换版本顺序。没有单次查询超时、人工 Worker 堆上限或慢例删除。GitHub 作业自身有 360 分钟上限，未完成条件仍列出。浏览器每版每条件 3 轮，首次、重复、重启与改变基数分别记录，不把缓存命中解释为 AI 提速。\n',
 '覆盖国服／日服、合成与公开图鉴、完整库存及不限 COST，以及预算、基数、活动、自出六人、空位、位置、助战、主练、冠位、零收益和无解条件。有限矩阵不是对所有未来条件的穷尽证明。\n',
 '## 分类结果\n\n各条件中位耗时合计，单位 ms；仅目标一致的已完成条件用于速度比，错误和差异保留在原始记录中。\n',
 `| 类别 | 完成/目标一致 | ${names.join(' | ')} | ${names.slice(1).map(x=>x+' 相对 2.0.0').join(' | ')} |`,
 `|---|---:|${names.map(()=> '---:|').join('')}${names.slice(1).map(()=> '---:|').join('')}`]
for(const [key,g]of Object.entries(s.groups))if(g.conditions)t.push(`| ${key} | ${g.complete}/${g.matching} | ${names.map(x=>n(g.matchingOnly[x].sumOfQueryMediansMs)).join(' | ')} | ${names.slice(1).map(x=>pct(g.comparisons[x].pairedSumRatio)).join(' | ')} |`)
t.push('\n## 正确性与 AI 开销\n',`全局目标不一致 ${s.mismatches.length} 条；要求助战／位置覆盖而不同 ${s.records.filter(r=>r.requestedAlternativesMatch===false).length} 条；只请求全局最优时的附带候选差异 ${s.auxiliaryDifferences.filter(r=>!r.allSupportAlternatives).length} 条。后者不能当作完整次优覆盖通过。\n`,
 '起点核实与神经网络推理分列。初始分数必须来自合法队伍；Node 查询结束后的堆观察值不是峰值内存。界面对比的人工编辑不包含在求解核心计时里。\n',
 '| 条件 | 版本 | 总耗时 ms | 推理 ms | 起点核实 ms | 初始下界 | 最优分数 | DP 跳过 | 达界早停 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|')
for(const r of s.records)for(const name of names.slice(1)){const v=r.stats[name],a=v.ai;if(a?.enabled)t.push(`| ${r.id} | ${name} | ${n(v.medianMs)} | ${n(v.inferenceMedianMs)} | ${n(v.seedMedianMs)} | ${a.initialLowerBound??a.seedBestScore??'—'} | ${v.facts?.[0]??'—'} | ${a.dpStatePruned??'—'} | ${a.seedCertifiedStops??'—'} |`)}
t.push('\n## 逐条件\n',`| 条件 | 类别 | 人数 | 礼装张数 | COST | 基数 | ${names.map(x=>x+' ms').join(' | ')} | 全局目标一致 |`,
 `|---|---|---:|---:|---:|---:|${names.map(()=> '---:|').join('')}---|`)
for(const r of s.records.toSorted((a,b)=>a.id.localeCompare(b.id)))t.push(`| ${r.id} | ${r.cohort} | ${r.domain.identities} | ${r.domain.ceCopies} | ${r.domain.costLimit??'不限'} | ${r.domain.base} | ${names.map(x=>n(r.stats[x].medianMs)).join(' | ')} | ${r.objectivesMatch?'是':'否'} |`)
t.push('\n## 浏览器：首次、重复、重启及存储\n\n真实 Chromium 和生产 Worker，使用真实 IndexedDB／OPFS；不包含 DOM 渲染、人工操作或手机实测。\n')
if(browser){
 t.push('| 条件 | 版本 | 轮数 | 首次 ms | 重复 ms | 重启 ms | 改基数 ms | OPFS 文件数/字节 |\n|---|---|---:|---:|---:|---:|---:|---:|')
 for(const id of new Set(browser.records.map(r=>r.id)))for(const name of names){
  const rows=browser.records.filter(r=>r.id===id&&r.version===name)
  const times=['cold','retained','restart','changed'].map(k=>median(rows.flatMap(r=>(r.measurements||[]).filter(m=>m.kind===k).map(m=>m.ms))))
  t.push(`| ${id} | ${name} | ${rows.length}/${browser.rounds} | ${times.map(n).join(' | ')} | ${Math.max(0,...rows.map(r=>(r.opfsFiles||[]).length))}/${Math.max(0,...rows.map(r=>(r.opfsFiles||[]).reduce((a,f)=>a+f.bytes,0)))} |`)
 }
 const paired=[]
 for(const id of new Set(browser.records.map(r=>r.id)))for(let round=0;round<browser.rounds;round++)for(const kind of ['cold','retained','restart','changed']){
  const facts=names.map(name=>browser.records.find(r=>r.id===id&&r.version===name&&r.round===round)?.measurements?.find(m=>m.kind===kind))
  if(facts.every(Boolean))paired.push(new Set(facts.map(x=>JSON.stringify(x.facts))).size===1)
 }
 t.push(`\n完整版本配对的浏览器阶段 ${paired.length} 组，目标不同 ${paired.filter(x=>!x).length} 组；外层错误 ${browser.records.filter(r=>r.status==='error').length} 条。缺少版本的阶段不计为通过。`)
 for(const name of names){const rows=browser.records.filter(r=>r.version===name);t.push(`\n${name}：各阶段缓存命中 ${JSON.stringify(Object.fromEntries(['cold','retained','restart','changed'].map(k=>[k,rows.reduce((a,r)=>a+(r.measurements||[]).filter(m=>m.kind===k&&m.cacheHit).length,0)])))}；存储最大观察值 ${Math.max(0,...rows.map(r=>r.storageUsage||0))} 字节。`)}
 writeFileSync(out+'/performance-wide-browser.json',JSON.stringify(browser)+'\n')
}else t.push('浏览器结果尚未上传。')
t.push('\n## 未完成条件\n\n| 条件 | 类别 | 人数 | 礼装张数 | COST |\n|---|---|---:|---:|---:|')
for(const c of pending)t.push(`| ${c.id} | ${c.cohort} | ${c.domain.identities} | ${c.domain.ceCopies} | ${c.domain.costLimit??'不限'} |`)
t.push('\n原三版作业与本次四版作业分开保存，未跨运行或跨机器直接拼接耗时；旧版数据不充当新增版本结果。[原三版报告](https://github.com/springs59/FGO-Max-Bond-Team-Setup/blob/test/performance-200-21-wide/docs/test-results/performance-wide-report.md)。')
writeFileSync(out+'/performance-wide-report.md',t.join('\n')+'\n')
writeFileSync(out+'/performance-wide-status.json',JSON.stringify({updatedAt:new Date().toISOString(),status:merged.status,versions:merged.versions,completed:done.size,expected:all.length,pending,browserRecords:browser?.records?.length||0,browserExpected},null,2)+'\n')
console.log(JSON.stringify({completed:done.size,pending:pending.length,browser:browser?.records?.length||0,versions:names}))
