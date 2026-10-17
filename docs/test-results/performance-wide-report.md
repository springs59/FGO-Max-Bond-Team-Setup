# 四固定版本性能对照

2026-10-17：用户授权将 `feat/seed-shortcut-team-workspace` 合入 main，并把本次合并版本一同加入详细性能报告。

| 测试名称 | 固定源码 | AI |
|---|---|---|
| 2.0.0 | `6320a8ffd31c444fbc76a64e14e576f759e1de1c` | 不适用 |
| 2.1.2 | `13d8fa7ed273c0f86c2babd9b2b6bc9c78767519` | 开启 |
| 2.1-interval | `0ae9b27aa91c1bd344e8392b996dc96c788de64c` | 开启 |
| 2.1-workspace | 本次合入 main 的提交；作业实际 checkout 的 SHA 写入原始结果 | 开启 |

新增版本包含保持原下界质量的起点提前结束、独立队伍对比入口、推荐加入、复制和自由编辑。本表登记测试范围，不表示已证明提速。

四版重新在同一个 runner 上逐条件配对，132 个核心／完整请求条件，各版 5 轮正式测量及 1 轮排除的预热，轮换版本顺序。所有版本使用相同输入，并记录输入 SHA-256。不设单次求解超时或慢例排除；GitHub 作业本身的六小时平台上限仍存在，未完成项必须保留。

另有 12 个真实 Chromium 条件，各版 3 轮，共 144 组，分别记录首次请求、原地重复、重启 Worker、改变基数、IndexedDB／OPFS 及缓存命中。核心计时不包含对比界面人工编辑，浏览器 Worker 计时也不等于手机实测。

工作流 `Four-version performance comparison` 在本次合入 main 后触发。结果收集工作流会将实际源码 SHA、逐条件耗时、正确性、AI 推理与起点核实开销、存储观察及未完成项写回本报告。完成前不发布整体速度结论。

[原三版性能报告及正在进行的测试](https://github.com/springs59/FGO-Max-Bond-Team-Setup/blob/test/performance-200-21-wide/docs/test-results/performance-wide-report.md) 单独保留；旧结果不会冒充新增版本的测量。
