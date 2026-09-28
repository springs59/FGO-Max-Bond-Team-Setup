# Correctness Report

## 2026-09-28 活动默认解扩展

Action 解答索引按副本绑定的基础羁绊和实际适用的活动被动、关卡加成，尝试计算当前开放的国服普通活动关卡。同基数、同加成规则的关卡复用一次精确搜索；单次搜索超时会记录在索引中，由浏览器继续精确求解。关卡 ID、阶段、活动状态与图鉴版本共同约束缓存命中。账号、COST、茶壶、钉选等变体继续在浏览器精确求解。快照工作流每 6 小时运行，Pages 部署后刷新页面获取新数据。战斗数据不全的周回/通关模拟仍有原有限制。

## 2026-09-28 补充审计

账号模式新增已满羁绊但能提供 15 绊或活动全队光环的非玛修从者候选；修正分支上界，使已满羁绊的光环来源不会被低估。小规模账号案例与独立穷举解一致。该次快照的 Action 完整解只覆盖 8 个无约束普通副本；活动矩阵覆盖当时有效加成的 14 个关卡。数据按工作流计划每 6 小时刷新，页面重新载入后读取新快照。战斗敌人和技能数据仍不足，周回/通关结果只是结构模板。

## 2026-09-28 回归核查

本轮对普通关卡职阶、默认解缓存、账号与活动加成、各求解模式进行了回归。修复普通本（包括单职阶修炼场）将敌方职阶误作己方限制；修复页面默认空前排 `[0,0,0]` 使 Action 精确解失效；切换关卡种类时清空旧关卡的基础羁绊，并把关卡阶段与开放时间传给求解器。缺少敌人或攻击数据的周回/通关模板不再把模拟中止展示为 100% 失败率。礼装和 COST 热路径复用图鉴索引，活动实际样本（40 从者、34 羁绊礼装）同结果下约 32.4 秒降至 12.5 秒，取决于运行环境。

验收：`npm test` 全部通过（公式与独立 oracle、账号、职阶/关卡、礼装/COST/钉选、活动差分、周回、战斗、区域与数据管线）；`npm run validate-data`（445 从者、2480 礼装、30 关卡羁绊源、97 活动）、`npm run validate-solver-index`、`node scripts/validate-activity-score-index.mjs`（14 关）、`node scripts/validate-solution-index.mjs`（8 查询、273 解）与 `npm run benchmark` 均通过。默认无约束的单职阶修炼场可命中精确缓存（`nodes=0`），返回跨职阶队伍。非默认活动、账号和钉选组合仍按浏览器末端求解；战斗结论仅覆盖现有简化模型。

以下历史段落记录 2026-09-21 时点的审计结果，不代表当前功能进度。

Date: 2026-09-21
Commit: `a8a0c09` `feat: audit solver heuristics and reject failed snapshots`
Branch: `main`（与 `origin/main` 一致）

判定：P0 与本轮 P1 正确性主线 `PASS`。P2 Battle Engine / P3 性能未开始。

## npm test

`package.json` `test` 含：bond、bond-oracle、atlas、account、recommend、quest、filter、user-data、priority、game-data、solver、compare-plans、reference-solver、solver-audit、snapshot-guard、data-layer、farming、battle。

最近一次全量：PASS。`solver-audit` 记录 `ub random cases=1000 violations=0 minGap=50`，`medium random cases=100 mutations=400`。

`npm run validate-data`：schema 门。CI：`.github/workflows/ci.yml` 在 push/PR 跑测试 + validate；`pages.yml` 测试通过后才部署。

## Truth layers

1. Independent Bond Oracle — `src/bond-oracle.js`（不引用 `bond.js`）
2. Reference Solver — `src/reference-solver.js`（无剪枝 / UB / memo / compression）
3. Optimized Solver — `src/recommend.js` + `src/solver-pruner.js`

生产数字真值仍是 `assemblePlan()` → `calcParty()` → `comparePlans()`。

## Random / property / mutation

- 1000 小随机，seed `20260921`，UB 低估 0，`minGap=50`
- 100 中规模（2–3 从者 × 2–3 礼装），seed `20260922`，默认层与关 compression 与 Reference `objectivesEqual`
- Property：加从者 / 加礼装 / 放宽 COST，最优羁绊不降
- Mutation：关 memo、UB、compression、dominance；关 dominance 时羁绊目标一致，`comparePlans` 不更差

## UB

证明见 `SOLVER_SPEC.md`。UB0 / UB1 / UB2 均为放宽上界。`useSupport` 时 UB 按 24%/4%；自动推荐助战在后排，实算 20%/0%。prefer 不做 mix UB skip。

## Pruning

- `ceDominates` / `pruneDominatedCands`：只删全 0-hit
- `eachPrefixCombos`：组内全部 k-子集
- `uniqueBestRows`：键 `(svtId, effectSig)`
- `compressEquivalentRows`：`keep=Infinity`
- Memo key 含 form / support / grand / aura / optimizeBy / pinCe / ownCap / costLimit / frontIds / slotPins；`formStateKey` 含 cost

同 hits 更高 COST 删除是错误规则，未实现。

## Account CE copies

`upsertCe`：Dump 按实例 `id` 去重；Chaldea 读 `count`；`cePool` 展开副本并保留混满破 `accountMlb`。1 张午餐最多 1 次；两条记录可装备 2 次。

## Quest / snapshot

`collapseQuests` 键：`` `${display}|${ap}|${bond}|${phase}` ``。

`snapshotPublishDecision`：网络失败、CN 空包、JSON 损坏、schema 不符、从者/礼装骤降 → 不写 `src/data/`，保留上一版。JP 空包可继续。

## Front / support / grand / pin / COST / bond

- 前排 n=1–6：无 pin / 前钉 / 后钉 / 助战后排 / slot pin / Grand 与 Reference 一致
- 助战前排 +4% 在 `calcParty`；推荐后排 20%/0%
- Bond 矩阵：12/12 停刷无光环；14/15 继续刷无光环；15/15 停刷有光环；15/16 继续刷有光环；16/16 停刷有光环
- COST 七条（低羁绊低 COST、高羁绊高 COST、贴上限、超 1、超很多、助战不计、冠位报酬免费）通过
- 站位钉住已进更早的 `87195e0` / `bb3066f`

## Fixed (historical bugs, still gone)

1. `uniqueBestRows` 每从者只留最高覆盖率形态
2. `eachPrefixCombos` 只取最便宜 prefix
3. 无条件礼装 greedy mix / `MIX_COMBO_LIMIT`
4. `compressEquivalentRows` keep=cap
5. 形态笛卡尔积截断
6. Grand 永远最高 COST 当报酬
7. `formStateKey` 不含 COST
8. prefer 下用 total 做 UB skip
9. loadout 搜索按 200/0 排（现 `useSupport` 时 240/40）
10. 填写 COST 时只在 Pareto 面上 pick，丢掉同羁绊更高 COST
11. 账号同 CE 多副本被 id 去重

## Farming / battle

Farm 四档均把当前模型可通关放第一。文案不含「必过」。`failRate=0` 只表示当前简化模型 + 当前样本。完整战斗机制见 `BATTLE_SPEC.md`。

## UNPROVEN / remaining

- 超大从者池运行时间（穷举仍正确，未做性能优化）
- Battle 完整 FGO 模拟
- P2 Battle Engine / Farming 深化 / 模拟可重复性
- P3 架构重构 / Web Worker / 大规模性能

## Support-front ruling

清单「Support Back = +4%」是笔误。助战占前排才给己方全体再叠 +4%。说明曾写在 `.monkeycode/docs/support-front-bond.md`（已标 historical），现行以 `SOLVER_SPEC.md` 为准。
