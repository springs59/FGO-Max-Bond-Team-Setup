# 当前合并版与历史优势版本：统一三小时对照

状态：complete-with-explicit-version-differences。完整收到 255/255 个同机配对分组。

- 固定当前代码：`23e50c082636f58f1acba9179880b9617d054a03`；上一版逐队代码：`a1dc0437238a56473f529ffec269132ed544f92b`。
- 18种版本/模式 × 15种条件，共270种独立组合；含重复参照及复测实际运行1190次。
- 每个查询最多三小时；排队、启动、独立结果校验分别记录。内存按主机/cgroup分配，两个进程各最多6 GiB，不再使用768 MiB压力上限。
- 低于30秒完成的小规模配对复测三轮，并交换CPU核心；压力和中等账号用例每格一次。不同主机绝对耗时不混排。
- 代表解查询、逐队保留同分、可恢复等效合并分开解释；同分数量的单位不可混用。

工作流：https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39730840377

## 各版本完成情况

| 版本/模式 | 配对完成 | 本模式超时 | 当前需求覆盖 |
|---|---:|---:|---|
| 2.0.0原版 | 13/15 | 0 | 原生代表队伍 |
| 2.1.2 | 13/15 | 0 | 原生代表队伍 |
| 早期区间剪枝版 | 13/15 | 0 | 原生代表队伍 |
| 2.1.3框架版 | 13/15 | 0 | 原生代表队伍 |
| 2.1.6发布版 | 13/15 | 0 | 原生代表队伍 |
| 上一版原生代表解／关闭AI | 13/15 | 0 | 原生代表队伍 |
| 上一版逐队同分／关闭AI | 12/15 | 3 | 全部最高分可恢复 |
| 上一版原生代表解／经典高起点AI | 13/15 | 0 | 原生代表队伍 |
| 上一版逐队同分／经典高起点AI | 12/15 | 3 | 全部最高分可恢复 |
| 当前等效合并／经典高起点AI | 13/15 | 2 | 全部最高分可恢复 |
| 上一版原生代表解／扩展策略AI | 13/15 | 0 | 原生代表队伍 |
| 上一版逐队同分／扩展策略AI | 12/15 | 3 | 全部最高分可恢复 |
| 当前等效合并／扩展策略AI | 13/15 | 2 | 全部最高分可恢复 |
| 上一版原生代表解／大数据神经AI | 13/15 | 0 | 原生代表队伍 |
| 上一版逐队同分／大数据神经AI | 12/15 | 3 | 全部最高分可恢复 |
| 当前等效合并／大数据神经AI | 13/15 | 2 | 全部最高分可恢复 |
| 当前合并关闭分数剪枝（归因对照） | 13/15 | 2 | 全部最高分可恢复 |

## 每个条件的同机耗时与分数

比值为“被测版本耗时÷当前关闭AI合并版耗时”。仅双方完成且分数相同才给比值；原生代表解即使给出观察比值，也不归入同等输出工作量排名。

| 条件 | 版本/模式 | 被测状态/分数 | 当前状态/分数 | 被测秒 | 当前秒 | 比值 | 被测峰值MiB |
|---|---|---|---|---:|---:|---:|---:|
| conditional | 2.0.0原版 | complete/4,318 | complete/4,318 | 0.04 | 0.05 | 0.97 | 67.51 |
| conditional | 2.1.2 | complete/4,318 | complete/4,318 | 0.04 | 0.04 | 1.03 | 67.41 |
| conditional | 早期区间剪枝版 | complete/4,318 | complete/4,318 | 0.03 | 0.03 | 1.05 | 70.95 |
| conditional | 2.1.3框架版 | complete/4,318 | complete/4,318 | 0.05 | 0.04 | 1.07 | 70.55 |
| conditional | 2.1.6发布版 | complete/4,318 | complete/4,318 | 0.05 | 0.04 | 1.09 | 71.11 |
| conditional | 上一版原生代表解／关闭AI | complete/4,318 | complete/4,318 | 0.05 | 0.04 | 1.05 | 71.11 |
| conditional | 上一版逐队同分／关闭AI | complete/4,318 | complete/4,318 | 0.07 | 0.03 | 2.28 | 74.8 |
| conditional | 上一版原生代表解／经典高起点AI | complete/4,318 | complete/4,318 | 0.05 | 0.05 | 1.09 | 68.36 |
| conditional | 上一版逐队同分／经典高起点AI | complete/4,318 | complete/4,318 | 0.09 | 0.04 | 2.36 | 75.28 |
| conditional | 当前等效合并／经典高起点AI | complete/4,318 | complete/4,318 | 0.03 | 0.02 | 1.41 | 75.83 |
| conditional | 上一版原生代表解／扩展策略AI | complete/4,318 | complete/4,318 | 0.05 | 0.04 | 1.11 | 71.36 |
| conditional | 上一版逐队同分／扩展策略AI | complete/4,318 | complete/4,318 | 0.11 | 0.04 | 2.37 | 78.09 |
| conditional | 当前等效合并／扩展策略AI | complete/4,318 | complete/4,318 | 0.06 | 0.03 | 2.29 | 73.12 |
| conditional | 上一版原生代表解／大数据神经AI | complete/4,318 | complete/4,318 | 0.05 | 0.04 | 1.16 | 69.65 |
| conditional | 上一版逐队同分／大数据神经AI | complete/4,318 | complete/4,318 | 0.08 | 0.03 | 2.38 | 78.61 |
| conditional | 当前等效合并／大数据神经AI | complete/4,318 | complete/4,318 | 0.06 | 0.04 | 1.4 | 76.18 |
| conditional | 当前合并关闭分数剪枝（归因对照） | complete/4,318 | complete/4,318 | 0.05 | 0.04 | 1.35 | 76.79 |
| self-flat | 2.0.0原版 | complete/606 | complete/606 | 0.03 | 0.44 | 0.07 | 68.93 |
| self-flat | 2.1.2 | complete/606 | complete/606 | 0.03 | 0.44 | 0.08 | 68.75 |
| self-flat | 早期区间剪枝版 | complete/606 | complete/606 | 0.04 | 0.46 | 0.08 | 69.02 |
| self-flat | 2.1.3框架版 | complete/606 | complete/606 | 0.03 | 0.37 | 0.08 | 69.09 |
| self-flat | 2.1.6发布版 | complete/606 | complete/606 | 0.03 | 0.33 | 0.08 | 69.28 |
| self-flat | 上一版原生代表解／关闭AI | complete/606 | complete/606 | 0.02 | 0.32 | 0.07 | 69.59 |
| self-flat | 上一版逐队同分／关闭AI | complete/606 | complete/606 | 0.29 | 0.32 | 0.9 | 101.68 |
| self-flat | 上一版原生代表解／经典高起点AI | complete/606 | complete/606 | 0.02 | 0.28 | 0.07 | 69.63 |
| self-flat | 上一版逐队同分／经典高起点AI | complete/606 | complete/606 | 0.32 | 0.36 | 0.89 | 100.93 |
| self-flat | 当前等效合并／经典高起点AI | complete/606 | complete/606 | 0.43 | 0.43 | 1.01 | 98.85 |
| self-flat | 上一版原生代表解／扩展策略AI | complete/606 | complete/606 | 0.05 | 0.41 | 0.11 | 72.53 |
| self-flat | 上一版逐队同分／扩展策略AI | complete/606 | complete/606 | 0.43 | 0.46 | 0.95 | 94.81 |
| self-flat | 当前等效合并／扩展策略AI | complete/606 | complete/606 | 0.45 | 0.44 | 1.08 | 105.66 |
| self-flat | 上一版原生代表解／大数据神经AI | complete/606 | complete/606 | 0.03 | 0.4 | 0.08 | 72.71 |
| self-flat | 上一版逐队同分／大数据神经AI | complete/606 | complete/606 | 0.4 | 0.4 | 1.01 | 98.92 |
| self-flat | 当前等效合并／大数据神经AI | complete/606 | complete/606 | 0.42 | 0.42 | 1 | 102.21 |
| self-flat | 当前合并关闭分数剪枝（归因对照） | complete/606 | complete/606 | 1.11 | 0.42 | 2.71 | 120.84 |
| six-own | 2.0.0原版 | complete/5,379 | complete/5,379 | 0.03 | 0.04 | 0.75 | 66.82 |
| six-own | 2.1.2 | complete/5,379 | complete/5,379 | 0.01 | 0.02 | 0.78 | 70.36 |
| six-own | 早期区间剪枝版 | complete/5,379 | complete/5,379 | 0.03 | 0.03 | 0.99 | 67.14 |
| six-own | 2.1.3框架版 | complete/5,379 | complete/5,379 | 0.03 | 0.03 | 0.81 | 70.7 |
| six-own | 2.1.6发布版 | complete/5,379 | complete/5,379 | 0.02 | 0.03 | 0.77 | 70.68 |
| six-own | 上一版原生代表解／关闭AI | complete/5,379 | complete/5,379 | 0.03 | 0.04 | 0.74 | 70.8 |
| six-own | 上一版逐队同分／关闭AI | complete/5,379 | complete/5,379 | 6.58 | 0.04 | 179.68 | 304.16 |
| six-own | 上一版原生代表解／经典高起点AI | complete/5,379 | complete/5,379 | 0.03 | 0.04 | 0.79 | 67.56 |
| six-own | 上一版逐队同分／经典高起点AI | complete/5,379 | complete/5,379 | 6.5 | 0.04 | 182.38 | 306.81 |
| six-own | 当前等效合并／经典高起点AI | complete/5,379 | complete/5,379 | 0.03 | 0.02 | 1.32 | 65.73 |
| six-own | 上一版原生代表解／扩展策略AI | complete/5,379 | complete/5,379 | 0.02 | 0.03 | 0.81 | 67.92 |
| six-own | 上一版逐队同分／扩展策略AI | complete/5,379 | complete/5,379 | 6.34 | 0.04 | 176.76 | 305.13 |
| six-own | 当前等效合并／扩展策略AI | complete/5,379 | complete/5,379 | 0.03 | 0.02 | 1.41 | 66.08 |
| six-own | 上一版原生代表解／大数据神经AI | complete/5,379 | complete/5,379 | 0.03 | 0.04 | 0.8 | 70.74 |
| six-own | 上一版逐队同分／大数据神经AI | complete/5,379 | complete/5,379 | 4.49 | 0.02 | 196.45 | 306.6 |
| six-own | 当前等效合并／大数据神经AI | complete/5,379 | complete/5,379 | 0.05 | 0.03 | 1.41 | 68.7 |
| six-own | 当前合并关闭分数剪枝（归因对照） | complete/5,379 | complete/5,379 | 0.02 | 0.02 | 1.29 | 69.82 |
| prefer | 2.0.0原版 | complete/3,422 | complete/3,422 | 0.02 | 0.02 | 0.91 | 66.19 |
| prefer | 2.1.2 | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.95 | 66.51 |
| prefer | 早期区间剪枝版 | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.87 | 69.96 |
| prefer | 2.1.3框架版 | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.93 | 66.78 |
| prefer | 2.1.6发布版 | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.97 | 70.38 |
| prefer | 上一版原生代表解／关闭AI | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.96 | 69.92 |
| prefer | 上一版逐队同分／关闭AI | complete/3,422 | complete/3,422 | 0.04 | 0.02 | 2.1 | 77.66 |
| prefer | 上一版原生代表解／经典高起点AI | complete/3,422 | complete/3,422 | 0.04 | 0.03 | 1.4 | 67.25 |
| prefer | 上一版逐队同分／经典高起点AI | complete/3,422 | complete/3,422 | 0.04 | 0.02 | 2.12 | 77.39 |
| prefer | 当前等效合并／经典高起点AI | complete/3,422 | complete/3,422 | 0.04 | 0.03 | 1.48 | 75.71 |
| prefer | 上一版原生代表解／扩展策略AI | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.77 | 66.75 |
| prefer | 上一版逐队同分／扩展策略AI | complete/3,422 | complete/3,422 | 0.05 | 0.02 | 2.25 | 74.01 |
| prefer | 当前等效合并／扩展策略AI | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 0.98 | 75.61 |
| prefer | 上一版原生代表解／大数据神经AI | complete/3,422 | complete/3,422 | 0.03 | 0.03 | 1.05 | 67.65 |
| prefer | 上一版逐队同分／大数据神经AI | complete/3,422 | complete/3,422 | 0.06 | 0.04 | 1.62 | 77 |
| prefer | 当前等效合并／大数据神经AI | complete/3,422 | complete/3,422 | 0.02 | 0.02 | 1 | 72.42 |
| prefer | 当前合并关闭分数剪枝（归因对照） | complete/3,422 | complete/3,422 | 0.03 | 0.04 | 0.73 | 72.49 |
| pins-stock-aura | 2.0.0原版 | complete/4,432 | complete/4,570 | 0.02 | 0.02 | — | 66.47 |
| pins-stock-aura | 2.1.2 | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 69.5 |
| pins-stock-aura | 早期区间剪枝版 | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 70.07 |
| pins-stock-aura | 2.1.3框架版 | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 70.26 |
| pins-stock-aura | 2.1.6发布版 | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 70.32 |
| pins-stock-aura | 上一版原生代表解／关闭AI | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 66.56 |
| pins-stock-aura | 上一版逐队同分／关闭AI | complete/4,570 | complete/4,570 | 0.05 | 0.04 | 1.22 | 73.11 |
| pins-stock-aura | 上一版原生代表解／经典高起点AI | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 67.25 |
| pins-stock-aura | 上一版逐队同分／经典高起点AI | complete/4,570 | complete/4,570 | 0.03 | 0.02 | 1.19 | 70.45 |
| pins-stock-aura | 当前等效合并／经典高起点AI | complete/4,570 | complete/4,570 | 0.03 | 0.04 | 0.99 | 68.31 |
| pins-stock-aura | 上一版原生代表解／扩展策略AI | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 67.52 |
| pins-stock-aura | 上一版逐队同分／扩展策略AI | complete/4,570 | complete/4,570 | 0.05 | 0.04 | 1.27 | 74.36 |
| pins-stock-aura | 当前等效合并／扩展策略AI | complete/4,570 | complete/4,570 | 0.03 | 0.03 | 1.02 | 71.96 |
| pins-stock-aura | 上一版原生代表解／大数据神经AI | complete/4,432 | complete/4,570 | 0.04 | 0.04 | — | 67.36 |
| pins-stock-aura | 上一版逐队同分／大数据神经AI | complete/4,570 | complete/4,570 | 0.03 | 0.02 | 1.21 | 70.56 |
| pins-stock-aura | 当前等效合并／大数据神经AI | complete/4,570 | complete/4,570 | 0.04 | 0.04 | 1 | 71.86 |
| pins-stock-aura | 当前合并关闭分数剪枝（归因对照） | complete/4,570 | complete/4,570 | 0.03 | 0.03 | 1.12 | 67.75 |
| active-event | 2.0.0原版 | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 0.91 | 67.22 |
| active-event | 2.1.2 | complete/4,848 | complete/4,848 | 0.02 | 0.01 | 1.11 | 70.56 |
| active-event | 早期区间剪枝版 | complete/4,848 | complete/4,848 | 0.02 | 0.02 | 1.01 | 70.33 |
| active-event | 2.1.3框架版 | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 1.03 | 70.11 |
| active-event | 2.1.6发布版 | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 1.1 | 70.82 |
| active-event | 上一版原生代表解／关闭AI | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 1 | 67.51 |
| active-event | 上一版逐队同分／关闭AI | complete/4,848 | complete/4,848 | 0.07 | 0.03 | 2.41 | 74.94 |
| active-event | 上一版原生代表解／经典高起点AI | complete/4,848 | complete/4,848 | 0.02 | 0.01 | 1.06 | 71.13 |
| active-event | 上一版逐队同分／经典高起点AI | complete/4,848 | complete/4,848 | 0.08 | 0.03 | 2.73 | 75.31 |
| active-event | 当前等效合并／经典高起点AI | complete/4,848 | complete/4,848 | 0.03 | 0.02 | 1.46 | 74.62 |
| active-event | 上一版原生代表解／扩展策略AI | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 1.05 | 67.78 |
| active-event | 上一版逐队同分／扩展策略AI | complete/4,848 | complete/4,848 | 0.08 | 0.03 | 2.75 | 78.24 |
| active-event | 当前等效合并／扩展策略AI | complete/4,848 | complete/4,848 | 0.04 | 0.03 | 1.46 | 76.95 |
| active-event | 上一版原生代表解／大数据神经AI | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 1.11 | 68.16 |
| active-event | 上一版逐队同分／大数据神经AI | complete/4,848 | complete/4,848 | 0.07 | 0.03 | 2.81 | 75.15 |
| active-event | 当前等效合并／大数据神经AI | complete/4,848 | complete/4,848 | 0.04 | 0.03 | 1.44 | 74.26 |
| active-event | 当前合并关闭分数剪枝（归因对照） | complete/4,848 | complete/4,848 | 0.03 | 0.03 | 1.13 | 76.7 |
| grand | 2.0.0原版 | complete/2,150 | complete/2,150 | 0.03 | 0.06 | 0.51 | 66.36 |
| grand | 2.1.2 | complete/2,150 | complete/2,150 | 0.02 | 0.04 | 0.53 | 66.2 |
| grand | 早期区间剪枝版 | complete/2,150 | complete/2,150 | 0.02 | 0.04 | 0.51 | 69.74 |
| grand | 2.1.3框架版 | complete/2,150 | complete/2,150 | 0.03 | 0.06 | 0.6 | 70.09 |
| grand | 2.1.6发布版 | complete/2,150 | complete/2,150 | 0.04 | 0.07 | 0.51 | 69.91 |
| grand | 上一版原生代表解／关闭AI | complete/2,150 | complete/2,150 | 0.03 | 0.06 | 0.53 | 66.86 |
| grand | 上一版逐队同分／关闭AI | complete/2,150 | complete/2,150 | 0.05 | 0.06 | 0.85 | 74.9 |
| grand | 上一版原生代表解／经典高起点AI | complete/2,150 | complete/2,150 | 0.03 | 0.06 | 0.5 | 70.05 |
| grand | 上一版逐队同分／经典高起点AI | complete/2,150 | complete/2,150 | 0.05 | 0.06 | 0.79 | 75.34 |
| grand | 当前等效合并／经典高起点AI | complete/2,150 | complete/2,150 | 0.06 | 0.05 | 0.99 | 71.77 |
| grand | 上一版原生代表解／扩展策略AI | complete/2,150 | complete/2,150 | 0.02 | 0.03 | 0.51 | 66.45 |
| grand | 上一版逐队同分／扩展策略AI | complete/2,150 | complete/2,150 | 0.04 | 0.04 | 0.78 | 71.72 |
| grand | 当前等效合并／扩展策略AI | complete/2,150 | complete/2,150 | 0.06 | 0.06 | 1 | 71.7 |
| grand | 上一版原生代表解／大数据神经AI | complete/2,150 | complete/2,150 | 0.02 | 0.04 | 0.57 | 69.67 |
| grand | 上一版逐队同分／大数据神经AI | complete/2,150 | complete/2,150 | 0.04 | 0.05 | 0.84 | 75.35 |
| grand | 当前等效合并／大数据神经AI | complete/2,150 | complete/2,150 | 0.05 | 0.06 | 0.98 | 71.16 |
| grand | 当前合并关闭分数剪枝（归因对照） | complete/2,150 | complete/2,150 | 0.06 | 0.06 | 1 | 70.52 |
| fixed-npc | 2.0.0原版 | complete/1,565 | complete/1,565 | 0.01 | 0.01 | 1.02 | 66.02 |
| fixed-npc | 2.1.2 | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.12 | 69.81 |
| fixed-npc | 早期区间剪枝版 | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.08 | 66.42 |
| fixed-npc | 2.1.3框架版 | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.07 | 66.45 |
| fixed-npc | 2.1.6发布版 | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.02 | 69.62 |
| fixed-npc | 上一版原生代表解／关闭AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.05 | 69.76 |
| fixed-npc | 上一版逐队同分／关闭AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.15 | 69.46 |
| fixed-npc | 上一版原生代表解／经典高起点AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.14 | 66.61 |
| fixed-npc | 上一版逐队同分／经典高起点AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.02 | 66.79 |
| fixed-npc | 当前等效合并／经典高起点AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.04 | 64.52 |
| fixed-npc | 上一版原生代表解／扩展策略AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.2 | 70.35 |
| fixed-npc | 上一版逐队同分／扩展策略AI | complete/1,565 | complete/1,565 | 0.01 | 0.01 | 1.09 | 69.99 |
| fixed-npc | 当前等效合并／扩展策略AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1 | 64.34 |
| fixed-npc | 上一版原生代表解／大数据神经AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.14 | 66.46 |
| fixed-npc | 上一版逐队同分／大数据神经AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.08 | 70.4 |
| fixed-npc | 当前等效合并／大数据神经AI | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 1.03 | 68.2 |
| fixed-npc | 当前合并关闭分数剪枝（归因对照） | complete/1,565 | complete/1,565 | 0.02 | 0.02 | 0.96 | 67.78 |
| CN-small | 2.0.0原版 | complete/2,346 | complete/2,424 | 0.43 | 0.55 | — | 99.28 |
| CN-small | 2.1.2 | complete/2,346 | complete/2,424 | 0.28 | 0.38 | — | 98.31 |
| CN-small | 早期区间剪枝版 | complete/2,346 | complete/2,424 | 0.43 | 0.54 | — | 98.08 |
| CN-small | 2.1.3框架版 | complete/2,346 | complete/2,424 | 0.34 | 0.44 | — | 99.19 |
| CN-small | 2.1.6发布版 | complete/2,346 | complete/2,424 | 0.41 | 0.53 | — | 99.39 |
| CN-small | 上一版原生代表解／关闭AI | complete/2,346 | complete/2,424 | 0.44 | 0.56 | — | 98.5 |
| CN-small | 上一版逐队同分／关闭AI | complete/2,424 | complete/2,424 | 1.73 | 0.58 | 2.96 | 122.18 |
| CN-small | 上一版原生代表解／经典高起点AI | complete/2,346 | complete/2,424 | 0.27 | 0.34 | — | 118.13 |
| CN-small | 上一版逐队同分／经典高起点AI | complete/2,424 | complete/2,424 | 1.77 | 0.61 | 2.9 | 122.21 |
| CN-small | 当前等效合并／经典高起点AI | complete/2,424 | complete/2,424 | 0.35 | 0.34 | 1.01 | 97.26 |
| CN-small | 上一版原生代表解／扩展策略AI | complete/2,346 | complete/2,424 | 0.43 | 0.56 | — | 94.61 |
| CN-small | 上一版逐队同分／扩展策略AI | complete/2,424 | complete/2,424 | 1.66 | 0.6 | 2.79 | 121.54 |
| CN-small | 当前等效合并／扩展策略AI | complete/2,424 | complete/2,424 | 0.59 | 0.59 | 1.01 | 99.05 |
| CN-small | 上一版原生代表解／大数据神经AI | complete/2,346 | complete/2,424 | 0.44 | 0.55 | — | 97.91 |
| CN-small | 上一版逐队同分／大数据神经AI | complete/2,424 | complete/2,424 | 0.91 | 0.33 | 2.72 | 119.67 |
| CN-small | 当前等效合并／大数据神经AI | complete/2,424 | complete/2,424 | 0.61 | 0.59 | 1.02 | 95.72 |
| CN-small | 当前合并关闭分数剪枝（归因对照） | complete/2,424 | complete/2,424 | 0.62 | 0.6 | 1.04 | 99.32 |
| JP-small | 2.0.0原版 | complete/2,346 | complete/2,424 | 0.18 | 0.24 | — | 101.73 |
| JP-small | 2.1.2 | complete/2,346 | complete/2,424 | 0.3 | 0.43 | — | 101.59 |
| JP-small | 早期区间剪枝版 | complete/2,346 | complete/2,424 | 0.46 | 0.41 | — | 104.49 |
| JP-small | 2.1.3框架版 | complete/2,346 | complete/2,424 | 0.19 | 0.27 | — | 100.4 |
| JP-small | 2.1.6发布版 | complete/2,346 | complete/2,424 | 0.23 | 0.32 | — | 100.37 |
| JP-small | 上一版原生代表解／关闭AI | complete/2,346 | complete/2,424 | 0.23 | 0.33 | — | 101.81 |
| JP-small | 上一版逐队同分／关闭AI | complete/2,424 | complete/2,424 | 0.95 | 0.29 | 3.31 | 127.69 |
| JP-small | 上一版原生代表解／经典高起点AI | complete/2,346 | complete/2,424 | 0.3 | 0.41 | — | 100.78 |
| JP-small | 上一版逐队同分／经典高起点AI | complete/2,424 | complete/2,424 | 1.4 | 0.38 | 3.72 | 128.34 |
| JP-small | 当前等效合并／经典高起点AI | complete/2,424 | complete/2,424 | 0.41 | 0.4 | 1.03 | 122.89 |
| JP-small | 上一版原生代表解／扩展策略AI | complete/2,346 | complete/2,424 | 0.24 | 0.33 | — | 103.98 |
| JP-small | 上一版逐队同分／扩展策略AI | complete/2,424 | complete/2,424 | 1.58 | 0.39 | 4.05 | 129.8 |
| JP-small | 当前等效合并／扩展策略AI | complete/2,424 | complete/2,424 | 0.4 | 0.39 | 1.08 | 121.56 |
| JP-small | 上一版原生代表解／大数据神经AI | complete/2,346 | complete/2,424 | 0.18 | 0.25 | — | 101.93 |
| JP-small | 上一版逐队同分／大数据神经AI | complete/2,424 | complete/2,424 | 1.53 | 0.42 | 3.81 | 128.38 |
| JP-small | 当前等效合并／大数据神经AI | complete/2,424 | complete/2,424 | 0.44 | 0.43 | 1.02 | 120.91 |
| JP-small | 当前合并关闭分数剪枝（归因对照） | complete/2,424 | complete/2,424 | 0.43 | 0.41 | 1.03 | 120.9 |
| CN-medium | 2.0.0原版 | complete/2,346 | complete/2,346 | 0.44 | 0.59 | 0.74 | 92.86 |
| CN-medium | 2.1.2 | complete/2,346 | complete/2,346 | 0.32 | 0.45 | 0.72 | 95.91 |
| CN-medium | 早期区间剪枝版 | complete/2,346 | complete/2,346 | 0.44 | 0.6 | 0.74 | 94.66 |
| CN-medium | 2.1.3框架版 | complete/2,346 | complete/2,346 | 0.48 | 0.63 | 0.76 | 93.51 |
| CN-medium | 2.1.6发布版 | complete/2,346 | complete/2,346 | 0.43 | 0.58 | 0.73 | 97.39 |
| CN-medium | 上一版原生代表解／关闭AI | complete/2,346 | complete/2,346 | 0.29 | 0.39 | 0.74 | 97.88 |
| CN-medium | 上一版逐队同分／关闭AI | complete/2,346 | complete/2,346 | 37.8 | 0.66 | 57.68 | 233.35 |
| CN-medium | 上一版原生代表解／经典高起点AI | complete/2,346 | complete/2,346 | 0.45 | 0.61 | 0.74 | 94.65 |
| CN-medium | 上一版逐队同分／经典高起点AI | complete/2,346 | complete/2,346 | 38.5 | 0.69 | 56.16 | 235.01 |
| CN-medium | 当前等效合并／经典高起点AI | complete/2,346 | complete/2,346 | 0.6 | 0.58 | 1.04 | 185.24 |
| CN-medium | 上一版原生代表解／扩展策略AI | complete/2,346 | complete/2,346 | 0.33 | 0.46 | 0.72 | 94.31 |
| CN-medium | 上一版逐队同分／扩展策略AI | complete/2,346 | complete/2,346 | 31.05 | 0.49 | 62.97 | 229.21 |
| CN-medium | 当前等效合并／扩展策略AI | complete/2,346 | complete/2,346 | 0.66 | 0.6 | 1.09 | 185.11 |
| CN-medium | 上一版原生代表解／大数据神经AI | complete/2,346 | complete/2,346 | 0.44 | 0.6 | 0.72 | 96.35 |
| CN-medium | 上一版逐队同分／大数据神经AI | complete/2,346 | complete/2,346 | 38.86 | 0.65 | 60.12 | 230.93 |
| CN-medium | 当前等效合并／大数据神经AI | complete/2,346 | complete/2,346 | 0.6 | 0.57 | 1.05 | 185.93 |
| CN-medium | 当前合并关闭分数剪枝（归因对照） | complete/2,346 | complete/2,346 | 0.65 | 0.68 | 0.96 | 184.44 |
| JP-medium | 2.0.0原版 | complete/2,346 | complete/2,346 | 0.4 | 0.49 | 0.82 | 104.91 |
| JP-medium | 2.1.2 | complete/2,346 | complete/2,346 | 0.21 | 0.32 | 0.67 | 101.11 |
| JP-medium | 早期区间剪枝版 | complete/2,346 | complete/2,346 | 0.35 | 0.46 | 0.77 | 104.58 |
| JP-medium | 2.1.3框架版 | complete/2,346 | complete/2,346 | 0.24 | 0.37 | 0.64 | 102.65 |
| JP-medium | 2.1.6发布版 | complete/2,346 | complete/2,346 | 0.25 | 0.38 | 0.66 | 101.91 |
| JP-medium | 上一版原生代表解／关闭AI | complete/2,346 | complete/2,346 | 0.29 | 0.49 | 0.58 | 102.81 |
| JP-medium | 上一版逐队同分／关闭AI | complete/2,346 | complete/2,346 | 22.86 | 0.35 | 65.02 | 277.38 |
| JP-medium | 上一版原生代表解／经典高起点AI | complete/2,346 | complete/2,346 | 0.31 | 0.51 | 0.61 | 105.88 |
| JP-medium | 上一版逐队同分／经典高起点AI | complete/2,346 | complete/2,346 | 43.17 | 0.53 | 81.03 | 276.06 |
| JP-medium | 当前等效合并／经典高起点AI | complete/2,346 | complete/2,346 | 0.41 | 0.36 | 1.14 | 319.11 |
| JP-medium | 上一版原生代表解／扩展策略AI | complete/2,346 | complete/2,346 | 0.3 | 0.37 | 0.81 | 104.6 |
| JP-medium | 上一版逐队同分／扩展策略AI | complete/2,346 | complete/2,346 | 23.09 | 0.31 | 75.51 | 275.86 |
| JP-medium | 当前等效合并／扩展策略AI | complete/2,346 | complete/2,346 | 0.46 | 0.46 | 1 | 319.61 |
| JP-medium | 上一版原生代表解／大数据神经AI | complete/2,346 | complete/2,346 | 0.32 | 0.59 | 0.54 | 106.75 |
| JP-medium | 上一版逐队同分／大数据神经AI | complete/2,346 | complete/2,346 | 44.12 | 0.49 | 89.87 | 275.23 |
| JP-medium | 当前等效合并／大数据神经AI | complete/2,346 | complete/2,346 | 0.35 | 0.28 | 1.23 | 314.62 |
| JP-medium | 当前合并关闭分数剪枝（归因对照） | complete/2,346 | complete/2,346 | 0.45 | 0.48 | 0.94 | 317 |
| CN-open | 2.0.0原版 | complete/7,593 | timeout/7,582 | 1,194 | >=10,800 | — | 4,123.2 |
| CN-open | 2.1.2 | complete/7,593 | timeout/7,582 | 1,236.7 | >=10,800 | — | 4,330.96 |
| CN-open | 早期区间剪枝版 | complete/7,593 | timeout/7,582 | 2,385.54 | >=10,800 | — | 4,376.01 |
| CN-open | 2.1.3框架版 | complete/7,593 | timeout/7,582 | 2,364.13 | >=10,800 | — | 4,389.8 |
| CN-open | 2.1.6发布版 | complete/7,593 | timeout/7,582 | 2,174.12 | >=10,800 | — | 4,129.28 |
| CN-open | 上一版原生代表解／关闭AI | complete/7,593 | timeout/7,582 | 2,261.1 | >=10,800 | — | 4,122.61 |
| CN-open | 上一版逐队同分／关闭AI | timeout/7,549 | timeout/7,582 | >=10,800 | >=10,800 | — | 303.85 |
| CN-open | 上一版原生代表解／经典高起点AI | complete/7,593 | timeout/7,582 | 1,879.63 | >=10,800 | — | 4,478.55 |
| CN-open | 上一版逐队同分／经典高起点AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 610.35 |
| CN-open | 当前等效合并／经典高起点AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 379.87 |
| CN-open | 上一版原生代表解／扩展策略AI | complete/7,593 | timeout/7,582 | 1,487.88 | >=10,800 | — | 3,974.6 |
| CN-open | 上一版逐队同分／扩展策略AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 607.25 |
| CN-open | 当前等效合并／扩展策略AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 392.16 |
| CN-open | 上一版原生代表解／大数据神经AI | complete/7,593 | timeout/7,582 | 424.74 | >=10,800 | — | 1,316.38 |
| CN-open | 上一版逐队同分／大数据神经AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 423.05 |
| CN-open | 当前等效合并／大数据神经AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 427.84 |
| CN-open | 当前合并关闭分数剪枝（归因对照） | timeout/7,582 | timeout/7,582 | >=10,800 | >=10,800 | — | 374.43 |
| JP-open | 2.0.0原版 | complete/7,593 | timeout/7,582 | 2,370.21 | >=10,800 | — | 4,748.09 |
| JP-open | 2.1.2 | complete/7,593 | timeout/7,582 | 1,411.12 | >=10,800 | — | 4,608 |
| JP-open | 早期区间剪枝版 | complete/7,593 | timeout/7,582 | 2,181.25 | >=10,800 | — | 4,612.7 |
| JP-open | 2.1.3框架版 | complete/7,593 | timeout/7,582 | 1,374.26 | >=10,800 | — | 4,630.28 |
| JP-open | 2.1.6发布版 | complete/7,593 | timeout/7,582 | 34.38 | >=10,800 | — | 447.39 |
| JP-open | 上一版原生代表解／关闭AI | complete/7,593 | timeout/7,582 | 2,480.36 | >=10,800 | — | 4,760.14 |
| JP-open | 上一版逐队同分／关闭AI | timeout/7,523 | timeout/7,582 | >=10,800 | >=10,800 | — | 378.59 |
| JP-open | 上一版原生代表解／经典高起点AI | complete/7,593 | timeout/7,582 | 33.88 | >=10,800 | — | 476.61 |
| JP-open | 上一版逐队同分／经典高起点AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 698.98 |
| JP-open | 当前等效合并／经典高起点AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 435.44 |
| JP-open | 上一版原生代表解／扩展策略AI | complete/7,593 | timeout/7,582 | 1,239 | >=10,800 | — | 4,195.66 |
| JP-open | 上一版逐队同分／扩展策略AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 707.36 |
| JP-open | 当前等效合并／扩展策略AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 436.7 |
| JP-open | 上一版原生代表解／大数据神经AI | complete/7,593 | timeout/7,582 | 426.78 | >=10,800 | — | 2,134.79 |
| JP-open | 上一版逐队同分／大数据神经AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 708.08 |
| JP-open | 当前等效合并／大数据神经AI | timeout/7,593 | timeout/7,582 | >=10,800 | >=10,800 | — | 434.67 |
| JP-open | 当前合并关闭分数剪枝（归因对照） | timeout/7,549 | timeout/7,582 | >=10,800 | >=10,800 | — | 349.95 |
| dense-zero | 2.0.0原版 | complete/0 | complete/0 | 0.04 | 0.07 | 0.58 | 73.78 |
| dense-zero | 2.1.2 | complete/0 | complete/0 | 0.06 | 0.1 | 0.63 | 73.48 |
| dense-zero | 早期区间剪枝版 | complete/0 | complete/0 | 0.03 | 0.06 | 0.54 | 73.43 |
| dense-zero | 2.1.3框架版 | complete/0 | complete/0 | 0.06 | 0.1 | 0.63 | 70.76 |
| dense-zero | 2.1.6发布版 | complete/0 | complete/0 | 0.04 | 0.06 | 0.56 | 73.38 |
| dense-zero | 上一版原生代表解／关闭AI | complete/0 | complete/0 | 0.04 | 0.06 | 0.59 | 70.91 |
| dense-zero | 上一版逐队同分／关闭AI | timeout/0 | complete/0 | >=10,800 | 0.11 | — | 341.89 |
| dense-zero | 上一版原生代表解／经典高起点AI | complete/0 | complete/0 | 0.06 | 0.1 | 0.62 | 73.96 |
| dense-zero | 上一版逐队同分／经典高起点AI | timeout/0 | complete/0 | >=10,800 | 0.07 | — | 359.88 |
| dense-zero | 当前等效合并／经典高起点AI | complete/0 | complete/0 | 0.26 | 0.25 | 1.04 | 73.34 |
| dense-zero | 上一版原生代表解／扩展策略AI | complete/0 | complete/0 | 0.04 | 0.06 | 0.63 | 74.04 |
| dense-zero | 上一版逐队同分／扩展策略AI | timeout/0 | complete/0 | >=10,800 | 0.08 | — | 351.76 |
| dense-zero | 当前等效合并／扩展策略AI | complete/0 | complete/0 | 0.12 | 0.11 | 1.16 | 76.24 |
| dense-zero | 上一版原生代表解／大数据神经AI | complete/0 | complete/0 | 0.07 | 0.1 | 0.65 | 74.7 |
| dense-zero | 上一版逐队同分／大数据神经AI | timeout/0 | complete/0 | >=10,800 | 0.07 | — | 360.74 |
| dense-zero | 当前等效合并／大数据神经AI | complete/0 | complete/0 | 0.12 | 0.11 | 1.13 | 75.68 |
| dense-zero | 当前合并关闭分数剪枝（归因对照） | complete/0 | complete/0 | 0.07 | 0.06 | 1.19 | 73.3 |

## 真实 Worker、OPFS、导出与热缓存

这里使用同一当前应用切换合并开关，隔离表示与保存开销；不冒充历史版本旧界面的性能测试。各场景三轮冷 Worker，随后验证热缓存新增搜索与结算均为0。

| 场景 | 逐队冷响应ms | 合并冷响应ms | 逐队导出ms | 合并导出ms | 逐队导出字节 | 合并导出字节 |
|---|---:|---:|---:|---:|---:|---:|
| same-effects | 98.1 | 63.4 | 59.3 | 7.5 | 1,413,457 | 17,526 |
| zero-ties | 95.1 | 60.2 | 53.5 | 5.5 | 1,401,694 | 26,950 |
| self-fallback | 72.9 | 74.1 | 14.9 | 14.6 | 149,086 | 149,147 |

引擎倍数不能直接当成点击到显示结果的倍数；真实响应还包含 Worker 初始化、模块加载与结果保存等固定开销。

## 差距原因与证据

- **等效合并**：逐队版本与合并版使用相同冻结条件；比较搜索节点、实际结算数、输出记录数、形态/角色/礼装类别压缩。小域完整展开后的集合指纹另行核对，不靠只保留低 COST 或 Top-K 提速。
- **上界剪枝**：`group-no-bounds` 仅关闭当前版分数上界，其他代码、AI和数据一致；这是控制变量对照。
- **AI作用**：四种选择固定同一求解器，记录已验证起点、首次可行解及最后一次提高主目标之后的剩余时间。剩余时间包含证明、同分收集及摘要计算，不能全部称为验证开销。
- **特殊规则回退**：压缩目录全为 null 的条件未启用普通域合并；不把此类耗时差归因于压缩。
- **搜索范围/目标差异**：原生接口返回较低分，或主练/锁定目标定义不一致，分别列为版本差异。先看合法性和主目标，再谈速度。
- **实现与模型差异**：代码和权重各自固定提交与SHA256，原有DP/剪枝统计按版本原始定义记录。不能将不同算法的节点计数直接当同一种工作量。
- **内存与GC**：记录各进程相同堆上限、实际峰值和内存不足退出。OOM是运行异常，不视为三小时超时或成功。

## 每个配对的诊断记录

详见 [report.json](report.json) 的 `records[].diagnostics`、`caseEnvironment` 和各个 [原始分组](cells/)：包括起点、进展检查点、已验证分数、首次观测时间、最后一次主目标改善、节点、剪枝、结算次数、内存及指纹。

## 正确性、边界与回归

所有输出按冻结当前规则重新验证身份、形态、库存、COST、锁定、助战与羁绊结算。原生“运行完成”不自动等于当前完整解空间已证明最优；能与完整枚举/合并结果对齐时才标为交叉确认。

完整回归状态：passed。分组错漏、超时被误标完整、输入/源码不一致、已证明分数与更高可行解矛盾，均会使报告失败。

物理展开对照只用于独立校验，有显式预算。超过校验预算不再展开，也不宣称该域已通过完整物理指纹对照；这不会截断生产求解器的结果或解集。

单次压力结果可以说明本条件表现，不能证明一个模型或版本对所有账号普遍最快。

## 版本目标/搜索范围差异

- prefer / v200：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / v212：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / interval：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / v213：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / v216：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / native-off：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / native-baseline：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / native-teacher：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- prefer / native-neural-large：primary-objective-semantics；Preferred and locked identities are counted differently by this native interface. Current unified primary score is independently recalculated; do not rank incompatible objectives by runtime.
- pins-stock-aura / v200：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / v212：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / interval：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / v213：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / v216：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / native-off：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / native-baseline：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / native-teacher：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- pins-stock-aura / native-neural-large：lower-than-verified-feasible；返回分 4432，已验证可行分 4570。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / v200：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / v212：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / interval：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / v213：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / v216：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / native-off：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / native-baseline：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / native-teacher：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- CN-small / native-neural-large：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / v200：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / v212：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / interval：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / v213：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / v216：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / native-off：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / native-baseline：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / native-teacher：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
- JP-small / native-neural-large：lower-than-verified-feasible；返回分 2346，已验证可行分 2424。Native completion returned a lower primary score than another verified legal team on the same frozen input. Inspect search scope/objective support before claiming a speed win.
