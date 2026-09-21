# FGO Solver / 配队系统 —— AI 阅读与验证任务清单

> historical：后写验证清单。与 `docs/SOLVER_SPEC.md` / MEMORY 公式原文冲突时，以公式原文为准。`Support Back = +4%` 是笔误。

> 用途：本文件不是普通开发说明，而是给 AI Coding Agent / Claude Code / Codex 等读取后执行的“问题清单 + 验证协议”。
>
> 核心原则：**先证明正确，再做性能优化；任何剪枝、压缩、Memo、Upper Bound 都不得因为“看起来合理”就视为安全。**
>
> 当前仓库：
> `https://github.com/springs59/FGO-Max-Bond-Team-Setup`
>
> 当前主要 Solver 文件：
> - `src/recommend.js`
> - `src/solver-pruner.js`
> - `src/solver.test.js`
> - `src/bond.js`
> - `src/account.js`
> - `src/data-layer.js`
> - `src/farming.js`
> - `src/battle-planner.js`
> - `src/battle-sim.js`

---

# 0. AI 必须先回答的问题

在修改任何 Solver 代码之前，AI 必须先逐项回答：

1. 当前 Solver 的“最终真值”到底是什么？
   - 是否最终必须经过 `assemblePlan()`？
   - 是否最终必须经过 `calcParty()`？
   - 哪些中间值只是 Upper Bound / 候选评分，而不是最终结果？

2. 当前优化目标的完整字典序是什么？
   - `total`
   - `preferBond`
   - `bond15Count`
   - COST gap
   - `priorityScore`
   - `optimizeBy=total/prefer`
   - 是否还有 UI 层或其他隐藏 tie-break？

3. “更优”是否只由最终羁绊决定？
   如果不是，请列出所有影响最终比较结果的字段。

4. 哪些字段会影响：
   - 羁绊
   - COST
   - 15 绊加成
   - 前排 +20%
   - 助战前排额外 +4%
   - 礼装效果
   - 从者灵基/服装
   - Grand
   - Support
   - pinned slot
   - pinned CE
   - priority
   - bond preference

5. 当前所有剪枝是否都能证明：
   > 被删除的候选不可能产生比保留候选更好的最终计划？

6. 如果无法证明，必须把该剪枝标记为：
   `UNPROVEN` / `UNSAFE UNTIL VERIFIED`
   而不是称为“安全剪枝”。

---

# 1. P0：必须验证的 Solver 正确性问题

## 1.1 `ceDominates()` 是否真的实现了 dominance？

当前 `src/solver-pruner.js` 中的 `ceDominates()` 需要重点检查。

已发现的情况：

- 当前函数并不是完整的“成本 + 效果逐项支配”判断。
- 当前逻辑主要针对 `hits` 是否全为 0。
- `pruneDominatedCands()` 当前也主要表现为过滤 zero-hit candidate。

### AI 必须回答

1. 什么叫两个 CE candidate 的 dominance？
2. 是否至少需要比较：
   - COST
   - 每个 servant 的 hit
   - support rate
   - own rate
   - fixed add
   - condition state
   - target
   - MLB
   - pinned 状态
   - Grand 状态
   - 是否为 support CE
   - 是否影响 UI 可选项
3. 如果 A：
   - COST <= B
   - 每个目标上的收益 >= B
   - 且至少一项严格 >

   是否就一定可以删除 B？

4. 上述结论是否因为：
   - 位置
   - 前后排
   - Support
   - 15-bond aura
   - Grand
   - CE 槽数量
   - COST 上限
   而失效？

5. 请给出一个正式的 dominance 定义。

### 必须新增测试

- 完全相同效果 + 更高 COST → 可被支配
- 更低 COST + 相同效果 → 不得被删除
- 某一 servant 效果更高但另一 servant 更低 → 不得删除
- supportRate 不同 → 不得错误删除
- fixedAdd 不同 → 不得错误删除
- conditionState 不同 → 不得错误删除
- pinned CE → 不得因为一般 dominance 被删除
- Grand / 非 Grand → 不得混合错误删除

---

# 2. P0：`mixUpperBound()` 是否会低估真实答案？

这是当前最需要验证的问题之一。

当前 `recommend.js` 的 `mixUpperBound()` 对普通前排使用：

- base
- +20% front
- second-layer
- portrait

但需要确认它是否包含：

> **Support 在前排时额外 +4%**

如果没有，则可能出现：

```text
真实可实现值 > Upper Bound
```

一旦发生：

```text
UB < best.total
```

Solver 可能直接跳过一个实际上更优的队伍。

这不是性能问题，而是**答案正确性问题**。

### AI 必须做

1. 找到 `mixUpperBound()` 的完整数学定义。
2. 列出它忽略的因素。
3. 证明它为什么仍然是 Upper Bound。
4. 如果不能证明，修复。
5. 对 `support front` 单独测试。

### 必须满足

对任意测试案例：

```text
mixUpperBound(case) >= bruteForceOptimal(case)
```

绝不能出现：

```text
mixUpperBound(case) < bruteForceOptimal(case)
```

---

# 3. P0：三个 Upper Bound 全部验证

必须逐个审查：

- `mixUpperBound0`
- `mixUpperBound`
- `mixUpperBound2`

对每一个写清：

```text
输入
↓
允许放宽哪些约束
↓
计算什么
↓
为什么一定 >= 真正最优值
```

特别检查：

- COST
- support
- front
- second-layer
- 15 bond
- portrait
- conditional CE
- Grand
- pinned CE
- pinned servant
- form
- bond cap

### 必须新增随机测试

生成大量随机小规模问题：

```text
servants = 1~6
CE = 1~10
COST = 随机
bond = 随机
bondCap = 随机
15 aura = 随机
support = 随机
front = 随机
CE effects = 随机
```

对每个 case：

```text
bruteForceOptimal
<=
UB
```

若违反，立即停止性能优化，先修 UB。

---

# 4. P0：建立 Brute Force Reference Solver

必须新增一个：

```text
reference-solver.js
```

或等价测试专用实现。

要求：

- 不使用 pruning
- 不使用 dominance
- 不使用 Upper Bound
- 不使用等价压缩
- 不使用可能错误的 memo
- 穷举所有合法组合
- 最终使用与生产 Solver 相同的 `assemblePlan/calcParty` 真值层

用途：

```text
Reference Solver = Ground Truth
Optimized Solver = Candidate
```

### 验收

大量随机小规模输入：

```text
optimizedResult === referenceResult
```

不能只比较 total。

必须比较：

- total
- preferBond
- bond15Count
- costUsed
- priorityScore
- selected servants
- selected CE
- front layout
- support
- Grand
- pinned constraints

如果存在多个完全等价解：

- 可以允许不同 ID
- 但必须验证最终目标值完全一致
- 如果 UI 要求稳定输出，则另行定义 deterministic tie-break

---

# 5. P0：`compressEquivalentRows()` 是否安全？

必须找到并分析：

```text
uniqueBestRows()
compressEquivalentRows()
```

### AI 必须回答

两个 row 被视为 equivalent 的条件到底是什么？

不能只比较：

```text
CE hit
```

必须考虑是否还存在：

- servant bond
- servant cost
- 15 aura
- locked bond
- preferred bond
- priority
- form
- trait
- class
- support eligibility
- Grand
- pinned state
- account ownership
- bond cap
- CE eligibility

### 典型危险

如果：

```text
A 与 B 的 CE hit 完全一样
```

但：

```text
A bond = 1000
B bond = 2000
```

则不能简单认为二者等价。

### 必须新增反例测试

专门构造：

```text
same hits
different bond
```

```text
same hits
different cost
```

```text
same hits
different 15 aura
```

```text
same hits
different priority
```

```text
same hits
different form
```

确认压缩不会丢失最优答案。

---

# 6. P0：`groupCandsByEffect()` + `eachPrefixCombos()` 是否安全？

当前思路类似：

```text
effect 相同
→ 分组
→ 按 COST 排序
→ 只取 prefix
→ 枚举数量
```

这只有在“组内成员在所有目标维度上完全等价，仅 COST 不同”时才成立。

### AI 必须证明

对于同一 group：

```text
candidate A
candidate B
```

除了 COST 外是否完全等价？

如果不是：

```text
不能简单只取 prefix
```

### 必须测试

至少：

- 2 个相同 effect、不同 cost
- 3 个相同 effect、不同 cost
- 相同 hits 但不同 condition
- 相同 hits 但不同 supportRate
- 相同 hits 但不同 fixedAdd
- pinned CE
- Grand reward CE
- support CE

---

# 7. P0：`loadoutMemoKey()` 是否缺少 `frontIds`？

当前重点检查：

```text
loadoutMemoKey()
```

调用方存在：

```text
frontIds
```

但必须确认 memo key 是否完整包含：

```text
frontIds
```

### 必须构造反例

Case A：

```text
frontIds = [A,B,C]
```

Case B：

```text
frontIds = [D,E,F]
```

其他输入完全相同。

如果两个 case 的 memo key 一样：

```text
BUG
```

因为前排不同会改变：

```text
+20%
+4% support-front
```

### 验收

不同 front layout：

```text
必须得到正确且独立的 loadout 结果
```

---

# 8. P0：Memo Key 完整性总审计

不仅检查 `frontIds`。

所有可能影响结果的输入都必须进入 memo key。

逐项审查：

- servant IDs
- form key
- traitIds
- bond
- bond cap
- bond15
- maxed
- cost
- support
- Grand
- front
- slot pins
- CE pins
- optimizeBy
- costLimit
- ownCap
- support CE rules
- reward CE rules

### 规则

如果：

```text
Input A !== Input B
```

但：

```text
memoKey(A) === memoKey(B)
```

必须证明二者结果绝对等价，否则修复。

---

# 9. P0：Front Layout 穷举验证

当前 `frontCombos(n)` 使用组合而不是排列，这是合理的性能优化候选。

但是必须证明：

```text
前排是集合
```

而不是：

```text
前排顺序会改变结果
```

如果 slot 1/2/3 的位置本身没有区别：

```text
C(n,3)
```

是合理的。

如果不同位置存在：

- 特殊位置加成
- CE slot effect
- servant skill position effect
- Grand position effect

则不能这么做。

### 必须测试

n =

```text
1
2
3
4
5
6
```

分别检查：

- 无 pin
- front pin
- back pin
- support front
- support back
- slot pin
- Grand

与 brute force 一致。

---

# 10. P0：COST 正确性

必须确认：

```text
COST 是约束
```

而不是优化目标。

检查：

- servant cost
- CE cost
- support cost
- Grand cost
- reward CE cost
- Mash / 特殊从者
- 低 rarity fallback
- form cost
- account mode
- free mode

### 必须测试

1. 低 COST 但低羁绊
2. 高 COST 但高羁绊
3. 正好等于上限
4. 超过 1
5. 超过很多
6. Support 不占己方 COST
7. Grand CE 是否按实际规则处理

---

# 11. P0：Bond Cap / Bond 15 / Bond 16

必须完整验证：

```text
bond < cap
bond == cap
bond 14/15
bond 15/16
bond 16/16
```

特别关注：

```text
15 bond aura 是否在 bond 15/16 状态仍然生效？
```

以及：

```text
bond 16/16 是否仍然保留 15 aura？
```

还要确认：

```text
当前 bond < 当前 cap
```

而不是简单：

```text
bond < 15
```

或：

```text
bond < 16
```

### 必须新增矩阵测试

| bond | cap | 是否继续刷 | 是否算15 aura |
|---:|---:|---|---|
| 12 | 12 | 否 | 否 |
| 14 | 15 | 是 | 否 |
| 15 | 15 | 否 | 是 |
| 15 | 16 | 是 | 是 |
| 16 | 16 | 否 | 是 |

---

# 12. P0：Support +4% 必须有独立测试

必须验证：

```text
Support Back
Support Front
Own Front
```

三种情况。

重点确认：

```text
Support Front = 普通 Front +20% +额外 +4%
```

以及：

```text
Support Back = +4%
```

> 已按原公式裁定：上一行是清单笔误。权威规则见实施说明书 / MEMORY：助战占前排时己方全体再叠 +4%；助战在后排时第一层不加这 4%（前排己方仍 +20%，后排 0%）。说明在 `.monkeycode/docs/support-front-bond.md`。

不要只测试 `calcParty()`。

必须同时测试：

- final score
- upper bound
- search
- memo
- layout
- brute force

否则可能出现：

```text
公式正确
但 Solver 找不到正确队伍
```

---

# 13. P1：CE Candidate 完整状态签名

需要设计一个正式的：

```text
CE Effect Signature
```

建议至少考虑：

```text
{
  hits,
  ownRate,
  supportRate,
  fixedAdd,
  target,
  conditionState,
  cost,
  mlb,
  support,
  pinned,
  grand,
  reward
}
```

实际字段以代码审计结果为准。

### AI 必须回答

哪些字段属于：

```text
objective-relevant
```

哪些属于：

```text
UI-only
```

哪些属于：

```text
search-only
```

不要把 UI 字段混入数学等价判断。

---

# 14. P1：Conditional CE 不得错误截断

已有测试：

> 第 9 个 conditional CE 仍然可能是最优。

必须继续增加：

- 10
- 20
- 50
- 大量相同收益不同 COST
- 大量不同收益
- conditional + unconditional 混合

确认不存在隐藏：

```text
top 8
top N
slice(0,N)
```

之类的不安全截断。

---

# 15. P1：Servant Search 是否过早忽略 COST？

当前需要检查：

```text
takeWithinCost(..., Infinity)
```

导致 servant 候选阶段可能没有真正使用 COST 上限。

这可能不是正确性 bug，但可能严重影响性能。

### AI 必须回答

1. 为什么这里使用 Infinity？
2. 是否可以提前按 COST 剪枝？
3. 如果提前剪枝，会不会因为：
   - Support
   - Grand
   - CE
   - reward CE
   而错误删除？
4. 给出安全的最早 COST pruning 点。

---

# 16. P1：Warm Start 是否只影响搜索顺序？

必须证明：

```text
warm start
```

只能：

```text
更早找到 best
```

不能：

```text
直接删除候选
```

如果 warm start 会改变最终答案：

```text
BUG
```

---

# 17. P1：Priority 是否只做 tie-break？

检查：

```text
priorityScore
```

是否可能在更高羁绊出现时仍然被选掉。

必须明确：

```text
primary objective
secondary objective
tie-break
```

当前 `comparePlans()` 还涉及：

```text
bond15Count
cost gap
priorityScore
```

必须确认这是不是用户真正想要的规则。

### AI 必须给出

```text
当前实际字典序：
1.
2.
3.
4.
5.
```

如果代码和文档不一致：

```text
不要自行选择
```

必须在结果里报告冲突，等待确认或依据当前测试确定。

---

# 18. P1：Grand 模式完整验证

必须独立测试：

- Grand servant
- 非 Grand servant
- Grand CE slot
- reward CE
- support
- 5/6 slots
- COST
- front
- pinned
- bond15
- support CE
- CE duplication rules

尤其检查：

```text
Grand ownCap
```

以及：

```text
Grand reward CE
```

是否真的按照业务规则计算。

---

# 19. P1：Pinned Slot / Pinned CE

必须测试：

```text
slot pin
servant pin
form pin
CE pin
support CE pin
reward CE pin
```

要求：

> 用户明确锁定的对象绝不能被普通剪枝删掉。

同时验证：

```text
pin + dominance
pin + group
pin + memo
pin + front
pin + Grand
```

---

# 20. P1：Form / Sprite 等价压缩

当前 `expandFormRows()` 有 form signature：

```text
rarity
cost
attribute
traitIds
```

需要确认这个 signature 是否足够。

必须检查是否还可能影响：

- bond
- skill
- CE compatibility
- class
- attack
- HP
- special trait
- image/UI
- account unlock
- priority

如果只是为了羁绊搜索：

```text
必须证明哪些字段真正影响数学结果
```

---

# 21. P1：Account Mode / Free Mode

必须分别测试。

## Free

- 所有可用从者
- 所有可用 CE
- bond cap
- 15 aura

## Account

- owned servant
- owned CE
- MLB
- bond
- bond cap
- costume
- ascension
- Grand
- account raw data

重点：

```text
free mode 不能误用 account ownership
account mode 不能出现未拥有对象
```

---

# 22. P1：数据层完整性

检查：

```text
createGameData()
createAccountData()
solverInputs()
```

确认 Solver 所需要的数据都来自明确的数据层。

必须避免：

```text
recommend.js 自己偷偷生成一套数据规则
```

或：

```text
data-layer 一套
recommend.js 另一套
```

导致规则漂移。

---

# 23. P1：数据更新 Pipeline

需要验证：

```text
Atlas CN/JP
↓
snapshot
↓
normalize
↓
validate
↓
test
↓
snapshot/diff
↓
commit
↓
deploy
```

AI 必须回答：

1. 数据源失败怎么办？
2. 部分数据失败怎么办？
3. schema 改变怎么办？
4. servant 数量异常怎么办？
5. CE 数量异常怎么办？
6. quest 数量突然大幅下降怎么办？
7. version 是否更新？
8. validation 失败是否阻止 commit/deploy？

### 原则

```text
坏数据不能覆盖上一版好数据。
```

---

# 24. P2：Battle Planner 当前能力必须重新定义

当前 `battle-planner.js` 不应被描述成：

```text
真正的 FGO 自动攻略器
```

必须确认它目前更接近：

```text
结构化战斗策略模板生成器
```

必须列出当前缺失机制：

- Break Bar
- Buff / Debuff
- Defense
- Invincible
- Evade
- Sure Hit
- Invul Pierce
- NP Gain
- Card
- Card Chain
- NP Effect
- OC
- Buff Removal
- Cleanse
- Stun
- Charm
- Skill Seal
- NP Seal
- Enemy AI
- Master Skill
- Order Change
- Special Resist
- Death / Revive
- Targeting
- Trait Damage
- Special Attack

### 关键要求

在这些机制没有完整实现之前：

```text
不能输出“必过”
```

也不能把：

```text
sample failRate = 0
```

解释为：

```text
真实 FGO 100% 稳定通关
```

---

# 25. P2：Battle Simulator 必须有“可信度边界”

当前 simulator 是简化模型。

AI 必须在代码/API/UI 中明确区分：

```text
theoretical-clear
reproducible-strategy
high-stability-farming
uncleared
```

并明确：

```text
high stability
=
当前简化模拟样本中没有失败
```

而不是：

```text
真实游戏必过
```

---

# 26. P2：Farming 优化目标必须确认

当前存在：

```text
fastest
bond_first
stable_script
balanced
```

必须明确每种模式的字典序。

例如当前代码方向：

```text
balanced:
clearable
→ scriptable
→ stability
→ efficiency
→ bond

fastest:
clearable
→ efficiency
→ scriptable
→ stability
→ bond

bond_first:
clearable
→ bond
→ stability
→ scriptable
→ efficiency

stable_script:
clearable
→ scriptable
→ stability
→ efficiency
→ bond
```

### AI 必须验证

1. `clearable` 是否绝对第一优先？
2. theoretical-clear 是否允许与实际 scriptable 比较？
3. 没有战斗数据时如何排序？
4. bond-first 是否真的仍然要求 clearable？
5. stable-script 的 stability 如何计算？
6. efficiency 是 turn、AP、时间还是综合指标？

如果代码和产品需求不一致：

```text
报告，不要自行改规则。
```

---

# 27. P2：随机模拟必须固定随机种子测试

为了避免测试结果漂移：

```text
random seed
```

必须可控。

测试至少包括：

- 相同 seed → 相同结果
- 不同 seed → 可以产生不同结果
- N 次 simulation → failure rate 正确
- failRate = 0 的条件
- failRate > 0 的条件

---

# 28. P2：UI 不得影响 Solver 真值

检查：

```text
filter
search
UI state
display order
```

不能改变：

```text
数学最优解
```

除非用户明确设置了：

- filter
- pin
- preference
- cost limit
- account mode
- quest restriction

---

# 29. P3：性能优化必须后置

在下面全部通过之前：

```text
禁止大规模性能重构
```

必须先通过：

- brute force equality
- random equality
- UB safety
- memo safety
- dominance safety
- compression safety
- Grand tests
- support front tests
- bond15/16 tests
- pin tests

---

# 30. 最终验收标准

AI 完成后必须给出一份：

# Solver Correctness Report

格式：

```text
1. 已验证
2. 未验证
3. 已发现 Bug
4. 已修复 Bug
5. 仍存在风险
6. 新增测试数量
7. Reference Solver 对比数量
8. Random Case 数量
9. UB violation 数量
10. Memo collision 数量
11. Dominance false-prune 数量
12. Compression false-prune 数量
13. Grand case 通过数量
14. Support-front case 通过数量
15. Bond15/16 case 通过数量
```

---

# 31. AI 修改规则

## 禁止

在没有证明正确性之前：

- 大改 `recommend.js`
- 重写 Solver
- 删除测试
- 降低测试标准
- 删除看似“性能不好”的测试
- 直接扩大/缩小候选数量
- 增加新的 top-N 截断
- 用启发式替代 brute force 验证
- 把测试失败改成“预期行为”来绕过问题

## 允许

- 新增 reference solver
- 新增测试
- 增加 debug 输出
- 增加 assertion
- 修复确定的 correctness bug
- 在证明安全后做 pruning
- 在证明等价后做 compression
- 在证明 key 完整后做 memo

---

# 32. AI 每次修改后的固定回复格式

每完成一个阶段，必须回复：

```text
【阶段】
例如：P0-2 Upper Bound Audit

【检查文件】
- xxx
- xxx

【发现】
- ...

【修改】
- ...

【新增测试】
- ...

【测试结果】
- npm test: PASS / FAIL
- reference comparison: x/x
- UB safety: x/x
- memo collision: x/x

【剩余疑问】
- ...

【下一步】
- ...
```

如果测试无法运行：

```text
必须明确写：
“未实际执行，仅完成静态审查”
```

禁止写：

```text
测试通过
```

---

# 33. AI 最重要的工作顺序

严格按这个顺序：

```text
① 读取当前代码
↓
② 建立真实 Solver 数据流
↓
③ 找到最终真值层
↓
④ 建立 Reference Solver
↓
⑤ 随机小规模对拍
↓
⑥ 找出第一个不一致
↓
⑦ 修复 correctness
↓
⑧ 验证 UB
↓
⑨ 验证 dominance
↓
⑩ 验证 compression
↓
⑪ 验证 memo
↓
⑫ 验证 Front / Support / Grand / Pin
↓
⑬ npm test
↓
⑭ 性能 benchmark
↓
⑮ 最后才做性能优化
```

---

# 34. 当前项目最重要的结论

当前项目已经具备：

- 羁绊计算核心
- 从者/礼装候选搜索
- COST
- Account / Free
- Front layout
- Support
- Bond 15
- Grand
- Farming
- Quest
- Battle planner
- Battle simulator
- 自动数据更新基础

但不能因为“功能已经很多”就认为：

```text
Solver 已数学证明正确
```

当前真正需要完成的是：

> **把“能跑”提升到“可证明不会因为优化剪枝而漏掉最优解”。**

这是当前 AI Agent 的第一任务。

---

# 35. 最终问题清单（AI 必须逐项给结论）

请最终逐项回答：

- [ ] `ceDominates()` 是否真正安全？
- [ ] `pruneDominatedCands()` 是否真正安全？
- [ ] `groupCandsByEffect()` 是否真正安全？
- [ ] `eachPrefixCombos()` 是否真正安全？
- [ ] `uniqueBestRows()` 是否真正安全？
- [ ] `compressEquivalentRows()` 是否真正安全？
- [ ] `mixUpperBound0()` 是否永不低估？
- [ ] `mixUpperBound()` 是否永不低估？
- [ ] `mixUpperBound2()` 是否永不低估？
- [ ] `loadoutMemoKey()` 是否完整？
- [ ] `frontIds` 是否进入正确的 memo key？
- [ ] Front combination 是否完整？
- [ ] Support Front +4% 是否完整进入 Solver？
- [ ] COST pruning 是否安全？
- [ ] Bond Cap 是否正确？
- [ ] Bond15 是否正确？
- [ ] Bond16 是否正确？
- [ ] Grand 是否正确？
- [ ] Pinned servant 是否正确？
- [ ] Pinned CE 是否正确？
- [ ] Form / Sprite compression 是否安全？
- [ ] Free mode 是否正确？
- [ ] Account mode 是否正确？
- [ ] Reference Solver 是否建立？
- [ ] Optimized Solver 是否与 Reference Solver 完全一致？
- [ ] Random 对拍是否通过？
- [ ] Battle Simulator 的可信边界是否明确？
- [ ] Farming 四种模式的排序规则是否明确？
- [ ] 自动数据更新失败是否会保护旧数据？
- [ ] 所有测试是否实际执行？

---

# 36. 给 AI 的执行口令

**不要先优化。**

先回答：

> “如果我删除一个 candidate，我凭什么证明它永远不可能出现在全局最优答案中？”

如果答不出来：

```text
不要删。
```

如果只能说：

```text
一般情况下不会
经验上没问题
理论上应该
测试目前没发现
```

都不算证明。

正确目标是：

```text
Reference Solver
        ↓
     真值答案
        ↓
Optimized Solver
        ↓
   必须完全一致
```

然后才允许：

```text
Pruning
Compression
Memo
Upper Bound
Branch & Bound
Performance Optimization
```
