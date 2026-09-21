# Solver Spec

Authority: MEMORY.md formula block. Later checklists that conflict with this file lose.

## Bond formula

最终羁绊 = (floor(floor(基础 × (1 + 前排)) × (1 + Σ第二层)) + 肖像) × 茶壶

- 第一层：己方前排 +20%。助战占前排时己方全体再叠 +4%（前排 24%，后排 4%）。助战在后排时第一层不加这 4%（前排己方仍 20%，后排 0%）。
- 第二层：礼装、午餐/午茶/福尔摩斯、活动被动、15绊梦火，加算后再乘并 floor。
- 英灵肖像 +50，加在两段 floor 之后。
- 茶壶最后 ×2。
- 助战本人不拿羁绊。
- 当前羁绊 ≥ 上限：本人 0。当前 ≥ 15：给队友梦火（本人除外，助战 15 绊无效）。

Implementation uses milli (rate × 1000) integer floor: `floor(value * (1000 + milli) / 1000)`.

## comparePlans dictionary (frozen)

1. `optimizeBy=total` → higher `total`; `optimizeBy=prefer` → higher `preferBond`
2. The other bond field
3. Fewer `bond15Count`
4. Smaller `|costLimit - costUsed|`
5. Higher `priorityScore`

UI sort, heuristics, and candidate scores must not replace this order.

COST is a constraint. Filling `costLimit` selects among `costUsed <= limit` by `comparePlans`, including same-bond higher-COST plans when they win a later tie-break.

## Support in recommend

Auto recommend pins support at slot 6 (back). Real first layer is 20%/0%. Manual front support uses 24%/4% via `calcParty`.

## Upper bounds (relaxation, must not underestimate)

### mixUpperBound0

Formula: live farmers get first-layer 24%/4%, second-layer 5000 milli (500%), portrait +50, then teapot.

Relaxations: CE uniqueness, actual CE rates, support seat (recommend pins support in back so real first layer is 20%/0%), COST, missing portraits.

Why it cannot underestimate:

- First layer 24%/4% is the maximum the bond formula allows (support in front). Every real layout is 24%/4% or 20%/0%.
- Second layer in this codebase is CE milli + Bond15 aura. Own slots are at most 6+1 Grand, support at most 2, Bond15 aura at most 5 other farmers * 250 milli. With catalog rates (own 200 milli class, support 150 milli tea, Bond15 250 milli) the stack is below 5000 milli. Oracle/tests fail if a case exceeds the cap.
- Portrait +50 and teapot x2 match the formula's last steps; omitting a portrait only lowers the real total.

### mixUpperBound

Formula: for each live farmer independently, take the top `ownSlots` own-CE millies on that farmer, the top `supCount` support millies, add team Bond15 aura except self, apply first layer 24%/4% if `useSupport` else 20%/0%, add +50, multiply teapot. Then assign the three largest (front-back) gaps to the three front seats.

Relaxations: one CE may be counted for every farmer (uniqueness dropped); recommend support is in the back while UB still uses 24%/4%; portrait is always granted; COST ignored; `ceMilliOn` uses MLB rates.

Why it cannot underestimate:

- A feasible plan assigns each CE to at most one slot, so each farmer's second-layer milli is at most the independent top-k used here.
- Bond15 aura in UB is computed on the same farmer mix the solver is scoring.
- Front assignment uses the true per-servant front-back gap after the relaxed second layer, which upper-bounds any 3-subset front layout on the real (smaller) second layer because `applyRateMilli` is monotone in the first-layer milli.
- MLB rates are at least unmaxed rates.

### mixUpperBound2

Formula: `mixUpperBound` after dropping own CEs whose own cost cannot fit `remainingCost` alone.

Why it cannot underestimate: any CE in a feasible `costUsed <= costLimit` plan has `ceCost <= remainingCost`. Removing infeasible CEs leaves a superset of the CEs a feasible plan may use. The remaining bound is still `mixUpperBound`.

If `costLimit` is unset, `remainingCostFeasible` is true and UB2 equals UB1.

Invariant: `UB >= ReferenceOptimal` on every case. `src/solver-audit.test.js` records cases / violations / min gap.

## Pruning policy

- `ceDominates`: delete zero-hit only
- `eachPrefixCombos`: all k-subsets inside a group
- `uniqueBestRows`: key `(svtId, effectSig)`
- `compressEquivalentRows`: `keep=Infinity`
- Memo key must include form, support, grand, bond15 aura, optimizeBy, pinCe, ownCap, costLimit, frontIds, slotPins

Do not restore "same hits + higher cost → delete".
