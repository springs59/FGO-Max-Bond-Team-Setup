# 全部最高分配队：3小时限时全量重跑对比

状态：finished-with-explicit-timeout-classification。每个查询最多3小时；超时结果仍未证明最优或同分完整。

- 工作流：https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39702948902
- 固定提交：`8196a7c65d4b9f48f5460ffecb2fc8c7bc55dabe`
- 同机短测：40格完成，20格超时。
- 3小时长测：48格完成，12格超时，0格异常或缺失。
- 完整回归：passed；长测引擎峰值RSS最高490.1MiB。

## 四种选择的总体结果

| 选择 | 短测完成 | 长测完成 | 长测超时 | 长测异常 |
|---|---:|---:|---:|---:|
| 关闭AI | 10 | 12 | 3 | 0 |
| 经典高起点AI | 10 | 12 | 3 | 0 |
| 扩展策略AI | 10 | 12 | 3 | 0 |
| 大数据神经AI | 10 | 12 | 3 | 0 |

## 每个条件的同机短测与长测

| 条件 | 选择 | 短测状态/当前分 | 长测状态/当前分 | 长测同分数 | 长测秒数 | 峰值MiB |
|---|---|---|---|---:|---:|---:|
| conditional | 关闭AI | complete/4,318 | complete/4,318 | 648 | 0.11 | 70.8 |
| conditional | 经典高起点AI | complete/4,318 | complete/4,318 | 648 | 0.12 | 71.8 |
| conditional | 扩展策略AI | complete/4,318 | complete/4,318 | 648 | 0.13 | 71.6 |
| conditional | 大数据神经AI | complete/4,318 | complete/4,318 | 648 | 0.11 | 72.0 |
| self-flat | 关闭AI | complete/606 | complete/606 | 5,832 | 0.69 | 81.9 |
| self-flat | 经典高起点AI | complete/606 | complete/606 | 5,832 | 0.67 | 79.3 |
| self-flat | 扩展策略AI | complete/606 | complete/606 | 5,832 | 0.68 | 80.4 |
| self-flat | 大数据神经AI | complete/606 | complete/606 | 5,832 | 0.77 | 80.9 |
| six-own | 关闭AI | complete/5,379 | complete/5,379 | 524,880 | 9.48 | 273.1 |
| six-own | 经典高起点AI | complete/5,379 | complete/5,379 | 524,880 | 9.56 | 271.5 |
| six-own | 扩展策略AI | complete/5,379 | complete/5,379 | 524,880 | 9.25 | 273.2 |
| six-own | 大数据神经AI | complete/5,379 | complete/5,379 | 524,880 | 9.49 | 272.5 |
| prefer | 关闭AI | complete/3,422 | complete/3,422 | 684 | 0.07 | 66.2 |
| prefer | 经典高起点AI | complete/3,422 | complete/3,422 | 684 | 0.07 | 67.2 |
| prefer | 扩展策略AI | complete/3,422 | complete/3,422 | 684 | 0.08 | 67.7 |
| prefer | 大数据神经AI | complete/3,422 | complete/3,422 | 684 | 0.05 | 67.0 |
| pins-stock-aura | 关闭AI | complete/4,570 | complete/4,570 | 216 | 0.03 | 65.3 |
| pins-stock-aura | 经典高起点AI | complete/4,570 | complete/4,570 | 216 | 0.03 | 65.3 |
| pins-stock-aura | 扩展策略AI | complete/4,570 | complete/4,570 | 216 | 0.03 | 64.9 |
| pins-stock-aura | 大数据神经AI | complete/4,570 | complete/4,570 | 216 | 0.03 | 65.1 |
| active-event | 关闭AI | complete/5,965 | complete/5,965 | 324 | 1.04 | 79.9 |
| active-event | 经典高起点AI | complete/5,965 | complete/5,965 | 324 | 1.05 | 81.8 |
| active-event | 扩展策略AI | complete/5,965 | complete/5,965 | 324 | 1.04 | 82.0 |
| active-event | 大数据神经AI | complete/5,965 | complete/5,965 | 324 | 1.05 | 82.8 |
| grand | 关闭AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 67.0 |
| grand | 经典高起点AI | complete/2,150 | complete/2,150 | 54 | 0.02 | 66.7 |
| grand | 扩展策略AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 68.0 |
| grand | 大数据神经AI | complete/2,150 | complete/2,150 | 54 | 0.03 | 67.4 |
| fixed-npc | 关闭AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.0 |
| fixed-npc | 经典高起点AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.1 |
| fixed-npc | 扩展策略AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.1 |
| fixed-npc | 大数据神经AI | complete/1,565 | complete/1,565 | 6 | 0.02 | 64.2 |
| CN-small | 关闭AI | complete/2,424 | complete/2,424 | 588 | 2.73 | 119.5 |
| CN-small | 经典高起点AI | complete/2,424 | complete/2,424 | 588 | 2.78 | 118.8 |
| CN-small | 扩展策略AI | complete/2,424 | complete/2,424 | 588 | 2.74 | 116.2 |
| CN-small | 大数据神经AI | complete/2,424 | complete/2,424 | 588 | 2.68 | 120.1 |
| JP-small | 关闭AI | complete/2,424 | complete/2,424 | 882 | 2.72 | 160.7 |
| JP-small | 经典高起点AI | complete/2,424 | complete/2,424 | 882 | 2.92 | 157.1 |
| JP-small | 扩展策略AI | complete/2,424 | complete/2,424 | 882 | 3.30 | 122.9 |
| JP-small | 大数据神经AI | complete/2,424 | complete/2,424 | 882 | 2.74 | 131.6 |
| CN-medium | 关闭AI | timeout/2,346 | complete/2,346 | 11,886 | 71.24 | 216.3 |
| CN-medium | 经典高起点AI | timeout/2,346 | complete/2,346 | 11,886 | 71.58 | 215.2 |
| CN-medium | 扩展策略AI | timeout/2,346 | complete/2,346 | 11,886 | 74.27 | 217.7 |
| CN-medium | 大数据神经AI | timeout/2,346 | complete/2,346 | 11,886 | 73.68 | 217.4 |
| JP-medium | 关闭AI | timeout/2,346 | complete/2,346 | 39,900 | 81.16 | 227.4 |
| JP-medium | 经典高起点AI | timeout/2,346 | complete/2,346 | 39,900 | 81.04 | 228.7 |
| JP-medium | 扩展策略AI | timeout/2,346 | complete/2,346 | 39,900 | 80.21 | 227.7 |
| JP-medium | 大数据神经AI | timeout/2,346 | complete/2,346 | 39,900 | 80.91 | 226.9 |
| CN-open | 关闭AI | timeout/7,549 | timeout/7,549 | 40,320 | 10800.44 | 302.7 |
| CN-open | 经典高起点AI | timeout/7,593 | timeout/7,593 | 0 | 10800.29 | 438.7 |
| CN-open | 扩展策略AI | timeout/7,593 | timeout/7,593 | 0 | 10800.52 | 404.5 |
| CN-open | 大数据神经AI | timeout/7,593 | timeout/7,593 | 0 | 10800.39 | 404.4 |
| JP-open | 关闭AI | timeout/7,523 | timeout/7,523 | 201,600 | 10800.33 | 339.7 |
| JP-open | 经典高起点AI | timeout/7,593 | timeout/7,593 | 0 | 10800.01 | 447.7 |
| JP-open | 扩展策略AI | timeout/7,593 | timeout/7,593 | 0 | 10800.09 | 441.6 |
| JP-open | 大数据神经AI | timeout/7,593 | timeout/7,593 | 0 | 10800.25 | 490.1 |
| dense-zero | 关闭AI | timeout/0 | timeout/0 | 502,694,636 | 10800.00 | 299.7 |
| dense-zero | 经典高起点AI | timeout/0 | timeout/0 | 508,476,270 | 10800.00 | 296.5 |
| dense-zero | 扩展策略AI | timeout/0 | timeout/0 | 511,245,153 | 10800.00 | 296.7 |
| dense-zero | 大数据神经AI | timeout/0 | timeout/0 | 511,576,782 | 10800.02 | 294.6 |

## 相比短时限增加了什么

上一轮历史归档：40格完成、20格超时（历史机器仅作参考）。本轮有8格从同机短测超时转为长测完整结束。

## 大规模用例的起点和枚举进度

| 条件 | 选择 | 首个可行解秒数 | AI起点 | 长测当前分 | 首次枚举秒数 | 状态 |
|---|---|---:|---:|---:|---:|---|
| CN-medium | 关闭AI | 0.48 | — | 2,346 | 0.48 | complete |
| CN-medium | 经典高起点AI | 0.43 | 2,346 | 2,346 | 0.55 | complete |
| CN-medium | 扩展策略AI | 0.43 | 2,346 | 2,346 | 0.57 | complete |
| CN-medium | 大数据神经AI | 0.76 | 2,346 | 2,346 | 0.92 | complete |
| JP-medium | 关闭AI | 0.53 | — | 2,346 | 0.53 | complete |
| JP-medium | 经典高起点AI | 0.49 | 2,346 | 2,346 | 0.61 | complete |
| JP-medium | 扩展策略AI | 0.49 | 2,346 | 2,346 | 0.61 | complete |
| JP-medium | 大数据神经AI | 0.78 | 2,346 | 2,346 | 0.91 | complete |
| CN-open | 关闭AI | 1.80 | — | 7,549 | 1.80 | timeout |
| CN-open | 经典高起点AI | 3.92 | 7,593 | 7,593 | — | timeout |
| CN-open | 扩展策略AI | 3.48 | 7,593 | 7,593 | — | timeout |
| CN-open | 大数据神经AI | 3.72 | 7,593 | 7,593 | — | timeout |
| JP-open | 关闭AI | 1.25 | — | 7,523 | 1.25 | timeout |
| JP-open | 经典高起点AI | 4.31 | 7,593 | 7,593 | — | timeout |
| JP-open | 扩展策略AI | 3.65 | 7,593 | 7,593 | — | timeout |
| JP-open | 大数据神经AI | 4.31 | 7,593 | 7,593 | — | timeout |
| dense-zero | 关闭AI | 0.02 | — | 0 | 0.02 | timeout |
| dense-zero | 经典高起点AI | 0.04 | 0 | 0 | 0.04 | timeout |
| dense-zero | 扩展策略AI | 0.04 | 0 | 0 | 0.04 | timeout |
| dense-zero | 大数据神经AI | 0.04 | 0 | 0 | 0.04 | timeout |

## 重跑的七轮完整配队域剪枝对照

| 场景 | 关闭剪枝中位毫秒 | 开启剪枝中位毫秒 | 耗时比 |
|---|---:|---:|---:|
| conditional | 24.79 | 9.92 | 0.400 |
| tight-budget | 16.86 | 6.21 | 0.368 |
| rounding-ties | 39.67 | 33.76 | 0.851 |
| identity-stress | 385.68 | 31.98 | 0.083 |
| all-zero-ties | 9.34 | 9.59 | 1.027 |

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
