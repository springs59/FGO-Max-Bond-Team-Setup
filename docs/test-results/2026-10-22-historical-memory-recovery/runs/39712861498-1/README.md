# 三小时统一测试：内存修正与压力补跑

状态：complete。原轮135种组合中121种完成，14种发生V8堆内存不足。失败仅涉及CN-open/JP-open；39个其他分组成功。原始失败记录完整保留。

原配置每进程768 MiB堆上限，四进程并发。补跑改为同机两个独立单核进程（一个版本与当前关闭AI锚点），依据实际物理内存和cgroup限制分配，16 GiB主机每进程最多6144 MiB，预留系统及额外内存。查询仍各自限时3小时，不修改求解器或模型。

保留117种其他条件结果，补跑18种压力版本组合。所有输入及求解器/模型指纹必须与原轮一致。排队时间、模块启动和原生查询耗时分别记录。

## 全部15条件的最终状态

| 版本 | 原生完成 | 三小时超时 | 内存不足 | 其他异常 |
|---|---:|---:|---:|---:|
| 2.0.0 原版 | 15 | 0 | 0 | 0 |
| 2.1.2 固定对照版 | 15 | 0 | 0 | 0 |
| 早期区间剪枝版 | 15 | 0 | 0 | 0 |
| 2.1.3 框架版 | 15 | 0 | 0 | 0 |
| 2.1.6 已发布版 | 15 | 0 | 0 | 0 |
| 当前版：关闭 AI | 15 | 0 | 0 | 0 |
| 当前版：经典高起点 AI | 15 | 0 | 0 | 0 |
| 当前版：扩展策略 AI | 15 | 0 | 0 | 0 |
| 当前版：大数据神经 AI | 15 | 0 | 0 | 0 |

“原生完成”是通过精确结算的代表解，不表示全部同分队伍完整。全部同分长跑39702948902继续单独报告。内存修正前后的耗时不混合做整体排名；补跑性能使用同机锚点比较。

## 原轮失败证据

| 条件 | 版本 | 退出前墙钟分钟 | 原因 |
|---|---|---:|---|
| CN-open | 2.0.0 原版 | 14.3 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 2.1.2 固定对照版 | 13.9 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 早期区间剪枝版 | 13.8 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 当前版：关闭 AI | 10.8 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 2.1.3 框架版 | 15.4 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 2.1.6 已发布版 | 15.5 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 当前版：经典高起点 AI | 9.6 | V8 heap out of memory，原堆上限768 MiB |
| CN-open | 当前版：扩展策略 AI | 10.1 | V8 heap out of memory，原堆上限768 MiB |
| JP-open | 2.0.0 原版 | 20.7 | V8 heap out of memory，原堆上限768 MiB |
| JP-open | 2.1.2 固定对照版 | 19.9 | V8 heap out of memory，原堆上限768 MiB |
| JP-open | 早期区间剪枝版 | 20.2 | V8 heap out of memory，原堆上限768 MiB |
| JP-open | 当前版：关闭 AI | 16.9 | V8 heap out of memory，原堆上限768 MiB |
| JP-open | 2.1.3 框架版 | 20.2 | V8 heap out of memory，原堆上限768 MiB |
| JP-open | 当前版：扩展策略 AI | 13.6 | V8 heap out of memory，原堆上限768 MiB |

## 核查与明细


- [补跑同机性能、最高分与内存明细](recovery-details.md)
- [合并后的135种组合](report.json)
- [原轮完整数值与失败记录](original-report.json)
- [补跑全部分组记录](cells/)
- [原始工作流](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39707712702)
