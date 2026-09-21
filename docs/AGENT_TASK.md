# Agent Task

现行文档：`PRODUCT_SPEC.md` / `SOLVER_SPEC.md` / `AGENT_TASK.md` / `CORRECTNESS_REPORT.md` / `BATTLE_SPEC.md`。

公式权威：`docs/SOLVER_SPEC.md` 与 `.monkeycode/MEMORY.md` 公式块。后写清单、旧 report、deepseek 稿与公式冲突时，以公式原文为准。

`FGO_配队计算器_AI_Agent实施说明书.docx` 与执行书 markdown 不要进 git。

## Priority

CORRECTNESS > PERFORMANCE。无法证明安全的优化标 `UNPROVEN`。禁止性能剪枝、大规模重构、改公式。

保留：最大羁绊、账号/自由、助战、Grand、COST、15绊、站位钉住。

## Read first

1. `docs/SOLVER_SPEC.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/BATTLE_SPEC.md`
4. `docs/CORRECTNESS_REPORT.md`
5. `src/recommend.js` / `src/bond.js` / `src/reference-solver.js` / `src/bond-oracle.js`

标了 historical 的文件只作考古，不覆盖现行规则。

historical：`deepseek_markdown.md`、`FGO_Solver_AI_验证与疑问清单.md`、`FGO_Solver_Correctness_Report.md`、`.monkeycode/docs/*`、`docs/solver-audit/*`、执行书 markdown。`.monkeycode/specs/` 是已落地功能的当时需求，以代码与现行五份文档为准。

## Execution order

1. 读代码
2. 确认 `main` / 工作区
3. 建立数据流
4. 检查 `npm test` gate
5. 独立 Bond Oracle
6. Reference Solver
7. Random differential
8. UB
9. Memo
10. Compression
11. Dominance
12. Front / Support / Grand / Pin
13. Account / CE copies
14. Data pipeline
15. CI
16. Battle boundary
17. Benchmark
18. 最后才性能优化

## Stop

出现 Optimized 与 Reference 目标分叉、UB 低估、Memo 撞车、Compression/Dominance 误剪：立刻停止性能优化。然后按 Memo → Compression → Dominance → UB 关闭，再逐层打开，定位第一处分叉。

`solverAudit`：`memo` / `ub` / `compression` / `dominance` 缺省为开，`false` 才关。

## Truth

- 生产真值：`assemblePlan()` → `calcParty()` → `comparePlans()`
- 第三层 Oracle：`src/bond-oracle.js`，独立两段 floor，不解析 CE JSON
- Reference：`src/reference-solver.js`，无剪枝 / UB / memo / compression，最终仍走 `assemblePlan` / `calcParty`
- 无 `costLimit`：对拍 `allPlans` 的 `comparePlans`
- 有 `costLimit`：对拍返回方案（`costUsed <= limit`）
- 等价最优：`objectivesEqual`（total / preferBond / bond15Count / costUsed / priorityScore）
- 关 dominance 后允许用 0-hit 礼装贴 COST；羁绊目标仍须与 Reference 一致，且 `comparePlans` 不得更差

## Forbidden restores

- 同 hits + 更高 COST 就删
- `compressEquivalentRows` keep 有限
- `eachPrefixCombos` 只取最便宜 prefix
- `uniqueBestRows` 每从者只留一种形态

## Tests

改求解器或数据层后跑 `npm test` 与 `npm run validate-data`。新增测试文件必须写入 `package.json` 的 `test` 脚本。CI：`.github/workflows/ci.yml`；Pages 部署前同样过测试门。

## Report template

```text
【状态】main / workspace / uncommitted
【任务】P0 / P1 / P2 / P3
【读取】
【修改】
【Correctness】PASS / FAIL / UNKNOWN
【Reference】PASS / FAIL / NOT RUN
【Random】cases / passed / failed
【UB】cases / violations
【Memo】collision
【Compression】false-prune
【Dominance】false-prune
【npm test】PASS / FAIL / NOT RUN
【性能】before / after
【剩余风险】
【下一步】
```

## Remaining roadmap

- P2：Battle Engine、Farming 深化、战斗模拟可重复性
- P3：架构重构、Web Worker、大规模性能优化
