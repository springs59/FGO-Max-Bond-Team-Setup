# 复现高耗时条件下的 2.0.0 / 2.1.1 对照

结果见 [RESULTS.md](RESULTS.md)，配对统计见 [summary.json](summary.json)。本分支只增加基准与报告，不修改软件计算代码、main、Pages 或模型更新源。

2.0.0 固定为 `6320a8ffd31c444fbc76a64e14e576f759e1de1c`（native-v2.0.0），2.1.1 固定为 `d68e41da5d2b0a145100b6fff5827ccca0dac78c`。AI 为随 2.1.1 提供的 `ai200-a14c70b2c570`，显式 `aiMode=on`，成功返回时检查 `enabled=true` 和模型版本。没有加载资格失败的 v3。2.0.0 保持原版，本身没有 AI。没有 AI 关闭消融，不能将全部版本差异归因于神经网络。

96 个核心条件仅按旧 2.0.0 耗时排名选择：全部 9 个旧超时优先保留，再取较慢的完整条件。64 个 Worker 条件固定索引 0–63，前 32 个为旧测试范围，后 32 个为预先固定的新增条件。使用共享冻结公开目录，不使用私人账号或抓包；数学输入相同，缓存隔离标识包含版本和轮次，不参与数学计算。选择清单及源码摘要在 plan.json。

核心组直接调用各自原版库存精确求解器。Worker 组运行各自生产 recommend-worker 模块，使用通用结构化消息入口，记录发送前至结果返回时间。先对称预热进程/JIT，查询结果缓存保持冷。Worker 不包含浏览器目录预传、IndexedDB/OPFS、UI 绘制、安装包启动或设备特性，是计算压力对照，不是 APK 实机测量。

每条件三轮，版本顺序交替；只有一个查询在计算。搜索不设自动截止时间，支持手动停止。计时期间不并行训练、跑回归或其他重型任务。每条件取三轮中位数，再比较合计、P50/P95/P99、最慢值、超过 5% 的改善/退化数；区间用 3000 次按条件配对重采样。按新基线耗时分层的结果仅作描述，存在测量噪声选择效应。

建议 Node 24，在单机完成：

```sh
git clone --branch research/benchmark-heavy-ai-on https://github.com/springs59/FGO-Max-Bond-Team-Setup.git fgo-heavy
cd fgo-heavy
git worktree add --detach ../teacher-200 6320a8ffd31c444fbc76a64e14e576f759e1de1c
git worktree add --detach ../fgo-211 d68e41da5d2b0a145100b6fff5827ccca0dac78c
npm ci
node scripts/benchmark-heavy-ai-on.mjs
node scripts/summarize-heavy-ai-on.mjs
```

目录不同可设置 `FGO_HEAVY_200`、`FGO_HEAVY_211`。源版本工作区必须干净；运行前记录基准 Git 提交。不要按秒设置外部终止器，不要同时启动多个测量进程。旧 `FGO_BENCH_TIMEOUT_MS` 不影响本脚本。

一个版本/测量层使用一个独立 Worker，四个 Worker 均按相同小条件预热完才测量。每 Worker 的 V8 老生代上限 1024 MiB，不是进程 RSS 上限。最大 heap 是查询结束时观察值，不是过程峰值；RSS 在同一 Node 进程共享，不能按版本直接对比。

逐查询记录位于忽略的 data/，完整文件约 0.37 MiB。每十个完成条件保存一份有界完整检查点，无逐候选或逐节点日志。最终从内存记录一次构造完整文件并原子发布，再由独立汇总进程检查条数、唯一输入与摘要，不读取追加日志拼接最终成绩。不会将搜索树展开为临时文件。

独占锁用于阻止重叠测试。若进程意外终止，先确认进程退出，保留中断记录再处理遗留锁。不要把不完整记录计作超时最优、不可行证明或完整成绩。摘要见 integrity.json；原始数据不上传，新环境按生成器和索引重建。平台、系统负载和 JIT 会影响耗时，不承诺跨机器数字相同。

新标签页接续：

> 继续 springs59/FGO-Max-Bond-Team-Setup 的 research/benchmark-heavy-ai-on，先读 experiments/ai-heavy-comparison/README.md、RESULTS.md、summary.json 和 plan.json。已完成 160 条条件、960 次不限时测量，2.1.1 强制开启自带 AI，未加载 v3。核心基本持平，Worker 组约少耗时 22.4%，仍有核心退化条件。只上传方法和汇总，不上传逐查询记录。不要将 Node 结果当作 APK 实机测量，不要把全部版本差异归因 AI。正式源码、默认模型、main、Pages 与暂停的预计算均未改动。
