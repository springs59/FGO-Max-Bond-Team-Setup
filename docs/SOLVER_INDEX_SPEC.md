# Solver Index Spec

Solver Index 是 Action 预计算结果与浏览器动态查询之间的中间层。浏览器默认路径是 Query → Index → Filter → 小规模精确 BnB。Index 只缩小候选；最终答案仍走 `assemblePlan()` / `calcParty()`。

## 数据流

snapshot → normalize → validate → activity extraction → Servant/CE/Quest/Bonus Index → Candidate Index → solver-index.json → validate → publish

任一步失败：不覆盖已发布的 `solver-index.json` / `solver-meta.json`。

## 产物

- `src/data/solver-index.json` schemaVersion 2
- `src/data/solver-meta.json`：sourceVersion、generatedAt、schemaVersion、checksum、buildDurationMs

Index 不含账号字段（bondLevels、owned、mlbCount 等）。

## 结构

- Servant Index：id、职阶、extra 组、COST、灵基 trait sig
- CE Index：羁绊礼装、`kinds`（bond20 / bond15 / bond / tea / bondEquip / portrait）
- Quest Index：questId、kind、questType、questClass、eventId、开关窗、available
- Bonus Index：当前时间窗内的 self/party extraPassive、questFriendship、events
- Candidate Index：`byClass` / `byExtra` / `byCeKind` / `costBuckets` / `byQuestKind` / `byBonusSelf` / `byBonusParty`
- `condHits`：条件礼装 × 灵基 trait 命中表

Candidate Index 不枚举最终队伍。

## Query

`querySolverIndex` / `applyIndexQuery` 支持：questClass、questType、owned、lock、CE 集合。账号羁绊等级与 COST 可行性仍在精确求解阶段处理。

`solverAudit.index === false` 关闭 Index（含 milli 表），走全量实时计算。`solverAudit.skipIndexFilter === true` 保留 milli 表、跳过候选过滤。

## 精确性

Index 不得用近似排序替代最终结果。BnB 保留，作为 Action 回归与 benchmark 基准。

## 构建

```bash
npm run build-solver-index
npm run validate-solver-index
npm run benchmark
```

统一入口 `scripts/build-solver-index.mjs` 调度 `build-servant-index.mjs`、`build-ce-index.mjs`、`build-quest-index.mjs`、`build-bond-bonus-index.mjs`。校验失败则 `exit 1`，不 rename 发布文件。
