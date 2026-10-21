"""Render the research report only from minimized aggregates."""
from pathlib import Path
import json,sys
out=Path(sys.argv[1]);x=json.loads((out/'summary-public.json').read_text());st=x['stages']
def pct(v):return f'{(v-1)*100:+.2f}%'
lines=['# 不固定推理次数：按模型寻找参与方式（2026-10-21）','',
'本轮撤销“每次查询只推理一次”的限制。比较多预算起点、神经输出 Top-K、多次剩余条件决策、停滞触发重推及组合用法。推理次数不是选择指标，也未设置总次数上限。',
'', '上一轮仅比较整查询、特征子域复用和候选去重，覆盖不足，不能据此宣布每个模型的最佳参与方式。本报告保留原结果，并扩大比较范围。','',
'## 范围与候选','',
'|模型|此次比较的用法|', '|---|---|',
'|H：经典高起点树，18 特征|原生；多预算起点；剩余条件重推；停滞 32 节点重推；多起点＋停滞重推|',
'|T：扩展策略树，60 特征|同上，使用 T 自己的策略输出|',
'|N8192：全查询神经策略，84 特征|原生；Top-2；Top-4；每 8 节点检查剩余条件；停滞重推；Top-2＋停滞重推|',
'|F：原框架双神经头，16 特征，仅作参考|逐候选；相同特征去重；分支重评；停滞重评|',
'', '共 20 个 AI 配置，另设关闭 AI 对照。F 是旧逐候选网络，并不是 T，也没有作为第四个选项加入正式软件。',
'', '多预算用原预算的 0.55、0.8、1.3、1.7 倍进行额外策略探测；候选起点仍按真实预算精确校验。Top-K 使用网络本来就输出的多个策略分数，因此可自然只做一次前向、再验证多个起点，这不是对调用次数的限制。分支/停滞用法根据剩余预算和候选重建特征，以缓存去除重复决策。',
'', '原始起点保留。模型只改变候选起点和遍历顺序，动态重推不改变根部上界策略；上界与可行性仍由精确公式确认，不用模型预测值剪掉可能最优的分支。停止触发的 32 节点与分支间隔是本轮搜索的参数，不代表已穷举所有触发规则。',
'', '## 方法与正确性','',
'- 软件算法与权重固定到 `2d21ebd76b14139051af9f4dad9b926d6aad0577`（2.1.6）。所有模式使用同一份国服/日服冻结数据；日服为保留的 10 月 20 日归档，非运行时最新资料。',
'- 国服数据与该提交一致。JavaScript 总 SHA256：`6ac8f530a16e33beb4620d4e5ac8dca7c5fa065725a54c9e5daaaaac8052660e`。具体权重、变体及压力观测代码指纹见 `final-source-manifest.json` 与 `runtime-manifest.json`。',
'- 预先执行 860 次精确结果对照及 3520 次配队合法性核验，20 个配置全部通过；覆盖核心和通用回退路径。压力观测另经 10 个运行、95 个中间配队校验。',
'- 配置串行运行，轮换运行顺序，关闭结果缓存；每个条件/配置采用多轮中位数。CPU、Node 与轮数均保留在汇总 JSON。',
'- 模式选择只用筛选与复核数据：`0.7 × log(各条件中位耗时合计比) + 0.3 × 平均 log(逐条件耗时比)`。未给推理次数加惩罚；冻结后不根据盲测改选。',
'- 选择耗时是完整核心求解或 Worker 处理函数执行时间，包含特征构造、模型、起点校验和搜索；排除导入、进程 IPC 与独立结果校验。响应往返时间扣除校验后另行汇总。原生与研究实现的 `inferenceMs` 计时边界不同，不能横向比较，也未用于选择。',
'- RSS 是含导入、输入和此前轮次的进程高水位，仅作诊断，不能直接解释为模型新增内存。',
'- 完成表示查询已返回；无解等返回也计其处理耗时，可行配队数量另列为 validCases，不将无解记成找到配队。',
'', '|阶段|条件数|配置数|预热/计时轮数|', '|---|---:|---:|---|']
for name,label in [('screen','筛选'),('confirm','复核'),('confirm-best','补充单最优解复核'),('blind','核心独立盲测'),('blind-best','单最优解独立盲测'),('integration','完整 Worker 留出验证'),('pressure','压力观测')]:
 if name in st:
  a=st[name];lines.append(f"|{label}|{a['cases']}|{len(a['configs'])}|{a['warmups']} / {a['rounds']}|")
lines+=['', f"共 {x['recordCounts']['caseEntries']} 个场景条目、{x['recordCounts']['timed']} 条正式计时、{x['recordCounts']['warmups']} 条预热；条目包含同一条件的压力复测，不能当作互不重复的独立样本。",
'', '生成的核心条件覆盖一般配队、紧 COST、覆盖率、活动加成、六名自有、锁定、库存与规模差异；前 16 个新复核及第一组盲测请求全部助战分层最优解，另用不同种子补充只求单个最优解的目标。真实软件路径包含国服/日服账号规模、复杂礼装与固定系统助战。',
'', '单最优解补充协议在产生对应结果前记录。完整 Worker 留出验证在核心盲测后增加，检查路径覆盖，沿用冻结配置，单独报告而不重新选择模型；四个合成账号变体加两个未参与本轮选择的 NPC/礼装条件。',
'', '盲测及完整 Worker 留出曾出现末条日志落盘不完整，另一次压力启动被停止；原记录保留于排除目录。受影响阶段整组重跑；完整 Worker 最终结果通过进程直接导出并校验 SHA256，正式统计只纳入完整保存的最终运行。',
'', '## 冻结候选与独立盲测','',
'|模型/候选用法|30 条复核合计耗时变化|16 条核心盲测合计变化|盲测比值 95% 区间|盲测推理次数|', '|---|---:|---:|---|---|']
for k,label in [('H_hybrid','H：多起点＋停滞重推'),('T_stalled','T：停滞重推'),('N_stalled','N：停滞重推挑战者'),('F_stalled','F：停滞重评参考')]:
 a=st['confirm-combined']['configs'][k];b=st['blind-combined']['configs'][k];lo,hi=b['totalRatioBootstrap95']
 lines.append(f"|{label}|{pct(a['totalRatioToNative'])}|{pct(b['totalRatioToNative'])}|{lo:.3f}–{hi:.3f}|{b['minInferenceCalls']}–{b['maxInferenceCalls']}|")
lines+=['', '比值小于 1 表示更快。区间用按条件成对 bootstrap 计算（3000 次），描述此批场景的不确定性，不代表所有用户条件或机器。0 次代表模型执行前已返回等情况；1 次对照是原生方式，不是其他用法的上限。',
'', 'H、T、F 的复核候选分别为表中方式；N 的复核第一名仍是原生方式，故额外保留最好的非原生候选 N_stalled 参加盲测和压力对照，避免直接假定普通条件的结论适用于压力条件。',
'', '动态原型会预构建残余特征，这也是额外工作的一部分；本轮亦未训练残余状态专用策略。因此结果针对这些具体实现，不能解释为“多次推理天然无效”。',
'', '16 条核心盲测中，上表四个重推版本均未减少记录的搜索节点；H 在 1 个条件提高了起点分数，但未转化为合计提速。结合代码路径，这表明额外特征构造、策略切换和起点验证尚未减少主要精确搜索工作。起点更高、调用更多均不能单独证明最终更快。']
if 'integration'in st:
 lines+=['','## 完整 Worker 留出验证','','|用法|合计耗时变化|响应往返合计变化|推理次数|','|---|---:|---:|---|']
 for k in ['H_hybrid','T_stalled','N_stalled','F_stalled']:
  a=st['integration']['configs'][k];f=a['family'];b=st['integration']['configs'][f+('_raw'if f=='F'else'_single')]
  lines.append(f"|{k}|{pct(a['totalRatioToNative'])}|{pct(a['totalResponseCaseMedianMs']/b['totalResponseCaseMedianMs'])}|{a['minInferenceCalls']}–{a['maxInferenceCalls']}|")
 lines+=['','这组不参与改选，也不与核心盲测混成“普遍最佳”结论。详见汇总中的逐阶段配对区间、节点与起点改进计数。']
if 'pressure'in st:
 lines+=['','## 压力观察','','每项冷启动后给求解 30 秒外部观测窗口；不是模型调用次数限制，也未改变正式软件内部的求解限制。超时只表示未在窗口内证明最优，不计为提速，也不把中间配队写成最优解。压力根目录中相同的中间解/进度观测钩子用于所有配置，压力计时不能与未加观测的常规计时混用。',
 '', '|配置|完成条件/4|超时运行|有已验证可行解的超时条件|超时前最大已观察推理次数|','|---|---:|---:|---:|---:|']
 for k,a in st['pressure']['configs'].items():lines.append(f"|{k}|{a['completeCases']}|{a['deadlineRuns']}|{a['deadlineCheckpointCases']}|{a['maxObservedDeadlineInferenceCalls']}|")
 lines+=['','超时推理次数是最后一次观测的下界，未伪造停止时的精确调用总数。各窗口末可行解相对原生的更优/相同/更差条件数见 `summary-public.json`，它们是可行下界比较，不是已知最优解质量比较。']
lines+=['','## 结论与交付边界','','这次已经实际放开推理次数，并按模型结构试了多种参与方式。当前 16 条核心盲测没有支持替换原生方式的稳定提速证据，冻结候选不满足预先约定的独立盲测证据门槛。没有因为旧的“单次推理”要求排除任何多次方式，也没有为了增加调用数而采用更慢的默认。',
'', '现有证据只能说明本轮已测配置的表现，不能宣称全局找到了“最适合”的所有用法。此次动态方案尚未训练剩余状态专用策略，也未穷举触发间隔；进一步优化应先证明能减少 DP 状态、上界检查或重复验证，再做新的独立对照。正式版运行逻辑与模型选择界面本轮未改，未发布新的安装包。',
'', '模型权重与既有训练数据保持原样，本轮没有重新训练。研究脚本、最小化性能汇总和源码指纹收录进 GitHub 日志；原始条件、逐轮输出、检查点及排除记录保留在单独的数据包中。','',
'## 复现','','在冻结的 2.1.6 检出目录放入本目录对应的研究脚本，恢复数据包中的冻结 JP 数据；使用 `FGO_INFERENCE_FIXTURES` 可对齐快照并校验指纹。运行 `scripts/inference-search/prepare.py WORK` 生成隔离变体。不要对正式软件目录直接应用研究实现。',
'', '原始数据包包含 `inputs/cases.json.br`、`inputs/prior-cases.json.br`、最终逐阶段记录、冻结选择及脚本版本指引（生成脚本在 GitHub）。用 Node 的 `brotliDecompressSync` 解压到 `WORK/cases.json` 后，依次运行下列驱动：',
'', '```sh','node scripts/inference-search/check.mjs WORK PRIOR_CASES_BR','node scripts/inference-search/run.mjs WORK screen','python scripts/inference-search/select.py WORK screen',"# 复核固定 13 个配置，见 screen-selection.json；默认变量需显式传入。",'FGO_SEARCH_KEYS=... node scripts/inference-search/run.mjs WORK confirm','FGO_SEARCH_KEYS=... node scripts/inference-search/run.mjs WORK confirm-best','python scripts/inference-search/select.py WORK confirm',"# 之后使用 confirm-selection.json 冻结的 9 个配置，包含 N 挑战者。",'FGO_SEARCH_KEYS=... node scripts/inference-search/run.mjs WORK blind','FGO_SEARCH_KEYS=... node scripts/inference-search/run.mjs WORK blind-best','FGO_SEARCH_KEYS=... node scripts/inference-search/run.mjs WORK integration','FGO_SEARCH_KEYS=... node scripts/inference-search/run.mjs WORK pressure','python scripts/inference-search/summarize.py WORK OUTPUT','python scripts/inference-search/report.py OUTPUT','```','',
'具体预算探测、触发、缓存边界、完整 Worker 与压力观测代码均在 `scripts/inference-search/`；最终实际执行顺序与计时/状态以各阶段记录为准。','']
(out/'README.md').write_text('\n'.join(lines))
print(str(out/'README.md'))
