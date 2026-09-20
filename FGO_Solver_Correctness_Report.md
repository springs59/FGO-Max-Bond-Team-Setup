# Solver Correctness Report

阶段：清单 #30 / #35 收口。`npm test` 已实际执行：PASS（约 5.4s）。未做性能优化，未提交。

## 0. 完成判定

清单 #30 / #35 那一大段正确性工作已经做完。按协议没有做性能优化，也没有提交。

### 这段任务里已经完成

- 站位钉住：卡片「钉住此位」+ 进阶 1–6 号预设；有礼装一起钉，`ceId=0` 仍由求解器配。已进 `main` `87195e0`。
- 真值层：`assemblePlan()` + `calcParty()` + `comparePlans()`。助战本人 0；肖像 +50 在 floor 后；茶壶最后 ×2。
- P0 误剪已修：`uniqueBestRows`、`eachPrefixCombos`、mix 穷举、`compressEquivalentRows` keep=Infinity、形态笛卡尔、Grand 报酬拆分、`formStateKey` 含 cost、prefer 关闭 UB skip、助战 UB 240/40、账号 CE 副本。
- Reference Solver：`src/reference-solver.js`，无剪枝，最终走同一套 `assemblePlan`/`calcParty`。
- 随机对拍：自由 24 组（1–3/1–3，seed `20260920`）；规模 16 组覆盖 1–6 从者 / 1–10 礼装（seed `20260921`）；Grand 12 组（seed `260920`）。失败 0，UB 低估 0。
- 前排 n=1–6：无 pin / 前钉 / 后钉 / 助战后排 / slot pin / Grand 与 Reference 一致；前排 6 种排列总羁绊相同。
- COST 七条：低羁绊低 COST、高羁绊高 COST、正好贴上限、超 1、超很多、助战不计 COST、冠位报酬免费。
- 填写 `costLimit` 时在 `costUsed <= limit` 的唯一方案里 `comparePlans`。
- Bond 12/12、14/15、15/15、15/16、16/16 矩阵。
- Farm 四档：fastest / bond_first / stable_script / balanced。
- `validateGameBundle`；snapshot 失败不 auto-commit。
- `npm test` 全绿，约 5.4s。
- 性能只测不优化。recommendTeam 单次：6 从者 3 礼装 +助战 60ms；无助战 25ms；4 从者 6 礼装 +助战 35ms；2 从者 10 礼装 +助战 9ms；6 从者冠位 35ms；5 从者 4 礼装账号+助战 67ms。

### 冲突按原公式裁定

清单第 12 节 `Support Back = +4%` 是后写笔误，不以清单改公式。

原规则：助战占前排（1–3 号）时己方全体再叠 +4%（前排 24%、后排 4%）；助战在后排时第一层不加这 4%，前排己方仍 +20%、后排 0%。自动推荐助战固定 6 号后排，实算 20%/0%；手动拖到前排走 `calcParty` 的 24%/4%。UB 仍按 24%/4% 放宽。

说明在 `.monkeycode/docs/support-front-bond.md`。页面「公式」已写明助战在后排时第一层不加这 4%。

### 这段任务里明确不做 / 未做

- 性能优化：清单第 33 节第 15 步，正确性收口之后才允许，本轮不做。
- 完整 CE dominance（同 hits 更贵就删）：相对 COST gap 已证明是错误规则，明确不实现。
- 超大从者盘与 Reference 对拍：太慢，未做对照。穷举逻辑仍正确。
- Battle sim 完整 FGO 模拟：边界已写明，不是完整模拟器。
- 账号 dump / Chaldea 双通道把同一 CE 多实例合成 count：未验证。测试按 `account.ces` 数组重复 id 计副本。
- 提交 git：按指示未提交。Solver 正确性改动仍在工作区。
- `FGO_配队计算器_AI_Agent实施说明书.docx`：权威说明，不要进 git。

### 工作区相对 main 87195e0（未提交）

已修改：`.monkeycode/MEMORY.md`、`index.html`、`package.json`、`src/account.test.js`、`src/app.js`、`src/battle.test.js`、`src/bond.js`、`src/data-layer.test.js`、`src/farming.test.js`、`src/recommend.js`、`src/solver-pruner.js`、`src/solver.test.js`

未跟踪：`.monkeycode/docs/support-front-bond.md`、`FGO_Solver_AI_验证与疑问清单.md`、`FGO_Solver_Correctness_Report.md`、`src/reference-solver.js`、`src/reference-solver.test.js`

工作区里还有说明书 docx，不要加入提交。

### 线上 / 缓存

- 线上：https://springs59.github.io/FGO-Max-Bond-Team-Setup/
- `main` 已含站位钉住。Pages 随 `main` push 自动部署。
- 页面缓存参数现为 `?v=front4`（公式说明那句）。正确性求解改动未上线，要等提交并推 `main`。


真值层：`assemblePlan()` + `calcParty()` + `comparePlans()`。

`comparePlans()` 字典序：
1. `optimizeBy=total` 全队总羁绊；`prefer` 则练度羁绊
2. 另一侧羁绊
3. 更少 15 绊人数
4. 更贴 `costLimit` 的 `|limit − used|`（无上限时当作 0，即更低 COST）
5. 更高 `priorityScore`

无 COST 上限时，对拍用 `allPlans` 的 `comparePlans`。填写 `costLimit` 时，对拍用返回方案（在 `costUsed <= limit` 的唯一方案里 `comparePlans`），与 Reference 一致。

---

## 1. 已验证

- `assemblePlan` / `calcParty` 为羁绊真值；助战本人 0；肖像 +50 在 floor 后；茶壶最后 ×2。
- Bond 矩阵：12/12 停刷无光环；14/15 继续刷无光环；15/15 停刷有光环；15/16 继续刷有光环；16/16 停刷有光环。
- `ceDominates` / `pruneDominatedCands` 只删除 hits 全 0。同 hits 更高 COST、交叉 hits、supportRate、fixedAdd、condition、pinned 非零 hits 均保留。COST gap 下「同效果更贵可删」不成立。
- `eachPrefixCombos` 组内全部 k-子集。
- `uniqueBestRows` 按 `(svtId, effectSig)`；`compressEquivalentRows` keep=Infinity。
- `eachFarmerMixes` 穷举从者 ID 组合与形态笛卡尔积。
- `mixUpperBound0/1/2` 随机对拍 0 次低估。`useSupport` 时 UB 按 240/40 放宽；自动推荐助战固定后排，实算 200/0。
- `loadoutMemoKey` 含 form / support / grand / aura / optimizeBy / pinCe / ownCap / costLimit / frontIds / slotPins；`formStateKey` 含 cost。
- 站位钉住、Grand 报酬拆分、助战冠位第二报酬、账号 1 张/2 张午餐、双形态。
- Farm 四档：fastest / bond_first / stable_script / balanced，均 clearable 第一。文案不含「必过」。
- `validateGameBundle` 拒绝坏数据。snapshot 失败不 auto-commit。

## 2. 未验证

- 完整 CE dominance（COST+hits+fixedAdd）——按 COST gap 证明后明确不做。
- Battle sim 不是完整 FGO 模拟器。
- snapshot 半包写入工作区的文件系统时序（validate 会拦住提交）。
- 账号解析把同一 CE 多实例合成 count 的 dump/Chaldea 双通道。当前按 `account.ces` 数组重复 id 计副本。

## 3. 已发现 Bug

见下一节。均已修复。

## 4. 已修复 Bug

1. `uniqueBestRows` 每从者只留最高覆盖率形态 → 按效果签名保留。
2. `eachPrefixCombos` 只取最便宜 prefix → 全 k-子集。
3. 无条件礼装 greedy mix / `MIX_COMBO_LIMIT` → 穷举 ID 组合。
4. `compressEquivalentRows` keep=cap 丢掉同 hits 贵从者 → keep=Infinity。
5. 形态笛卡尔积 >32 只留第一种 → 全笛卡尔。
6. Grand 永远最高 COST 当报酬 → 无报酬 + 每一张当报酬。
7. `formStateKey` 不含 COST → 写入 cost。
8. `skipMixByUb` 在 prefer 下用 total 剪枝 → prefer 关闭 UB skip。
9. `searchCeLoadouts` 用 200/0 排 loadout → `useSupport` 时 240/40，并加肖像 +50。
10. Reference 忽略形态/库存/Grand 报酬/助战第二报酬/CE 副本 → 已对齐。
11. 账号同 CE 多副本被 id 去重 → `ownedCeCopyCount` 按重复记录展开。
12. 填写 COST 上限时只在 Pareto 面上 pick，会丢掉同羁绊更高 COST 的贴上限方案 → 改为在全部可行唯一方案里 `comparePlans`。

## 5. 仍存在风险

- 生产账号从者极多时 mix 穷举变慢。正确性优先，未再加 greedy。
- `account.ces` 走 parseAccount Map 时仍按 id 合并，登录包多实例需靠 upsert 次数；测试用数组重复 id。
- 助战固定后排，手动把助战放到前排的 +4% 只在 `calcParty` 生效。清单「Support Back = +4%」已按原公式裁定为笔误，说明在 `.monkeycode/docs/support-front-bond.md`。

## 6. 新增测试数量

本轮补：前排 n=1–6（无 pin / 前钉 / 后钉 / 助战后排 / slot pin / Grand）对拍、前排 6 种排列总羁绊相同、COST 七条、规模随机 16 组。solver.test 27 块；reference-solver.test 约 20 块。

## 7. Reference Solver 对比数量

固定对拍 10 组仍在。另加前排 n=1–6 全配置、COST 七条、前排排列等价。有 COST 上限时比较返回方案，无上限时比较 `allPlans`。

## 8. Random Case 数量

自由 24 组（1–3 从者 / 1–3 礼装，seed `20260920`，成功对拍 >=12）。规模 16 组覆盖 1–6 从者 / 1–10 礼装（seed `20260921`，成功对拍 >=12）。Grand 12 组（seed `260920`，成功对拍 >=6）。

## 9. UB violation 数量

0

## 10. Memo collision 数量

构造 2：frontIds 不同 key 不同；同特质 cost 3 vs 16 key 不同。0 次错误撞车。

## 11. Dominance false-prune 数量

0（只删零 hits）。清单里「同效果更贵可删」被判定为错误规则，测试断言不可删。

## 12. Compression false-prune 数量

0（keep=Infinity 后，8 廉+1 贵同 hits 能贴 costLimit=16）。

## 13. Grand case 通过数量

固定 2 + 随机 12 组中成功对拍全部 + recommend.test 原有冠位用例。失败 0。

## 14. Support-front case 通过数量

`bond.test.js` 助战前排 +4%；自动推荐助战后排 20%/0%；UB 仍按 240/40，0 低估。

## 15. Bond15/16 case 通过数量

5 档矩阵全过。

---

## VERIFIED

见第 1 节。`npm test` PASS。

## FIXED

见第 4 节。

## UNPROVEN

- 超大从者池上的运行时间（穷举仍正确）。
- parseAccount 双通道 CE 张数。
- Battle sim 完整度。

## UNSAFE

已证明并去掉的误剪见第 4 节。当前覆盖用例上没有仍在生效的已知误剪。

Naive CE dominance（同 hits 更贵就删）相对 COST gap 目标是错误规则，未实现。

## REFERENCE COMPARISON

固定 10 组目标值一致。随机自由 24、Grand 12：失败 0，UB 违约 0。等价最优用 `objectivesEqual`。

## GRAND

职阶、3 礼装、报酬免费、无报酬拆分、costLimit、助战普通+报酬、随机 1–2 剑从者：通过。

## ACCOUNT MODE

未持有午茶不能上自己；1 张午餐最多 1 次；2 条午餐记录可装备 2 次；满绊过滤；15/16 矩阵。

## UPPER BOUNDS

- UB0：500% 第二层 + 24%/4% +50
- UB1：每从者独立抽最高 own/support CE，support 时 24%/4%
- UB2：先滤单张都装不下的 CE 再 UB1
- prefer 不做 mix UB skip

## MEMO

Key 含 form（id/traits/cost/maxed/b15）、support、grand、aura、optimizeBy、pinCe、ownCap、costLimit、frontIds、slotPins。Cache 为单次 `buildPlan` 内 Map。

## PERFORMANCE

本轮没有做性能优化。`npm test` 约 5.4s。recommendTeam 实测（本机 node，单次）：
- 6 从者 3 礼装 +助战：60ms
- 6 从者 3 礼装 无助战：25ms
- 4 从者 6 礼装 +助战：35ms
- 2 从者 10 礼装 +助战：9ms
- 6 从者 1 礼装 冠位：35ms
- 5 从者 4 礼装 账号+助战：67ms

## FILE CHANGES

- `src/recommend.js`：mix 穷举、形态笛卡尔、compress keep=Infinity、CE 副本、loadout 前排 240/40、COST 上限在可行唯一方案里 pick、删 greedy/splitGrandOwn
- `src/reference-solver.js`：助战报酬、CE 副本、own CE 用组合（self 才排列）、跳过 0-hit 己方礼装
- `src/solver.test.js` / `src/reference-solver.test.js` / `src/farming.test.js`：清单必测与规模对拍

## TEST COMMANDS

```bash
node src/reference-solver.test.js
node src/solver.test.js
node src/farming.test.js
npm test
```

实际结果：全部 PASS。

---

## 第 35 节逐项结论

- [x] `ceDominates()` 是否真正安全？ — 是：只删零 hits。完整 dominance 相对 COST gap 不安全，未做。
- [x] `pruneDominatedCands()` 是否真正安全？ — 是：等价于去掉零 hits。
- [x] `groupCandsByEffect()` 是否真正安全？ — 是：仅分组，不删成员。
- [x] `eachPrefixCombos()` 是否真正安全？ — 是：组内全 k-子集。
- [x] `uniqueBestRows()` 是否真正安全？ — 是：按 (svtId, effectSig) 保留。
- [x] `compressEquivalentRows()` 是否真正安全？ — 是：keep=Infinity，同 hits 不同 COST/15绊/priority 都保留。
- [x] `mixUpperBound0()` 是否永不低估？ — 已测 0 violation；500% 第二层放宽。
- [x] `mixUpperBound()` 是否永不低估？ — 已测 0 violation；support 按 240/40。
- [x] `mixUpperBound2()` 是否永不低估？ — 已测 0 violation。
- [x] `loadoutMemoKey()` 是否完整？ — 当前 cache 范围内完整。
- [x] `frontIds` 是否进入正确的 memo key？ — 是。
- [x] Front combination 是否完整？ — `frontCombos` 为 C(n,3)；n=1–6 无 pin/前钉/后钉/助战/slot pin/Grand 与 Reference 一致；前排 6 种排列总羁绊相同。
- [x] Support Front +4% 是否完整进入 Solver？ — 进 `calcParty`；自动推荐助战后排，UB 仍按可能的 +4% 放宽。
- [x] COST pruning 是否安全？ — `remainingCostFeasible` 只丢超上限；warm start 不替代穷举。
- [x] Bond Cap 是否正确？ — 默认档 + friendshipExceedCount，最高 16。
- [x] Bond15 是否正确？ — >=15 给光环，本人除外。
- [x] Bond16 是否正确？ — 15/16 继续刷有光环，16/16 停刷有光环。
- [x] Grand 是否正确？ — 小规模 + 随机 + 助战双礼装对拍通过。
- [x] Pinned servant 是否正确？ — 钉住测试通过。
- [x] Pinned CE 是否正确？ — 有礼装一起钉，ceId=0 仍由求解器配。
- [x] Form / Sprite compression 是否安全？ — 不同 hits 形态保留。
- [x] Free mode 是否正确？ — 小规模对拍通过。
- [x] Account mode 是否正确？ — 库存/副本/满绊用例通过。
- [x] Reference Solver 是否建立？ — `src/reference-solver.js`。
- [x] Optimized Solver 是否与 Reference Solver 完全一致？ — 小规模、Grand、账号、前排 n=1–6、规模 1–6/1–10 一致。超大盘耗时未做对照。
- [x] Random 对拍是否通过？ — 是，UB 0 violation。
- [x] Battle Simulator 的可信边界是否明确？ — 四档 label；failRate=0 只表示当前样本。
- [x] Farming 四种模式的排序规则是否明确？ — 均 clearable 第一；fastest / bond_first / stable_script / balanced 有测试。
- [x] 自动数据更新失败是否会保护旧数据？ — validate + npm test 失败不 auto-commit。
- [x] 所有测试是否实际执行？ — `npm test` PASS。
