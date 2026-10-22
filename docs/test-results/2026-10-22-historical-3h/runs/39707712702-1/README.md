# 历史优势求解器与当前四种模式：统一三小时测试

状态：failed；15种统一条件，135种版本/条件组合，含同机锚点复测共180次查询。每次最多3小时。

## 对比口径

所有版本使用原生 `recommendTeam`，相同公开数据快照、账号合成规则、输入条件、冷进程与单核绑定。历史模型保留各版本原生 AI 用法，2.0 原版关闭 AI；当前三个模型使用各自策略。

本表比较最优代表解查询。原生返回并通过当前精确结算，不等于已收集全部最高分队伍。全部同分队伍的三小时测试继续独立保留：[原始全量长跑](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39702948902)。若该长跑已有相同输入的完整结果，本报告额外交叉验证最高分。

每个同机分组都有当前关闭 AI 的锚点。耗时比仅在同机、同输入、已完成且同分时计算；跨主机的毫秒数不能直接排名。每格一次，结果只描述本轮。

## 总体结果

| 版本 | 原生完成 | 超时 | 异常 | 最高分核对通过 | 最高分不一致 | 同机耗时比中位数 |
|---|---:|---:|---:|---:|---:|---:|
| 2.0.0 原版 | 13 | 0 | 2 | 8 | 3 | 0.696 |
| 2.1.2 固定对照版 | 13 | 0 | 2 | 8 | 3 | 0.880 |
| 早期区间剪枝版 | 13 | 0 | 2 | 8 | 3 | 0.838 |
| 2.1.3 框架版 | 13 | 0 | 2 | 8 | 3 | 0.963 |
| 2.1.6 已发布版 | 14 | 0 | 1 | 8 | 3 | 0.943 |
| 当前版：关闭 AI | 13 | 0 | 2 | 8 | 3 | 1.000 |
| 当前版：经典高起点 AI | 14 | 0 | 1 | 8 | 3 | 1.028 |
| 当前版：扩展策略 AI | 13 | 0 | 2 | 8 | 3 | 1.028 |
| 当前版：大数据神经 AI | 15 | 0 | 0 | 8 | 3 | 1.046 |

耗时比 = 该版本原生查询耗时 / 同机当前关闭 AI 耗时。小于1表示本次配对更快。

## 全部条件和版本

| 条件 | 分组 | 版本 | 状态 | 最高分 | 毫秒 | 同机耗时比 | 峰值RSS MiB | 穷举最高分核对 |
|---|---|---|---|---:|---:|---:|---:|---|
| conditional | historical | 2.0.0 原版 | complete | 4318 | 41.685 | 0.565 | 66.234 | 通过 |
| conditional | historical | 2.1.2 固定对照版 | complete | 4318 | 48.652 | 0.659 | 66.578 | 通过 |
| conditional | historical | 早期区间剪枝版 | complete | 4318 | 47.400 | 0.642 | 66.816 | 通过 |
| conditional | historical | 当前版：关闭 AI | complete | 4318 | 73.815 | 1.000 | 64.238 | 通过 |
| conditional | released | 2.1.3 框架版 | complete | 4318 | 45.946 | 0.991 | 66.977 | 通过 |
| conditional | released | 2.1.6 已发布版 | complete | 4318 | 47.296 | 1.021 | 67.352 | 通过 |
| conditional | released | 当前版：经典高起点 AI | complete | 4318 | 46.638 | 1.006 | 64.473 | 通过 |
| conditional | released | 当前版：关闭 AI | complete | 4318 | 46.342 | 1.000 | 64.535 | 通过 |
| conditional | models | 当前版：关闭 AI | complete | 4318 | 47.054 | 1.000 | 65.320 | 通过 |
| conditional | models | 当前版：经典高起点 AI | complete | 4318 | 46.461 | 0.987 | 65.805 | 通过 |
| conditional | models | 当前版：扩展策略 AI | complete | 4318 | 47.058 | 1.000 | 65.609 | 通过 |
| conditional | models | 当前版：大数据神经 AI | complete | 4318 | 49.720 | 1.057 | 65.418 | 通过 |
| self-flat | historical | 2.0.0 原版 | complete | 606 | 43.880 | 0.696 | 67.852 | 通过 |
| self-flat | historical | 2.1.2 固定对照版 | complete | 606 | 48.815 | 0.774 | 67.652 | 通过 |
| self-flat | historical | 早期区间剪枝版 | complete | 606 | 33.681 | 0.534 | 67.934 | 通过 |
| self-flat | historical | 当前版：关闭 AI | complete | 606 | 63.042 | 1.000 | 64.352 | 通过 |
| self-flat | released | 2.1.3 框架版 | complete | 606 | 47.033 | 0.833 | 69.598 | 通过 |
| self-flat | released | 2.1.6 已发布版 | complete | 606 | 50.884 | 0.901 | 69.793 | 通过 |
| self-flat | released | 当前版：经典高起点 AI | complete | 606 | 52.987 | 0.939 | 65.836 | 通过 |
| self-flat | released | 当前版：关闭 AI | complete | 606 | 56.456 | 1.000 | 64.977 | 通过 |
| self-flat | models | 当前版：关闭 AI | complete | 606 | 51.227 | 1.000 | 64.230 | 通过 |
| self-flat | models | 当前版：经典高起点 AI | complete | 606 | 59.599 | 1.163 | 64.805 | 通过 |
| self-flat | models | 当前版：扩展策略 AI | complete | 606 | 71.296 | 1.392 | 64.668 | 通过 |
| self-flat | models | 当前版：大数据神经 AI | complete | 606 | 53.602 | 1.046 | 65.262 | 通过 |
| six-own | historical | 2.0.0 原版 | complete | 5379 | 38.937 | 0.873 | 65.746 | 通过 |
| six-own | historical | 2.1.2 固定对照版 | complete | 5379 | 39.254 | 0.880 | 66.324 | 通过 |
| six-own | historical | 早期区间剪枝版 | complete | 5379 | 43.500 | 0.976 | 65.863 | 通过 |
| six-own | historical | 当前版：关闭 AI | complete | 5379 | 44.592 | 1.000 | 64.383 | 通过 |
| six-own | released | 2.1.3 框架版 | complete | 5379 | 24.605 | 0.993 | 66.418 | 通过 |
| six-own | released | 2.1.6 已发布版 | complete | 5379 | 19.523 | 0.788 | 66.699 | 通过 |
| six-own | released | 当前版：经典高起点 AI | complete | 5379 | 24.330 | 0.982 | 64.230 | 通过 |
| six-own | released | 当前版：关闭 AI | complete | 5379 | 24.771 | 1.000 | 64.516 | 通过 |
| six-own | models | 当前版：关闭 AI | complete | 5379 | 36.652 | 1.000 | 65.629 | 通过 |
| six-own | models | 当前版：经典高起点 AI | complete | 5379 | 37.690 | 1.028 | 66.484 | 通过 |
| six-own | models | 当前版：扩展策略 AI | complete | 5379 | 37.669 | 1.028 | 66.117 | 通过 |
| six-own | models | 当前版：大数据神经 AI | complete | 5379 | 40.031 | 1.092 | 65.531 | 通过 |
| prefer | historical | 2.0.0 原版 | complete | 1711 | 26.750 | 0.777 | 66.531 | 未证明 |
| prefer | historical | 2.1.2 固定对照版 | complete | 1711 | 21.519 | 0.625 | 66.008 | 未证明 |
| prefer | historical | 早期区间剪枝版 | complete | 1711 | 24.391 | 0.709 | 66.977 | 未证明 |
| prefer | historical | 当前版：关闭 AI | complete | 1711 | 34.422 | 1.000 | 64.555 | 未证明 |
| prefer | released | 2.1.3 框架版 | complete | 1711 | 33.696 | 0.815 | 66.531 | 未证明 |
| prefer | released | 2.1.6 已发布版 | complete | 1711 | 34.314 | 0.830 | 66.914 | 未证明 |
| prefer | released | 当前版：经典高起点 AI | complete | 1711 | 40.227 | 0.973 | 65.051 | 未证明 |
| prefer | released | 当前版：关闭 AI | complete | 1711 | 41.336 | 1.000 | 64.250 | 未证明 |
| prefer | models | 当前版：关闭 AI | complete | 1711 | 23.812 | 1.000 | 63.316 | 未证明 |
| prefer | models | 当前版：经典高起点 AI | complete | 1711 | 22.620 | 0.950 | 64.047 | 未证明 |
| prefer | models | 当前版：扩展策略 AI | complete | 1711 | 24.272 | 1.019 | 63.480 | 未证明 |
| prefer | models | 当前版：大数据神经 AI | complete | 1711 | 25.181 | 1.057 | 64.625 | 未证明 |
| pins-stock-aura | historical | 2.0.0 原版 | complete | 4432 | 27.485 | — | 66.664 | 未证明 |
| pins-stock-aura | historical | 2.1.2 固定对照版 | complete | 4432 | 41.243 | — | 66.773 | 未证明 |
| pins-stock-aura | historical | 早期区间剪枝版 | complete | 4432 | 27.903 | — | 66.766 | 未证明 |
| pins-stock-aura | historical | 当前版：关闭 AI | complete | 4432 | 29.305 | — | 64.586 | 未证明 |
| pins-stock-aura | released | 2.1.3 框架版 | complete | 4432 | 43.589 | — | 66.145 | 未证明 |
| pins-stock-aura | released | 2.1.6 已发布版 | complete | 4432 | 39.431 | — | 65.949 | 未证明 |
| pins-stock-aura | released | 当前版：经典高起点 AI | complete | 4432 | 46.598 | — | 64.332 | 未证明 |
| pins-stock-aura | released | 当前版：关闭 AI | complete | 4432 | 32.927 | — | 63.422 | 未证明 |
| pins-stock-aura | models | 当前版：关闭 AI | complete | 4432 | 25.264 | — | 63.898 | 未证明 |
| pins-stock-aura | models | 当前版：经典高起点 AI | complete | 4432 | 26.384 | — | 64.465 | 未证明 |
| pins-stock-aura | models | 当前版：扩展策略 AI | complete | 4432 | 27.504 | — | 64.602 | 未证明 |
| pins-stock-aura | models | 当前版：大数据神经 AI | complete | 4432 | 27.971 | — | 64.316 | 未证明 |
| active-event | historical | 2.0.0 原版 | complete | 5965 | 45.110 | 0.568 | 67.023 | 通过 |
| active-event | historical | 2.1.2 固定对照版 | complete | 5965 | 51.388 | 0.647 | 68.098 | 通过 |
| active-event | historical | 早期区间剪枝版 | complete | 5965 | 46.837 | 0.590 | 67.664 | 通过 |
| active-event | historical | 当前版：关闭 AI | complete | 5965 | 79.367 | 1.000 | 65.297 | 通过 |
| active-event | released | 2.1.3 框架版 | complete | 5965 | 44.833 | 0.902 | 67.414 | 通过 |
| active-event | released | 2.1.6 已发布版 | complete | 5965 | 46.834 | 0.943 | 67.113 | 通过 |
| active-event | released | 当前版：经典高起点 AI | complete | 5965 | 51.206 | 1.031 | 64.883 | 通过 |
| active-event | released | 当前版：关闭 AI | complete | 5965 | 49.688 | 1.000 | 64.375 | 通过 |
| active-event | models | 当前版：关闭 AI | complete | 5965 | 33.236 | 1.000 | 65.238 | 通过 |
| active-event | models | 当前版：经典高起点 AI | complete | 5965 | 33.750 | 1.015 | 65.465 | 通过 |
| active-event | models | 当前版：扩展策略 AI | complete | 5965 | 34.220 | 1.030 | 65.672 | 通过 |
| active-event | models | 当前版：大数据神经 AI | complete | 5965 | 31.506 | 0.948 | 65.965 | 通过 |
| grand | historical | 2.0.0 原版 | complete | 2150 | 15.078 | 0.695 | 66.215 | 通过 |
| grand | historical | 2.1.2 固定对照版 | complete | 2150 | 21.690 | 0.999 | 65.953 | 通过 |
| grand | historical | 早期区间剪枝版 | complete | 2150 | 18.186 | 0.838 | 66.605 | 通过 |
| grand | historical | 当前版：关闭 AI | complete | 2150 | 21.708 | 1.000 | 64.020 | 通过 |
| grand | released | 2.1.3 框架版 | complete | 2150 | 34.057 | 0.963 | 65.441 | 通过 |
| grand | released | 2.1.6 已发布版 | complete | 2150 | 34.768 | 0.983 | 64.910 | 通过 |
| grand | released | 当前版：经典高起点 AI | complete | 2150 | 33.991 | 0.961 | 63.145 | 通过 |
| grand | released | 当前版：关闭 AI | complete | 2150 | 35.353 | 1.000 | 62.543 | 通过 |
| grand | models | 当前版：关闭 AI | complete | 2150 | 30.590 | 1.000 | 63.680 | 通过 |
| grand | models | 当前版：经典高起点 AI | complete | 2150 | 19.296 | 0.631 | 65.000 | 通过 |
| grand | models | 当前版：扩展策略 AI | complete | 2150 | 14.640 | 0.479 | 64.684 | 通过 |
| grand | models | 当前版：大数据神经 AI | complete | 2150 | 16.323 | 0.534 | 64.664 | 通过 |
| fixed-npc | historical | 2.0.0 原版 | complete | 1565 | 22.741 | 0.689 | 65.340 | 通过 |
| fixed-npc | historical | 2.1.2 固定对照版 | complete | 1565 | 30.995 | 0.940 | 65.055 | 通过 |
| fixed-npc | historical | 早期区间剪枝版 | complete | 1565 | 32.490 | 0.985 | 65.504 | 通过 |
| fixed-npc | historical | 当前版：关闭 AI | complete | 1565 | 32.986 | 1.000 | 62.465 | 通过 |
| fixed-npc | released | 2.1.3 框架版 | complete | 1565 | 23.359 | 0.719 | 66.305 | 通过 |
| fixed-npc | released | 2.1.6 已发布版 | complete | 1565 | 20.988 | 0.646 | 66.582 | 通过 |
| fixed-npc | released | 当前版：经典高起点 AI | complete | 1565 | 32.198 | 0.992 | 63.758 | 通过 |
| fixed-npc | released | 当前版：关闭 AI | complete | 1565 | 32.472 | 1.000 | 63.625 | 通过 |
| fixed-npc | models | 当前版：关闭 AI | complete | 1565 | 29.548 | 1.000 | 63.441 | 通过 |
| fixed-npc | models | 当前版：经典高起点 AI | complete | 1565 | 43.628 | 1.477 | 63.805 | 通过 |
| fixed-npc | models | 当前版：扩展策略 AI | complete | 1565 | 33.560 | 1.136 | 64.145 | 通过 |
| fixed-npc | models | 当前版：大数据神经 AI | complete | 1565 | 30.200 | 1.022 | 64.551 | 通过 |
| CN-small | historical | 2.0.0 原版 | complete | 2346 | 610.000 | — | 100.375 | 未证明 |
| CN-small | historical | 2.1.2 固定对照版 | complete | 2346 | 628.974 | — | 97.398 | 未证明 |
| CN-small | historical | 早期区间剪枝版 | complete | 2346 | 711.465 | — | 99.188 | 未证明 |
| CN-small | historical | 当前版：关闭 AI | complete | 2346 | 770.571 | — | 94.840 | 未证明 |
| CN-small | released | 2.1.3 框架版 | complete | 2346 | 469.190 | — | 98.617 | 未证明 |
| CN-small | released | 2.1.6 已发布版 | complete | 2346 | 473.303 | — | 97.422 | 未证明 |
| CN-small | released | 当前版：经典高起点 AI | complete | 2346 | 591.017 | — | 93.609 | 未证明 |
| CN-small | released | 当前版：关闭 AI | complete | 2346 | 495.341 | — | 96.531 | 未证明 |
| CN-small | models | 当前版：关闭 AI | complete | 2346 | 546.813 | — | 92.633 | 未证明 |
| CN-small | models | 当前版：经典高起点 AI | complete | 2346 | 477.149 | — | 94.758 | 未证明 |
| CN-small | models | 当前版：扩展策略 AI | complete | 2346 | 519.584 | — | 97.078 | 未证明 |
| CN-small | models | 当前版：大数据神经 AI | complete | 2346 | 767.395 | — | 94.461 | 未证明 |
| JP-small | historical | 2.0.0 原版 | complete | 2346 | 459.233 | — | 117.422 | 未证明 |
| JP-small | historical | 2.1.2 固定对照版 | complete | 2346 | 468.160 | — | 116.262 | 未证明 |
| JP-small | historical | 早期区间剪枝版 | complete | 2346 | 494.815 | — | 115.641 | 未证明 |
| JP-small | historical | 当前版：关闭 AI | complete | 2346 | 472.726 | — | 115.012 | 未证明 |
| JP-small | released | 2.1.3 框架版 | complete | 2346 | 523.461 | — | 117.773 | 未证明 |
| JP-small | released | 2.1.6 已发布版 | complete | 2346 | 503.406 | — | 115.840 | 未证明 |
| JP-small | released | 当前版：经典高起点 AI | complete | 2346 | 554.981 | — | 113.598 | 未证明 |
| JP-small | released | 当前版：关闭 AI | complete | 2346 | 598.575 | — | 114.328 | 未证明 |
| JP-small | models | 当前版：关闭 AI | complete | 2346 | 584.133 | — | 115.805 | 未证明 |
| JP-small | models | 当前版：经典高起点 AI | complete | 2346 | 480.299 | — | 114.582 | 未证明 |
| JP-small | models | 当前版：扩展策略 AI | complete | 2346 | 507.180 | — | 116.574 | 未证明 |
| JP-small | models | 当前版：大数据神经 AI | complete | 2346 | 486.930 | — | 112.898 | 未证明 |
| CN-medium | historical | 2.0.0 原版 | complete | 2346 | 266.493 | 0.988 | 94.238 | 通过 |
| CN-medium | historical | 2.1.2 固定对照版 | complete | 2346 | 260.149 | 0.965 | 92.785 | 通过 |
| CN-medium | historical | 早期区间剪枝版 | complete | 2346 | 311.486 | 1.155 | 94.105 | 通过 |
| CN-medium | historical | 当前版：关闭 AI | complete | 2346 | 269.603 | 1.000 | 90.059 | 通过 |
| CN-medium | released | 2.1.3 框架版 | complete | 2346 | 383.106 | 1.162 | 91.926 | 通过 |
| CN-medium | released | 2.1.6 已发布版 | complete | 2346 | 326.513 | 0.990 | 92.543 | 通过 |
| CN-medium | released | 当前版：经典高起点 AI | complete | 2346 | 342.690 | 1.039 | 91.344 | 通过 |
| CN-medium | released | 当前版：关闭 AI | complete | 2346 | 329.803 | 1.000 | 91.422 | 通过 |
| CN-medium | models | 当前版：关闭 AI | complete | 2346 | 248.311 | 1.000 | 91.043 | 通过 |
| CN-medium | models | 当前版：经典高起点 AI | complete | 2346 | 304.417 | 1.226 | 91.492 | 通过 |
| CN-medium | models | 当前版：扩展策略 AI | complete | 2346 | 262.928 | 1.059 | 91.547 | 通过 |
| CN-medium | models | 当前版：大数据神经 AI | complete | 2346 | 259.874 | 1.047 | 92.566 | 通过 |
| JP-medium | historical | 2.0.0 原版 | complete | 2346 | 330.595 | 0.986 | 117.176 | 通过 |
| JP-medium | historical | 2.1.2 固定对照版 | complete | 2346 | 321.358 | 0.959 | 115.531 | 通过 |
| JP-medium | historical | 早期区间剪枝版 | complete | 2346 | 340.307 | 1.015 | 118.324 | 通过 |
| JP-medium | historical | 当前版：关闭 AI | complete | 2346 | 335.208 | 1.000 | 115.254 | 通过 |
| JP-medium | released | 2.1.3 框架版 | complete | 2346 | 879.614 | 1.087 | 117.262 | 通过 |
| JP-medium | released | 2.1.6 已发布版 | complete | 2346 | 900.184 | 1.112 | 118.105 | 通过 |
| JP-medium | released | 当前版：经典高起点 AI | complete | 2346 | 923.324 | 1.141 | 116.328 | 通过 |
| JP-medium | released | 当前版：关闭 AI | complete | 2346 | 809.298 | 1.000 | 116.000 | 通过 |
| JP-medium | models | 当前版：关闭 AI | complete | 2346 | 455.087 | 1.000 | 114.426 | 通过 |
| JP-medium | models | 当前版：经典高起点 AI | complete | 2346 | 510.409 | 1.122 | 116.430 | 通过 |
| JP-medium | models | 当前版：扩展策略 AI | complete | 2346 | 455.185 | 1.000 | 115.641 | 通过 |
| JP-medium | models | 当前版：大数据神经 AI | complete | 2346 | 459.883 | 1.011 | 117.086 | 通过 |
| CN-open | historical | 2.0.0 原版 | process-error | — | — | — | — | 未证明 |
| CN-open | historical | 2.1.2 固定对照版 | process-error | — | — | — | — | 未证明 |
| CN-open | historical | 早期区间剪枝版 | process-error | — | — | — | — | 未证明 |
| CN-open | historical | 当前版：关闭 AI | process-error | — | — | — | — | 未证明 |
| CN-open | released | 2.1.3 框架版 | process-error | — | — | — | — | 未证明 |
| CN-open | released | 2.1.6 已发布版 | process-error | — | — | — | — | 未证明 |
| CN-open | released | 当前版：经典高起点 AI | process-error | — | — | — | — | 未证明 |
| CN-open | released | 当前版：关闭 AI | process-error | — | — | — | — | 未证明 |
| CN-open | models | 当前版：关闭 AI | process-error | — | — | — | — | 未证明 |
| CN-open | models | 当前版：经典高起点 AI | process-error | — | — | — | — | 未证明 |
| CN-open | models | 当前版：扩展策略 AI | process-error | — | — | — | — | 未证明 |
| CN-open | models | 当前版：大数据神经 AI | complete | 7593 | 321244.734 | — | 824.699 | 未证明 |
| JP-open | historical | 2.0.0 原版 | process-error | — | — | — | — | 未证明 |
| JP-open | historical | 2.1.2 固定对照版 | process-error | — | — | — | — | 未证明 |
| JP-open | historical | 早期区间剪枝版 | process-error | — | — | — | — | 未证明 |
| JP-open | historical | 当前版：关闭 AI | process-error | — | — | — | — | 未证明 |
| JP-open | released | 2.1.3 框架版 | process-error | — | — | — | — | 未证明 |
| JP-open | released | 2.1.6 已发布版 | complete | 7593 | 60914.287 | — | 357.898 | 未证明 |
| JP-open | released | 当前版：经典高起点 AI | complete | 7593 | 61289.983 | — | 356.469 | 未证明 |
| JP-open | released | 当前版：关闭 AI | process-error | — | — | — | — | 未证明 |
| JP-open | models | 当前版：关闭 AI | process-error | — | — | — | — | 未证明 |
| JP-open | models | 当前版：经典高起点 AI | complete | 7593 | 57406.163 | — | 359.246 | 未证明 |
| JP-open | models | 当前版：扩展策略 AI | process-error | — | — | — | — | 未证明 |
| JP-open | models | 当前版：大数据神经 AI | complete | 7593 | 776898.647 | — | 913.250 | 未证明 |
| dense-zero | historical | 2.0.0 原版 | complete | 0 | 41.442 | 0.508 | 70.211 | 未证明 |
| dense-zero | historical | 2.1.2 固定对照版 | complete | 0 | 69.970 | 0.858 | 70.742 | 未证明 |
| dense-zero | historical | 早期区间剪枝版 | complete | 0 | 61.330 | 0.752 | 70.367 | 未证明 |
| dense-zero | historical | 当前版：关闭 AI | complete | 0 | 81.532 | 1.000 | 65.531 | 未证明 |
| dense-zero | released | 2.1.3 框架版 | complete | 0 | 65.459 | 0.665 | 70.539 | 未证明 |
| dense-zero | released | 2.1.6 已发布版 | complete | 0 | 69.464 | 0.706 | 70.734 | 未证明 |
| dense-zero | released | 当前版：经典高起点 AI | complete | 0 | 112.718 | 1.145 | 66.230 | 未证明 |
| dense-zero | released | 当前版：关闭 AI | complete | 0 | 98.403 | 1.000 | 65.531 | 未证明 |
| dense-zero | models | 当前版：关闭 AI | complete | 0 | 62.800 | 1.000 | 66.004 | 未证明 |
| dense-zero | models | 当前版：经典高起点 AI | complete | 0 | 61.238 | 0.975 | 66.246 | 未证明 |
| dense-zero | models | 当前版：扩展策略 AI | complete | 0 | 64.078 | 1.020 | 66.070 | 未证明 |
| dense-zero | models | 当前版：大数据神经 AI | complete | 0 | 64.993 | 1.035 | 66.266 | 未证明 |

## 固定版本

| 版本 | 提交 |
|---|---|
| 2.0.0 原版 | `6320a8ffd31c444fbc76a64e14e576f759e1de1c` |
| 2.1.2 固定对照版 | `13d8fa7ed273c0f86c2babd9b2b6bc9c78767519` |
| 早期区间剪枝版 | `0ae9b27aa91c1bd344e8392b996dc96c788de64c` |
| 2.1.3 框架版 | `10d13ee1214cd18288c971b1c87ec7e9c2d42dfd` |
| 2.1.6 已发布版 | `2d21ebd76b14139051af9f4dad9b926d6aad0577` |
| 当前版：关闭 AI | `8196a7c65d4b9f48f5460ffecb2fc8c7bc55dabe` |
| 当前版：经典高起点 AI | `8196a7c65d4b9f48f5460ffecb2fc8c7bc55dabe` |
| 当前版：扩展策略 AI | `8196a7c65d4b9f48f5460ffecb2fc8c7bc55dabe` |
| 当前版：大数据神经 AI | `8196a7c65d4b9f48f5460ffecb2fc8c7bc55dabe` |

## 最高分差异与目标范围

原生完成只表示该版本返回结果，不自动计为最优性验证通过。若完整枚举给出更高分，本表明确记录差异，并排除该格的性能优势排名。指定收益同时带锁定从者时，两个接口的目标范围不同，分值不可直接对照；同分枚举结果继续按原协议报告。

- pins-stock-aura/historical/v200：原生 4432，完整枚举 4570。
- pins-stock-aura/historical/v212：原生 4432，完整枚举 4570。
- pins-stock-aura/historical/interval：原生 4432，完整枚举 4570。
- pins-stock-aura/historical/current-off：原生 4432，完整枚举 4570。
- pins-stock-aura/released/v213：原生 4432，完整枚举 4570。
- pins-stock-aura/released/v216：原生 4432，完整枚举 4570。
- pins-stock-aura/released/current-baseline：原生 4432，完整枚举 4570。
- pins-stock-aura/released/current-off：原生 4432，完整枚举 4570。
- pins-stock-aura/models/current-off：原生 4432，完整枚举 4570。
- pins-stock-aura/models/current-baseline：原生 4432，完整枚举 4570。
- pins-stock-aura/models/current-teacher：原生 4432，完整枚举 4570。
- pins-stock-aura/models/current-neural-large：原生 4432，完整枚举 4570。
- CN-small/historical/v200：原生 2346，完整枚举 2424。
- CN-small/historical/v212：原生 2346，完整枚举 2424。
- CN-small/historical/interval：原生 2346，完整枚举 2424。
- CN-small/historical/current-off：原生 2346，完整枚举 2424。
- CN-small/released/v213：原生 2346，完整枚举 2424。
- CN-small/released/v216：原生 2346，完整枚举 2424。
- CN-small/released/current-baseline：原生 2346，完整枚举 2424。
- CN-small/released/current-off：原生 2346，完整枚举 2424。
- CN-small/models/current-off：原生 2346，完整枚举 2424。
- CN-small/models/current-baseline：原生 2346，完整枚举 2424。
- CN-small/models/current-teacher：原生 2346，完整枚举 2424。
- CN-small/models/current-neural-large：原生 2346，完整枚举 2424。
- JP-small/historical/v200：原生 2346，完整枚举 2424。
- JP-small/historical/v212：原生 2346，完整枚举 2424。
- JP-small/historical/interval：原生 2346，完整枚举 2424。
- JP-small/historical/current-off：原生 2346，完整枚举 2424。
- JP-small/released/v213：原生 2346，完整枚举 2424。
- JP-small/released/v216：原生 2346，完整枚举 2424。
- JP-small/released/current-baseline：原生 2346，完整枚举 2424。
- JP-small/released/current-off：原生 2346，完整枚举 2424。
- JP-small/models/current-off：原生 2346，完整枚举 2424。
- JP-small/models/current-baseline：原生 2346，完整枚举 2424。
- JP-small/models/current-teacher：原生 2346，完整枚举 2424。
- JP-small/models/current-neural-large：原生 2346，完整枚举 2424。

## 异常与范围

超时、进程错误、结果不一致全部保留。超时前上报分数与经过精确结算的可行分数分开记录；没有合法队伍检查点时不把上报数值当作解。旧版本的代表解、压缩替代成员或 plans 数量均不视为全部同分队伍数量。

测试包含条件命中、固定增量、无助战六人、指定收益、锁位/库存/满绊、活动、冠位、固定 NPC、国日服小中大账号及大量零分同分队伍。无额外低分队伍穷举，不保存逐队大档案。

- CN-open/historical: v200: 
<--- Last few GCs --->

[2753:0x17544000]   854744 ms: Scavenge 760.2 (767.0) -> 756.3 (767.0) MB, pooled: 0 MB, 0.36 / 0.00 ms  (average mu = 0.397, current mu = 0.406) allocation failure; 
[2753:0x17544000]   855227 ms: Mark-Compact (reduce) 756.6 (767.0) -> 752.1 (760.0) MB, pooled: 0 MB, 471.66 / 0.00 ms  (+ 1.8 ms in 5 steps since start of marking, biggest step 1.7 ms, walltime since start of marking 483 ms) (average mu = 0.386, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- CN-open/historical: v212: 
<--- Last few GCs --->

[2754:0x3e0e5000]   830677 ms: Scavenge 762.0 (768.5) -> 758.1 (768.5) MB, pooled: 0 MB, 0.54 / 0.00 ms  (average mu = 0.377, current mu = 0.383) allocation failure; 
[2754:0x3e0e5000]   831417 ms: Mark-Compact (reduce) 758.2 (768.5) -> 756.2 (761.5) MB, pooled: 0 MB, 725.03 / 0.00 ms  (+ 11.1 ms in 2 steps since start of marking, biggest step 10.9 ms, walltime since start of marking 740 ms) (average mu = 0.378, curren
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- CN-open/historical: interval: 
<--- Last few GCs --->

[2760:0x36c70000]   820111 ms: Scavenge 761.5 (768.0) -> 757.6 (768.0) MB, pooled: 0 MB, 3.06 / 0.00 ms  (average mu = 0.392, current mu = 0.390) allocation failure; 
[2760:0x36c70000]   820619 ms: Mark-Compact (reduce) 757.7 (768.0) -> 753.3 (761.0) MB, pooled: 0 MB, 494.14 / 0.00 ms  (+ 3.6 ms in 1 steps since start of marking, biggest step 3.6 ms, walltime since start of marking 508 ms) (average mu = 0.390, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- CN-open/historical: current-off: 
<--- Last few GCs --->

[2761:0x2ead8000]   764826 ms: Scavenge 764.9 (769.0) -> 763.0 (773.0) MB, pooled: 0 MB, 0.67 / 0.00 ms  (average mu = 0.373, current mu = 0.366) allocation failure; 
[2761:0x2ead8000]   765597 ms: Mark-Compact (reduce) 763.0 (773.0) -> 762.3 (766.0) MB, pooled: 0 MB, 755.16 / 0.00 ms  (+ 2.6 ms in 1 steps since start of marking, biggest step 2.6 ms, walltime since start of marking 771 ms) (average mu = 0.369, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed CN-open/v200: 
<--- Last few GCs --->

[2753:0x17544000]   854744 ms: Scavenge 760.2 (767.0) -> 756.3 (767.0) MB, pooled: 0 MB, 0.36 / 0.00 ms  (average mu = 0.397, current mu = 0.406) allocation failure; 
[2753:0x17544000]   855227 ms: Mark-Compact (reduce) 756.6 (767.0) -> 752.1 (760.0) MB, pooled: 0 MB, 471.66 / 0.00 ms  (+ 1.8 ms in 5 steps since start of marking, biggest step 1.7 ms, walltime since start of marking 483 ms) (average mu = 0.386, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed CN-open/v212: 
<--- Last few GCs --->

[2754:0x3e0e5000]   830677 ms: Scavenge 762.0 (768.5) -> 758.1 (768.5) MB, pooled: 0 MB, 0.54 / 0.00 ms  (average mu = 0.377, current mu = 0.383) allocation failure; 
[2754:0x3e0e5000]   831417 ms: Mark-Compact (reduce) 758.2 (768.5) -> 756.2 (761.5) MB, pooled: 0 MB, 725.03 / 0.00 ms  (+ 11.1 ms in 2 steps since start of marking, biggest step 10.9 ms, walltime since start of marking 740 ms) (average mu = 0.378, curren
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed CN-open/interval: 
<--- Last few GCs --->

[2760:0x36c70000]   820111 ms: Scavenge 761.5 (768.0) -> 757.6 (768.0) MB, pooled: 0 MB, 3.06 / 0.00 ms  (average mu = 0.392, current mu = 0.390) allocation failure; 
[2760:0x36c70000]   820619 ms: Mark-Compact (reduce) 757.7 (768.0) -> 753.3 (761.0) MB, pooled: 0 MB, 494.14 / 0.00 ms  (+ 3.6 ms in 1 steps since start of marking, biggest step 3.6 ms, walltime since start of marking 508 ms) (average mu = 0.390, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed CN-open/current-off: 
<--- Last few GCs --->

[2761:0x2ead8000]   764826 ms: Scavenge 764.9 (769.0) -> 763.0 (773.0) MB, pooled: 0 MB, 0.67 / 0.00 ms  (average mu = 0.373, current mu = 0.366) allocation failure; 
[2761:0x2ead8000]   765597 ms: Mark-Compact (reduce) 763.0 (773.0) -> 762.3 (766.0) MB, pooled: 0 MB, 755.16 / 0.00 ms  (+ 2.6 ms in 1 steps since start of marking, biggest step 2.6 ms, walltime since start of marking 771 ms) (average mu = 0.369, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- CN-open/released: v213: 
<--- Last few GCs --->

[2866:0x41d33000]   917948 ms: Scavenge 759.2 (766.0) -> 755.3 (766.0) MB, pooled: 0 MB, 0.48 / 0.00 ms  (average mu = 0.392, current mu = 0.393) allocation failure; 
[2866:0x41d33000]   918709 ms: Mark-Compact (reduce) 755.4 (766.0) -> 750.8 (759.0) MB, pooled: 0 MB, 745.30 / 0.00 ms  (+ 9.8 ms in 1 steps since start of marking, biggest step 9.8 ms, walltime since start of marking 761 ms) (average mu = 0.393, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- CN-open/released: v216: 
<--- Last few GCs --->

[2867:0x17212000]   926939 ms: Scavenge 760.4 (767.2) -> 756.5 (767.2) MB, pooled: 0 MB, 0.35 / 0.00 ms  (average mu = 0.399, current mu = 0.401) allocation failure; 
[2867:0x17212000]   927410 ms: Mark-Compact (reduce) 759.4 (767.2) -> 753.2 (760.2) MB, pooled: 0 MB, 457.08 / 0.00 ms  (+ 8.6 ms in 1 steps since start of marking, biggest step 8.6 ms, walltime since start of marking 469 ms) (average mu = 0.381, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- CN-open/released: current-baseline: 
<--- Last few GCs --->

[2868:0x44040000]   890189 ms: Scavenge 759.8 (766.7) -> 755.9 (766.7) MB, pooled: 0 MB, 0.51 / 0.00 ms  (average mu = 0.379, current mu = 0.365) allocation failure; 
[2868:0x44040000]   890698 ms: Mark-Compact (reduce) 759.2 (766.7) -> 752.1 (759.7) MB, pooled: 0 MB, 495.48 / 0.00 ms  (+ 1.6 ms in 3 steps since start of marking, biggest step 1.6 ms, walltime since start of marking 507 ms) (average mu = 0.394, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- CN-open/released: current-off: 
<--- Last few GCs --->

[2874:0x2ee18000]   824963 ms: Scavenge 761.8 (768.2) -> 757.8 (768.2) MB, pooled: 0 MB, 0.46 / 0.00 ms  (average mu = 0.386, current mu = 0.384) allocation failure; 
[2874:0x2ee18000]   825751 ms: Mark-Compact (reduce) 758.0 (768.2) -> 755.8 (761.2) MB, pooled: 0 MB, 771.85 / 0.00 ms  (+ 13.0 ms in 2 steps since start of marking, biggest step 12.9 ms, walltime since start of marking 788 ms) (average mu = 0.376, curren
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/v213: 
<--- Last few GCs --->

[2866:0x41d33000]   917948 ms: Scavenge 759.2 (766.0) -> 755.3 (766.0) MB, pooled: 0 MB, 0.48 / 0.00 ms  (average mu = 0.392, current mu = 0.393) allocation failure; 
[2866:0x41d33000]   918709 ms: Mark-Compact (reduce) 755.4 (766.0) -> 750.8 (759.0) MB, pooled: 0 MB, 745.30 / 0.00 ms  (+ 9.8 ms in 1 steps since start of marking, biggest step 9.8 ms, walltime since start of marking 761 ms) (average mu = 0.393, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/v216: 
<--- Last few GCs --->

[2867:0x17212000]   926939 ms: Scavenge 760.4 (767.2) -> 756.5 (767.2) MB, pooled: 0 MB, 0.35 / 0.00 ms  (average mu = 0.399, current mu = 0.401) allocation failure; 
[2867:0x17212000]   927410 ms: Mark-Compact (reduce) 759.4 (767.2) -> 753.2 (760.2) MB, pooled: 0 MB, 457.08 / 0.00 ms  (+ 8.6 ms in 1 steps since start of marking, biggest step 8.6 ms, walltime since start of marking 469 ms) (average mu = 0.381, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/current-baseline: 
<--- Last few GCs --->

[2868:0x44040000]   890189 ms: Scavenge 759.8 (766.7) -> 755.9 (766.7) MB, pooled: 0 MB, 0.51 / 0.00 ms  (average mu = 0.379, current mu = 0.365) allocation failure; 
[2868:0x44040000]   890698 ms: Mark-Compact (reduce) 759.2 (766.7) -> 752.1 (759.7) MB, pooled: 0 MB, 495.48 / 0.00 ms  (+ 1.6 ms in 3 steps since start of marking, biggest step 1.6 ms, walltime since start of marking 507 ms) (average mu = 0.394, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/current-off: 
<--- Last few GCs --->

[2874:0x2ee18000]   824963 ms: Scavenge 761.8 (768.2) -> 757.8 (768.2) MB, pooled: 0 MB, 0.46 / 0.00 ms  (average mu = 0.386, current mu = 0.384) allocation failure; 
[2874:0x2ee18000]   825751 ms: Mark-Compact (reduce) 758.0 (768.2) -> 755.8 (761.2) MB, pooled: 0 MB, 771.85 / 0.00 ms  (+ 13.0 ms in 2 steps since start of marking, biggest step 12.9 ms, walltime since start of marking 788 ms) (average mu = 0.376, curren
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- CN-open/models: current-off: 
<--- Last few GCs --->

[2256:0xac97000]   642336 ms: Scavenge 760.0 (766.7) -> 756.1 (766.7) MB, pooled: 0 MB, 0.29 / 0.00 ms  (average mu = 0.391, current mu = 0.392) allocation failure; 
[2256:0xac97000]   642781 ms: Mark-Compact (reduce) 757.5 (766.7) -> 751.9 (759.7) MB, pooled: 0 MB, 434.31 / 0.00 ms  (+ 2.2 ms in 21 steps since start of marking, biggest step 1.5 ms, walltime since start of marking 445 ms) (average mu = 0.395, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- CN-open/models: current-baseline: 
<--- Last few GCs --->

[2257:0x2b94b000]   568815 ms: Scavenge 765.7 (769.5) -> 763.7 (769.5) MB, pooled: 0 MB, 0.32 / 0.00 ms  (average mu = 0.385, current mu = 0.374) allocation failure; 
[2257:0x2b94b000]   569442 ms: Mark-Compact (reduce) 763.8 (769.5) -> 762.2 (766.2) MB, pooled: 0 MB, 612.90 / 0.00 ms  (+ 4.5 ms in 1 steps since start of marking, biggest step 4.5 ms, walltime since start of marking 627 ms) (average mu = 0.345, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- CN-open/models: current-teacher: 
<--- Last few GCs --->

[2258:0x34bcc000]   600649 ms: Scavenge 760.5 (767.2) -> 756.6 (767.2) MB, pooled: 0 MB, 0.31 / 0.00 ms  (average mu = 0.382, current mu = 0.388) allocation failure; 
[2258:0x34bcc000]   601120 ms: Mark-Compact (reduce) 756.9 (767.2) -> 753.1 (760.2) MB, pooled: 0 MB, 461.54 / 0.00 ms  (+ 1.8 ms in 5 steps since start of marking, biggest step 1.2 ms, walltime since start of marking 471 ms) (average mu = 0.367, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/current-off: 
<--- Last few GCs --->

[2256:0xac97000]   642336 ms: Scavenge 760.0 (766.7) -> 756.1 (766.7) MB, pooled: 0 MB, 0.29 / 0.00 ms  (average mu = 0.391, current mu = 0.392) allocation failure; 
[2256:0xac97000]   642781 ms: Mark-Compact (reduce) 757.5 (766.7) -> 751.9 (759.7) MB, pooled: 0 MB, 434.31 / 0.00 ms  (+ 2.2 ms in 21 steps since start of marking, biggest step 1.5 ms, walltime since start of marking 445 ms) (average mu = 0.395, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/current-baseline: 
<--- Last few GCs --->

[2257:0x2b94b000]   568815 ms: Scavenge 765.7 (769.5) -> 763.7 (769.5) MB, pooled: 0 MB, 0.32 / 0.00 ms  (average mu = 0.385, current mu = 0.374) allocation failure; 
[2257:0x2b94b000]   569442 ms: Mark-Compact (reduce) 763.8 (769.5) -> 762.2 (766.2) MB, pooled: 0 MB, 612.90 / 0.00 ms  (+ 4.5 ms in 1 steps since start of marking, biggest step 4.5 ms, walltime since start of marking 627 ms) (average mu = 0.345, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed CN-open/current-teacher: 
<--- Last few GCs --->

[2258:0x34bcc000]   600649 ms: Scavenge 760.5 (767.2) -> 756.6 (767.2) MB, pooled: 0 MB, 0.31 / 0.00 ms  (average mu = 0.382, current mu = 0.388) allocation failure; 
[2258:0x34bcc000]   601120 ms: Mark-Compact (reduce) 756.9 (767.2) -> 753.1 (760.2) MB, pooled: 0 MB, 461.54 / 0.00 ms  (+ 1.8 ms in 5 steps since start of marking, biggest step 1.2 ms, walltime since start of marking 471 ms) (average mu = 0.367, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- JP-open/historical: v200: 
<--- Last few GCs --->

[2962:0x2eb54000]  1236738 ms: Scavenge 764.5 (769.3) -> 762.5 (769.3) MB, pooled: 0 MB, 0.47 / 0.00 ms  (average mu = 0.387, current mu = 0.389) allocation failure; 
[2962:0x2eb54000]  1237595 ms: Mark-Compact (reduce) 762.8 (769.3) -> 761.2 (766.3) MB, pooled: 0 MB, 836.76 / 0.00 ms  (+ 15.3 ms in 3 steps since start of marking, biggest step 8.6 ms, walltime since start of marking 856 ms) (average mu = 0.382, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- JP-open/historical: v212: 
<--- Last few GCs --->

[2963:0x358b2000]  1184730 ms: Scavenge 761.4 (766.2) -> 759.4 (770.2) MB, pooled: 0 MB, 0.71 / 0.00 ms  (average mu = 0.399, current mu = 0.398) allocation failure; 
[2963:0x358b2000]  1185561 ms: Mark-Compact (reduce) 759.6 (770.2) -> 756.8 (763.2) MB, pooled: 0 MB, 813.45 / 0.00 ms  (+ 13.0 ms in 2 steps since start of marking, biggest step 9.9 ms, walltime since start of marking 831 ms) (average mu = 0.395, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- JP-open/historical: interval: 
<--- Last few GCs --->

[2969:0x3f841000]  1207391 ms: Scavenge 763.8 (768.7) -> 761.8 (768.7) MB, pooled: 0 MB, 0.25 / 0.00 ms  (average mu = 0.400, current mu = 0.409) allocation failure; 
[2969:0x3f841000]  1207919 ms: Mark-Compact (reduce) 762.5 (768.7) -> 759.8 (765.7) MB, pooled: 0 MB, 515.35 / 0.00 ms  (+ 9.3 ms in 11 steps since start of marking, biggest step 7.1 ms, walltime since start of marking 528 ms) (average mu = 0.374, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- JP-open/historical: current-off: 
<--- Last few GCs --->

[2970:0x2db88000]  1352450 ms: Scavenge 759.6 (767.5) -> 755.7 (767.5) MB, pooled: 0 MB, 0.47 / 0.00 ms  (average mu = 0.385, current mu = 0.370) allocation failure; 
[2970:0x2db88000]  1352966 ms: Mark-Compact (reduce) 755.8 (767.5) -> 751.4 (760.5) MB, pooled: 0 MB, 504.15 / 0.00 ms  (+ 8.6 ms in 2 steps since start of marking, biggest step 7.6 ms, walltime since start of marking 516 ms) (average mu = 0.373, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed JP-open/v200: 
<--- Last few GCs --->

[2962:0x2eb54000]  1236738 ms: Scavenge 764.5 (769.3) -> 762.5 (769.3) MB, pooled: 0 MB, 0.47 / 0.00 ms  (average mu = 0.387, current mu = 0.389) allocation failure; 
[2962:0x2eb54000]  1237595 ms: Mark-Compact (reduce) 762.8 (769.3) -> 761.2 (766.3) MB, pooled: 0 MB, 836.76 / 0.00 ms  (+ 15.3 ms in 3 steps since start of marking, biggest step 8.6 ms, walltime since start of marking 856 ms) (average mu = 0.382, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed JP-open/v212: 
<--- Last few GCs --->

[2963:0x358b2000]  1184730 ms: Scavenge 761.4 (766.2) -> 759.4 (770.2) MB, pooled: 0 MB, 0.71 / 0.00 ms  (average mu = 0.399, current mu = 0.398) allocation failure; 
[2963:0x358b2000]  1185561 ms: Mark-Compact (reduce) 759.6 (770.2) -> 756.8 (763.2) MB, pooled: 0 MB, 813.45 / 0.00 ms  (+ 13.0 ms in 2 steps since start of marking, biggest step 9.9 ms, walltime since start of marking 831 ms) (average mu = 0.395, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed JP-open/interval: 
<--- Last few GCs --->

[2969:0x3f841000]  1207391 ms: Scavenge 763.8 (768.7) -> 761.8 (768.7) MB, pooled: 0 MB, 0.25 / 0.00 ms  (average mu = 0.400, current mu = 0.409) allocation failure; 
[2969:0x3f841000]  1207919 ms: Mark-Compact (reduce) 762.5 (768.7) -> 759.8 (765.7) MB, pooled: 0 MB, 515.35 / 0.00 ms  (+ 9.3 ms in 11 steps since start of marking, biggest step 7.1 ms, walltime since start of marking 528 ms) (average mu = 0.374, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- Query failed JP-open/current-off: 
<--- Last few GCs --->

[2970:0x2db88000]  1352450 ms: Scavenge 759.6 (767.5) -> 755.7 (767.5) MB, pooled: 0 MB, 0.47 / 0.00 ms  (average mu = 0.385, current mu = 0.370) allocation failure; 
[2970:0x2db88000]  1352966 ms: Mark-Compact (reduce) 755.8 (767.5) -> 751.4 (760.5) MB, pooled: 0 MB, 504.15 / 0.00 ms  (+ 8.6 ms in 2 steps since start of marking, biggest step 7.6 ms, walltime since start of marking 516 ms) (average mu = 0.373, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x942e80  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 2: 0x75f71e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 3: 0xc98c20  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 4: 0xc98d0f  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 5: 0xf3c5e5  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 6: 0xf3c612  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 7: 0xf3c90a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 8: 0xf4d60a  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
 9: 0xf519b0  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]
10: 0x19ef441  [/opt/hostedtoolcache/node/24.22.0/x64/bin/node]

- JP-open/released: v213: 
<--- Last few GCs --->

[2626:0x22234000]  1207165 ms: Scavenge 764.0 (768.7) -> 762.0 (773.0) MB, pooled: 0 MB, 0.60 / 0.00 ms  (average mu = 0.376, current mu = 0.380) allocation failure; 
[2626:0x22234000]  1207962 ms: Mark-Compact (reduce) 762.1 (773.0) -> 760.2 (766.0) MB, pooled: 0 MB, 779.78 / 0.00 ms  (+ 10.6 ms in 2 steps since start of marking, biggest step 9.9 ms, walltime since start of marking 797 ms) (average mu = 0.381, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- JP-open/released: current-off: 
<--- Last few GCs --->

[2634:0x39b6e000]  1215703 ms: Scavenge 764.5 (769.5) -> 762.5 (769.5) MB, pooled: 0 MB, 0.16 / 0.00 ms  (average mu = 0.380, current mu = 0.371) allocation failure; 
[2634:0x39b6e000]  1216195 ms: Mark-Compact (reduce) 763.1 (769.5) -> 761.3 (766.5) MB, pooled: 0 MB, 480.61 / 0.00 ms  (+ 2.5 ms in 10 steps since start of marking, biggest step 2.2 ms, walltime since start of marking 492 ms) (average mu = 0.376, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed JP-open/v213: 
<--- Last few GCs --->

[2626:0x22234000]  1207165 ms: Scavenge 764.0 (768.7) -> 762.0 (773.0) MB, pooled: 0 MB, 0.60 / 0.00 ms  (average mu = 0.376, current mu = 0.380) allocation failure; 
[2626:0x22234000]  1207962 ms: Mark-Compact (reduce) 762.1 (773.0) -> 760.2 (766.0) MB, pooled: 0 MB, 779.78 / 0.00 ms  (+ 10.6 ms in 2 steps since start of marking, biggest step 9.9 ms, walltime since start of marking 797 ms) (average mu = 0.381, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed JP-open/current-off: 
<--- Last few GCs --->

[2634:0x39b6e000]  1215703 ms: Scavenge 764.5 (769.5) -> 762.5 (769.5) MB, pooled: 0 MB, 0.16 / 0.00 ms  (average mu = 0.380, current mu = 0.371) allocation failure; 
[2634:0x39b6e000]  1216195 ms: Mark-Compact (reduce) 763.1 (769.5) -> 761.3 (766.5) MB, pooled: 0 MB, 480.61 / 0.00 ms  (+ 2.5 ms in 10 steps since start of marking, biggest step 2.2 ms, walltime since start of marking 492 ms) (average mu = 0.376, current
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- JP-open/models: current-off: 
<--- Last few GCs --->

[2450:0x2be36000]  1009324 ms: Scavenge 765.0 (770.0) -> 763.1 (770.0) MB, pooled: 0 MB, 0.23 / 0.00 ms  (average mu = 0.378, current mu = 0.430) allocation failure; 
[2450:0x2be36000]  1009788 ms: Mark-Compact (reduce) 763.1 (770.0) -> 761.9 (767.0) MB, pooled: 0 MB, 454.88 / 0.00 ms  (+ 3.3 ms in 1 steps since start of marking, biggest step 3.3 ms, walltime since start of marking 464 ms) (average mu = 0.398, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- JP-open/models: current-teacher: 
<--- Last few GCs --->

[2452:0x3e849000]   809557 ms: Scavenge 764.0 (769.7) -> 762.0 (769.7) MB, pooled: 0 MB, 0.28 / 0.00 ms  (average mu = 0.375, current mu = 0.424) allocation failure; 
[2452:0x3e849000]   809991 ms: Mark-Compact (reduce) 764.1 (770.0) -> 760.1 (766.7) MB, pooled: 0 MB, 426.80 / 0.00 ms  (+ 1.6 ms in 6 steps since start of marking, biggest step 1.4 ms, walltime since start of marking 432 ms) (average mu = 0.397, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed JP-open/current-off: 
<--- Last few GCs --->

[2450:0x2be36000]  1009324 ms: Scavenge 765.0 (770.0) -> 763.1 (770.0) MB, pooled: 0 MB, 0.23 / 0.00 ms  (average mu = 0.378, current mu = 0.430) allocation failure; 
[2450:0x2be36000]  1009788 ms: Mark-Compact (reduce) 763.1 (770.0) -> 761.9 (767.0) MB, pooled: 0 MB, 454.88 / 0.00 ms  (+ 3.3 ms in 1 steps since start of marking, biggest step 3.3 ms, walltime since start of marking 464 ms) (average mu = 0.398, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]

- Query failed JP-open/current-teacher: 
<--- Last few GCs --->

[2452:0x3e849000]   809557 ms: Scavenge 764.0 (769.7) -> 762.0 (769.7) MB, pooled: 0 MB, 0.28 / 0.00 ms  (average mu = 0.375, current mu = 0.424) allocation failure; 
[2452:0x3e849000]   809991 ms: Mark-Compact (reduce) 764.1 (770.0) -> 760.1 (766.7) MB, pooled: 0 MB, 426.80 / 0.00 ms  (+ 1.6 ms in 6 steps since start of marking, biggest step 1.4 ms, walltime since start of marking 432 ms) (average mu = 0.397, current 
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0x931db0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 2: 0x75968e node::OOMErrorHandler(char const*, v8::OOMDetails const&) [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 3: 0xc70d60  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 4: 0xc70e4f  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 5: 0xf14725  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 6: 0xf14752  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 7: 0xf14a4a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 8: 0xf2574a  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
 9: 0xf29af0  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]
10: 0x19c77d1  [/opt/hostedtoolcache/node/24.21.0/x64/bin/node]


- [完整数值和全部同机对照](report.json)
- [原始记录、检查点与来源指纹](cells/)
