# 全部最高分配队：3小时限时全量重跑对比

状态：finished-with-explicit-timeout-classification。每个查询最多3小时；超时结果仍未证明最优或同分完整。

- 工作流：https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39726676402
- 固定提交：`23e50c082636f58f1acba9179880b9617d054a03`
- 同机短测：52格完成，8格超时。
- 3小时长测：52格完成，8格超时，0格异常或缺失。
- 完整回归：passed；长测引擎峰值RSS最高378.3MiB。

## 四种选择的总体结果

| 选择 | 短测完成 | 长测完成 | 长测超时 | 长测异常 |
|---|---:|---:|---:|---:|
| 关闭AI | 13 | 13 | 2 | 0 |
| 经典高起点AI | 13 | 13 | 2 | 0 |
| 扩展策略AI | 13 | 13 | 2 | 0 |
| 大数据神经AI | 13 | 13 | 2 | 0 |

## 每个条件的同机短测与长测

| 条件 | 选择 | 短测状态/当前分 | 长测状态/当前分 | 长测同分数 | 长测秒数 | 峰值MiB |
|---|---|---|---|---:|---:|---:|
| conditional | 关闭AI | complete/4,318 | complete/4,318 | 12 | 0.04 | 65.7 |
| conditional | 经典高起点AI | complete/4,318 | complete/4,318 | 12 | 0.05 | 66.0 |
| conditional | 扩展策略AI | complete/4,318 | complete/4,318 | 12 | 0.05 | 65.6 |
| conditional | 大数据神经AI | complete/4,318 | complete/4,318 | 12 | 0.05 | 65.9 |
| self-flat | 关闭AI | complete/606 | complete/606 | 5,832 | 0.71 | 82.4 |
| self-flat | 经典高起点AI | complete/606 | complete/606 | 5,832 | 0.87 | 82.2 |
| self-flat | 扩展策略AI | complete/606 | complete/606 | 5,832 | 0.73 | 82.4 |
| self-flat | 大数据神经AI | complete/606 | complete/606 | 5,832 | 0.71 | 83.0 |
| six-own | 关闭AI | complete/5,379 | complete/5,379 | 10 | 0.03 | 64.6 |
| six-own | 经典高起点AI | complete/5,379 | complete/5,379 | 10 | 0.04 | 65.5 |
| six-own | 扩展策略AI | complete/5,379 | complete/5,379 | 10 | 0.04 | 65.8 |
| six-own | 大数据神经AI | complete/5,379 | complete/5,379 | 10 | 0.05 | 65.9 |
| prefer | 关闭AI | complete/3,422 | complete/3,422 | 14 | 0.02 | 64.2 |
| prefer | 经典高起点AI | complete/3,422 | complete/3,422 | 14 | 0.02 | 64.4 |
| prefer | 扩展策略AI | complete/3,422 | complete/3,422 | 14 | 0.02 | 63.9 |
| prefer | 大数据神经AI | complete/3,422 | complete/3,422 | 14 | 0.02 | 64.8 |
| pins-stock-aura | 关闭AI | complete/4,570 | complete/4,570 | 8 | 0.03 | 64.6 |
| pins-stock-aura | 经典高起点AI | complete/4,570 | complete/4,570 | 8 | 0.03 | 64.6 |
| pins-stock-aura | 扩展策略AI | complete/4,570 | complete/4,570 | 8 | 0.03 | 64.7 |
| pins-stock-aura | 大数据神经AI | complete/4,570 | complete/4,570 | 8 | 0.03 | 64.7 |
| active-event | 关闭AI | complete/5,965 | complete/5,965 | 324 | 0.59 | 80.8 |
| active-event | 经典高起点AI | complete/5,965 | complete/5,965 | 324 | 0.59 | 80.8 |
| active-event | 扩展策略AI | complete/5,965 | complete/5,965 | 324 | 0.61 | 82.5 |
| active-event | 大数据神经AI | complete/5,965 | complete/5,965 | 324 | 0.59 | 82.7 |
| grand | 关闭AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 67.0 |
| grand | 经典高起点AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 65.7 |
| grand | 扩展策略AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 66.4 |
| grand | 大数据神经AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 67.7 |
| fixed-npc | 关闭AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 63.9 |
| fixed-npc | 经典高起点AI | complete/1,565 | complete/1,565 | 6 | 0.01 | 64.3 |
| fixed-npc | 扩展策略AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.0 |
| fixed-npc | 大数据神经AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.3 |
| CN-small | 关闭AI | complete/2,424 | complete/2,424 | 1 | 0.61 | 97.4 |
| CN-small | 经典高起点AI | complete/2,424 | complete/2,424 | 1 | 0.61 | 98.2 |
| CN-small | 扩展策略AI | complete/2,424 | complete/2,424 | 1 | 0.66 | 98.7 |
| CN-small | 大数据神经AI | complete/2,424 | complete/2,424 | 1 | 0.74 | 97.3 |
| JP-small | 关闭AI | complete/2,424 | complete/2,424 | 1 | 0.42 | 120.2 |
| JP-small | 经典高起点AI | complete/2,424 | complete/2,424 | 1 | 0.41 | 120.4 |
| JP-small | 扩展策略AI | complete/2,424 | complete/2,424 | 1 | 0.41 | 119.6 |
| JP-small | 大数据神经AI | complete/2,424 | complete/2,424 | 1 | 0.47 | 118.0 |
| CN-medium | 关闭AI | complete/2,346 | complete/2,346 | 19 | 0.42 | 92.4 |
| CN-medium | 经典高起点AI | complete/2,346 | complete/2,346 | 19 | 0.45 | 94.2 |
| CN-medium | 扩展策略AI | complete/2,346 | complete/2,346 | 19 | 0.51 | 93.3 |
| CN-medium | 大数据神经AI | complete/2,346 | complete/2,346 | 19 | 0.53 | 93.4 |
| JP-medium | 关闭AI | complete/2,346 | complete/2,346 | 66 | 0.71 | 120.8 |
| JP-medium | 经典高起点AI | complete/2,346 | complete/2,346 | 66 | 0.72 | 121.3 |
| JP-medium | 扩展策略AI | complete/2,346 | complete/2,346 | 66 | 0.73 | 121.0 |
| JP-medium | 大数据神经AI | complete/2,346 | complete/2,346 | 66 | 0.70 | 119.3 |
| CN-open | 关闭AI | timeout/7,582 | timeout/7,582 | 24 | 10800.00 | 320.6 |
| CN-open | 经典高起点AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 360.4 |
| CN-open | 扩展策略AI | timeout/7,593 | timeout/7,593 | 0 | 10800.01 | 338.1 |
| CN-open | 大数据神经AI | timeout/7,593 | timeout/7,593 | 0 | 10800.01 | 344.7 |
| JP-open | 关闭AI | timeout/7,549 | timeout/7,582 | 15 | 10800.00 | 329.8 |
| JP-open | 经典高起点AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 347.4 |
| JP-open | 扩展策略AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 368.8 |
| JP-open | 大数据神经AI | timeout/7,593 | timeout/7,593 | 0 | 10800.00 | 378.3 |
| dense-zero | 关闭AI | complete/0 | complete/0 | 1,186 | 0.10 | 72.9 |
| dense-zero | 经典高起点AI | complete/0 | complete/0 | 1,186 | 0.13 | 73.5 |
| dense-zero | 扩展策略AI | complete/0 | complete/0 | 1,186 | 0.14 | 73.8 |
| dense-zero | 大数据神经AI | complete/0 | complete/0 | 1,186 | 0.13 | 74.2 |

## 相比短时限增加了什么

上一轮历史归档：40格完成、20格超时（历史机器仅作参考）。本轮有0格从同机短测超时转为长测完整结束。

## 大规模用例的起点和枚举进度

| 条件 | 选择 | 首个可行解秒数 | AI起点 | 长测当前分 | 首次枚举秒数 | 状态 |
|---|---|---:|---:|---:|---:|---|
| CN-medium | 关闭AI | 0.40 | — | 2,346 | 0.40 | complete |
| CN-medium | 经典高起点AI | 0.27 | 2,346 | 2,346 | 0.42 | complete |
| CN-medium | 扩展策略AI | 0.32 | 2,346 | 2,346 | 0.47 | complete |
| CN-medium | 大数据神经AI | 0.33 | 2,346 | 2,346 | 0.49 | complete |
| JP-medium | 关闭AI | 0.67 | — | 2,346 | 0.67 | complete |
| JP-medium | 经典高起点AI | 0.45 | 2,346 | 2,346 | 0.69 | complete |
| JP-medium | 扩展策略AI | 0.46 | 2,346 | 2,346 | 0.70 | complete |
| JP-medium | 大数据神经AI | 0.44 | 2,346 | 2,346 | 0.68 | complete |
| CN-open | 关闭AI | 2.45 | — | 7,582 | 2.45 | timeout |
| CN-open | 经典高起点AI | 4.03 | 7,593 | 7,593 | — | timeout |
| CN-open | 扩展策略AI | 3.52 | 7,593 | 7,593 | — | timeout |
| CN-open | 大数据神经AI | 4.02 | 7,593 | 7,593 | — | timeout |
| JP-open | 关闭AI | 2.54 | — | 7,582 | 2.54 | timeout |
| JP-open | 经典高起点AI | 7.05 | 7,593 | 7,593 | — | timeout |
| JP-open | 扩展策略AI | 5.40 | 7,593 | 7,593 | — | timeout |
| JP-open | 大数据神经AI | 6.98 | 7,593 | 7,593 | — | timeout |
| dense-zero | 关闭AI | 0.02 | — | 0 | 0.02 | complete |
| dense-zero | 经典高起点AI | 0.04 | 0 | 0 | 0.04 | complete |
| dense-zero | 扩展策略AI | 0.05 | 0 | 0 | 0.05 | complete |
| dense-zero | 大数据神经AI | 0.04 | 0 | 0 | 0.05 | complete |

## 重跑的七轮完整配队域剪枝对照

| 场景 | 关闭剪枝中位毫秒 | 开启剪枝中位毫秒 | 耗时比 |
|---|---:|---:|---:|
| conditional | 25.04 | 7.17 | 0.286 |
| tight-budget | 15.87 | 5.49 | 0.346 |
| rounding-ties | 39.62 | 40.04 | 1.011 |
| identity-stress | 400.83 | 33.28 | 0.083 |
| all-zero-ties | 9.61 | 9.77 | 1.017 |

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
