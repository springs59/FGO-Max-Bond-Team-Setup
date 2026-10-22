# 全部最高分配队：3小时限时全量重跑对比

状态：failed。每个查询最多3小时；超时结果仍未证明最优或同分完整。

- 工作流：https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39752378929
- 固定提交：`2506da80d700cfc3d0821d04f561f255daed510c`
- 同机短测：52格完成，8格超时。
- 3小时长测：51格完成，8格超时，1格异常或缺失。
- 完整回归：failed；长测引擎峰值RSS最高385.9MiB。

## 四种选择的总体结果

| 选择 | 短测完成 | 长测完成 | 长测超时 | 长测异常 |
|---|---:|---:|---:|---:|
| 关闭AI | 13 | 13 | 2 | 0 |
| 经典高起点AI | 13 | 13 | 2 | 0 |
| 扩展策略AI | 13 | 12 | 2 | 1 |
| 大数据神经AI | 13 | 13 | 2 | 0 |

## 每个条件的同机短测与长测

| 条件 | 选择 | 短测状态/当前分 | 长测状态/当前分 | 长测同分数 | 长测秒数 | 峰值MiB |
|---|---|---|---|---:|---:|---:|
| conditional | 关闭AI | complete/4,318 | complete/4,318 | 12 | 0.04 | 65.4 |
| conditional | 经典高起点AI | complete/4,318 | complete/4,318 | 12 | 0.05 | 65.7 |
| conditional | 扩展策略AI | complete/4,318 | complete/4,318 | 12 | 0.05 | 66.0 |
| conditional | 大数据神经AI | complete/4,318 | complete/4,318 | 12 | 0.05 | 65.8 |
| self-flat | 关闭AI | complete/606 | complete/606 | 5,832 | 0.70 | 82.1 |
| self-flat | 经典高起点AI | complete/606 | complete/606 | 5,832 | 0.68 | 80.6 |
| self-flat | 扩展策略AI | complete/606 | complete/606 | 5,832 | 0.68 | 82.8 |
| self-flat | 大数据神经AI | complete/606 | complete/606 | 5,832 | 0.71 | 82.6 |
| six-own | 关闭AI | complete/5,379 | complete/5,379 | 10 | 0.02 | 64.7 |
| six-own | 经典高起点AI | complete/5,379 | complete/5,379 | 10 | 0.02 | 65.6 |
| six-own | 扩展策略AI | complete/5,379 | complete/5,379 | 10 | 0.02 | 65.9 |
| six-own | 大数据神经AI | complete/5,379 | complete/5,379 | 10 | 0.02 | 65.8 |
| prefer | 关闭AI | complete/3,422 | complete/3,422 | 14 | 0.03 | 65.8 |
| prefer | 经典高起点AI | complete/3,422 | complete/3,422 | 14 | 0.03 | 65.8 |
| prefer | 扩展策略AI | complete/3,422 | complete/3,422 | 14 | 0.03 | 65.7 |
| prefer | 大数据神经AI | complete/3,422 | complete/3,422 | 14 | 0.03 | 65.5 |
| pins-stock-aura | 关闭AI | complete/4,570 | complete/4,570 | 8 | 0.02 | 64.6 |
| pins-stock-aura | 经典高起点AI | complete/4,570 | complete/4,570 | 8 | 0.02 | 64.6 |
| pins-stock-aura | 扩展策略AI | complete/4,570 | complete/4,570 | 8 | 0.02 | 64.6 |
| pins-stock-aura | 大数据神经AI | complete/4,570 | complete/4,570 | 8 | 0.01 | 64.8 |
| active-event | 关闭AI | complete/5,965 | complete/5,965 | 324 | 0.71 | 84.0 |
| active-event | 经典高起点AI | complete/5,965 | complete/5,965 | 324 | 0.75 | 82.0 |
| active-event | 扩展策略AI | complete/5,965 | complete/5,965 | 324 | 0.85 | 81.8 |
| active-event | 大数据神经AI | complete/5,965 | complete/5,965 | 324 | 0.71 | 82.5 |
| grand | 关闭AI | complete/2,150 | complete/2,150 | 54 | 0.05 | 65.4 |
| grand | 经典高起点AI | complete/2,150 | complete/2,150 | 54 | 0.04 | 66.0 |
| grand | 扩展策略AI | complete/2,150 | complete/2,150 | 54 | 0.05 | 66.3 |
| grand | 大数据神经AI | complete/2,150 | complete/2,150 | 54 | 0.05 | 65.6 |
| fixed-npc | 关闭AI | complete/1,565 | complete/1,565 | 6 | 0.01 | 64.2 |
| fixed-npc | 经典高起点AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.3 |
| fixed-npc | 扩展策略AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.0 |
| fixed-npc | 大数据神经AI | complete/1,565 | complete/1,565 | 6 | 0.03 | 64.2 |
| CN-small | 关闭AI | complete/2,424 | complete/2,424 | 1 | 0.45 | 96.0 |
| CN-small | 经典高起点AI | complete/2,424 | complete/2,424 | 1 | 0.47 | 97.4 |
| CN-small | 扩展策略AI | complete/2,424 | complete/2,424 | 1 | 0.47 | 97.3 |
| CN-small | 大数据神经AI | complete/2,424 | complete/2,424 | 1 | 0.48 | 98.4 |
| JP-small | 关闭AI | complete/2,424 | complete/2,424 | 1 | 0.36 | 116.1 |
| JP-small | 经典高起点AI | complete/2,424 | complete/2,424 | 1 | 0.39 | 120.1 |
| JP-small | 扩展策略AI | complete/2,424 | process-failure/— | — | — | — |
| JP-small | 大数据神经AI | complete/2,424 | complete/2,424 | 1 | 0.38 | 120.6 |
| CN-medium | 关闭AI | complete/2,346 | complete/2,346 | 19 | 0.77 | 92.6 |
| CN-medium | 经典高起点AI | complete/2,346 | complete/2,346 | 19 | 0.70 | 92.7 |
| CN-medium | 扩展策略AI | complete/2,346 | complete/2,346 | 19 | 0.66 | 93.5 |
| CN-medium | 大数据神经AI | complete/2,346 | complete/2,346 | 19 | 0.65 | 92.6 |
| JP-medium | 关闭AI | complete/2,346 | complete/2,346 | 66 | 0.56 | 102.7 |
| JP-medium | 经典高起点AI | complete/2,346 | complete/2,346 | 66 | 0.55 | 104.3 |
| JP-medium | 扩展策略AI | complete/2,346 | complete/2,346 | 66 | 0.56 | 104.3 |
| JP-medium | 大数据神经AI | complete/2,346 | complete/2,346 | 66 | 0.57 | 103.0 |
| CN-open | 关闭AI | timeout/7,582 | timeout/7,582 | 24 | 10800.00 | 335.3 |
| CN-open | 经典高起点AI | timeout/7,593 | timeout/7,593 | 0 | 10800.01 | 345.7 |
| CN-open | 扩展策略AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 339.5 |
| CN-open | 大数据神经AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 352.1 |
| JP-open | 关闭AI | timeout/7,549 | timeout/7,582 | 15 | 10800.00 | 329.6 |
| JP-open | 经典高起点AI | timeout/7,593 | timeout/7,593 | 0 | 10800.02 | 350.7 |
| JP-open | 扩展策略AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 340.2 |
| JP-open | 大数据神经AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 385.9 |
| dense-zero | 关闭AI | complete/0 | complete/0 | 1,186 | 0.12 | 72.8 |
| dense-zero | 经典高起点AI | complete/0 | complete/0 | 1,186 | 0.12 | 73.0 |
| dense-zero | 扩展策略AI | complete/0 | complete/0 | 1,186 | 0.10 | 73.6 |
| dense-zero | 大数据神经AI | complete/0 | complete/0 | 1,186 | 0.11 | 73.0 |

## 相比短时限增加了什么

上一轮历史归档：40格完成、20格超时（历史机器仅作参考）。本轮有0格从同机短测超时转为长测完整结束。

## 大规模用例的起点和枚举进度

| 条件 | 选择 | 首个可行解秒数 | AI起点 | 长测当前分 | 首次枚举秒数 | 状态 |
|---|---|---:|---:|---:|---:|---|
| CN-medium | 关闭AI | 0.74 | — | 2,346 | 0.74 | complete |
| CN-medium | 经典高起点AI | 0.45 | 2,346 | 2,346 | 0.68 | complete |
| CN-medium | 扩展策略AI | 0.44 | 2,346 | 2,346 | 0.64 | complete |
| CN-medium | 大数据神经AI | 0.42 | 2,346 | 2,346 | 0.63 | complete |
| JP-medium | 关闭AI | 0.51 | — | 2,346 | 0.51 | complete |
| JP-medium | 经典高起点AI | 0.34 | 2,346 | 2,346 | 0.52 | complete |
| JP-medium | 扩展策略AI | 0.34 | 2,346 | 2,346 | 0.54 | complete |
| JP-medium | 大数据神经AI | 0.35 | 2,346 | 2,346 | 0.55 | complete |
| CN-open | 关闭AI | 1.19 | — | 7,582 | 1.19 | timeout |
| CN-open | 经典高起点AI | 2.32 | 7,593 | 7,593 | — | timeout |
| CN-open | 扩展策略AI | 1.83 | 7,593 | 7,593 | — | timeout |
| CN-open | 大数据神经AI | 2.16 | 7,593 | 7,593 | — | timeout |
| JP-open | 关闭AI | 2.66 | — | 7,582 | 2.66 | timeout |
| JP-open | 经典高起点AI | 6.98 | 7,593 | 7,593 | — | timeout |
| JP-open | 扩展策略AI | 5.92 | 7,593 | 7,593 | — | timeout |
| JP-open | 大数据神经AI | 7.45 | 7,593 | 7,593 | — | timeout |
| dense-zero | 关闭AI | 0.02 | — | 0 | 0.02 | complete |
| dense-zero | 经典高起点AI | 0.04 | 0 | 0 | 0.04 | complete |
| dense-zero | 扩展策略AI | 0.03 | 0 | 0 | 0.04 | complete |
| dense-zero | 大数据神经AI | 0.04 | 0 | 0 | 0.04 | complete |

## 重跑的七轮完整配队域剪枝对照

| 场景 | 关闭剪枝中位毫秒 | 开启剪枝中位毫秒 | 耗时比 |
|---|---:|---:|---:|
| conditional | 20.51 | 7.12 | 0.347 |
| tight-budget | 12.40 | 4.07 | 0.328 |
| rounding-ties | 37.90 | 26.23 | 0.692 |
| identity-stress | 322.67 | 26.08 | 0.081 |
| all-zero-ties | 7.60 | 7.45 | 0.981 |

## 如何解释这些结果

完整结束的查询必须满足最高分、全部同分队伍数量和SHA256一致；只要存在矛盾，报告即标为失败。部分结果不能超过另一个同条件已完成查询证明的最高分。同机短测已完成时，长测也必须给出相同完整结果。

AI起点已精确结算，和实际枚举队伍分开记录；起点存在、枚举数为0并不代表没有可行队伍。途中其他合法队伍不额外穷举。大量同分必须保留，耗时可能主要来自枚举和完整性证明。

上一轮归档只作历史参考。新一轮短测和3小时长测使用同一主机、同一CPU绑定、相同数据和模型；四种选择各占一个核心，同时运行。不同条件所在主机、历史归档环境的绝对时间不直接混合排名。本轮每格一次，不能据此宣称某个模型普遍最快。

引擎测试包含抽样精确复核和流式队伍指纹，不把所有队伍写入临时档案；RSS不等于浏览器全量OPFS归档容量。分页、导出、停止、缓存、移动布局、AI更新及原有功能由完整回归单独覆盖。

- [完整数值](report.json)
- [全体原始分格结果和时间检查点](cases/)
- [完整回归摘要](regression-summary.json)
- [七轮性能原始记录](regression/benchmark.json)
- [独立穷举逐例记录](regression/random-oracle.json)

## 失败或缺失项

- JP-small/long：异常或缺少结果：teacher
- JP-small：long: 异常或缺少结果：teacher
- 完整回归未全部通过或缺少回归结果
