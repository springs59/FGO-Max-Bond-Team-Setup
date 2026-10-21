# 三款可选 AI 发布验证：2.1.5 预检与 2.1.6 正式构建（2026-10-21）

## 发布内容

四个选项为“不使用 AI”“经典高起点 AI（H）”“扩展策略 AI（T）”“大数据神经 AI（N8192）”，默认关闭。仅启用所选模型，每次新查询最多推理一次，缓存命中为零次。三款权重均内置，最终结果由精确求解器验证。

## 已完成验证

- 本地完整 npm test：78 项命令通过；原生版本脚本 8 项通过，目标 2.1.5 / Android versionCode 22。
- 真实 Worker 验证三款模型的结果、单次推理、缓存隔离、设置迁移及更新/恢复后的选择保留。
- 打包 native/site 后运行真实浏览器检查：四个选项、功能说明、选择持久化、AI 更新及恢复均通过；320、390、834、1440 像素宽度通过。
- 云端源码提交 9dfbc212c67f09a72d1156f2248ff74d799234bb 的 CI 三项任务全部通过：[CI 日志](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39536249690)。
- 此文记录源代码与本地验证；Windows/Android 安装包的最终构建及签名验收以正式发布工作流为准。

## 保留的起点退化

原跨版本性能任务并非全部通过：[原失败运行](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39536249627) 使用历史基线 0ae9b27aa91c1bd344e8392b996dc96c788de64c，在 synthetic-7300017 发现初始下界低于旧框架，严格断言失败。该失败及其 [部分原始记录](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39536249627/artifacts/12317945737) 保留。

另行本地完整对照使用公开提交 2fb7ef9009c4f3c1f7fc27b1d8797f9d748222eb 的旧框架有效源码（本地重建目录的 metadata commit 不代表完整源码快照），64 个条件、每条件 2 轮、offset 7300000，并保留全部助战替代方案。45 个条件存在可行解；64 个条件的最终收益、COST 和全部助战/位置最优结果均一致。7 个条件起点收益下降，等收益 COST 与覆盖范围未出现退化：

| 条件 | 旧起点 | 新起点 |
|---|---:|---:|
| synthetic-7300017 | 658 | 656 |
| synthetic-7300032 | 449 | 446 |
| catalog-7300039 | 37868 | 37439 |
| synthetic-7300043 | 2994 | 2967 |
| synthetic-7300050 | 6931 | 6740 |
| catalog-7300051 | 3816 | 3727 |
| synthetic-7300058 | 18886 | 18506 |

原始记录：[ai-three-models-local-comparison.json.gz](ai-three-models-local-comparison.json.gz)。本地与云端基线不同，不能混合绝对耗时；本地两轮测量也不足以推出普遍速度优势。

## 对照与回归的验收区分

check-ai-lower-bound.mjs 默认仍为 strict，保留原有起点收益、等收益 COST、覆盖范围的严格非退化断言。固定策略自对照通过；相同 64 条件的严格跨模型对照仍在 synthetic-7300017 正确失败。

历史模型对照任务显式使用 FGO_LB_INITIAL_MODE=compare-models，完整记录每轮起点升降，严格核对最终答案、助战/位置最优结果、起点可行范围和新模型最多一次推理。报告独立给出 exactResultsPassed 和 initialBoundsNonRegressing；compare-models 的 passed 不代表起点全部改善。此次调整没有修改运行时求解器或模型权重。

## 云端完整历史对照补充

[完整运行 39537270935](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39537270935) 的回归、浏览器与历史对照三项任务均通过。历史基线为 0ae9b27aa91c1bd344e8392b996dc96c788de64c，64 条件、5 轮，45 条件可行，最终收益/COST 与全部助战位置最优一致；7 条件初始收益下降。报告明确标记 initialBoundsNonRegressing=false。

耗时按各条件轮次中位数聚合：旧版总和 3848.11 ms，新版 3263.79 ms（总和降低约 15.2%）；逐条件耗时比值中位数 1.258，仅 20/64 条件更快。这说明收益集中在部分较重条件，不能宣称普遍提速。该对照衡量默认经典高起点策略与旧框架的整体变化，不能代表三款模型在所有输入下的排名。

[云端原始完整记录](ai-three-models-cloud-comparison.json.gz) 随仓库保留；另有 [原始 Actions 附件](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39537270935/artifacts/12318222127)。

## 首次安装包构建与恢复检查修正

首次发布尝试 [39537432829](https://github.com/springs59/FGO-Max-Bond-Team-Setup/actions/runs/39537432829) 的 Windows 全部通过，Android 六项运行测试中一项恢复检查失败，未签名、未公开 2.1.5。失败记录保留。

检查发现：测试调用 openBrowser() 后立即向初始 about:blank 注入读取脚本，但 index.html 的异步导航可能随后覆盖脚本。改为先等待重建页面 complete 且主应用控件出现，再执行原有缓存读取断言；没有修改实际缓存、页面恢复或求解器逻辑，也没有移除任何保存结果的断言。修正是否有效由新的完整模拟器任务验证。

下一次正式构建顺延为 2.1.6 / Android versionCode 23，保留失败运行序号 22，不复用或重置升级序号。

正式发布已完成，最终安装包与验收记录见 [2.1.6 发布报告](ai-three-models-2.1.6.md)。
