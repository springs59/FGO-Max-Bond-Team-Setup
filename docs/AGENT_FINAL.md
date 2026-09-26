# Agent Final

执行包：`FGO_Max_Bond_Agent_Final.zip`（不要进 git）。允许改框架；每完成可运行一片就 git push。公式与 `assemblePlan` / `calcParty` / `comparePlans` 仍是真值。

## P0 审计（基线）

- 数据层：`src/data/*.json` 日更 snapshot；页面不拉 Atlas 整包。
- 活动：`src/bond/activity.js` + `src/bond/bonus.js`；`bond-bonuses.json` extraPassive / questFriendship。
- Solver：Optimized `src/recommend.js`，Reference `src/reference-solver.js`，候选 Index v2 `src/solver/`。
- 旧 Index 是候选/命中表，不枚举最终队伍。
- Top-N 现为 100（`TOP_N`），一次搜索返回。
- Battle/周回本轮冻结。

## 落地

- P1 Reference：`src/solver/reference/index.js` 转发已有基准。
- P3 BondEffect：`src/rules/`；`generated/current-activity.json`、`generated/activity-bond-index.json`。
- P5 fingerprint：`scripts/fingerprint-manifest.mjs`；无变化不 commit。
- P6 Solution Index：`src/solver/solution-index.js`、`generated/solution-index.json`。queryKey = 职阶 + 关卡类型 + 助战 + eventId。lookup 后按账号/钉选/筛选过滤，空结果再跑 Optimized；hydrate 后 `calcParty`。
- P7 图片映射：`src/assets/`、`generated/image-index.json`（URL，不存原图）。
- P8/P9：`src/ui/detail-panel.js` 原地详情。主栏单列；PC 打开详情才侧栏，平板悬浮、手机底栏。

## 验收未完成

- Action 全量预计算覆盖修炼场 7 职阶、宝物库、当前限时活动 overlay；耗时取决于 runner，失败时保留上一版。
- 设备实机触摸抽检需在 Pages 预览确认。
