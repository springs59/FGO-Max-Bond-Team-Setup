# FGO 羁绊最大化编队推荐器 — 完整实现规格书

## 目录
- 〇、项目概述
- 一、自动更新策略
- 二、羁绊计算公式
- 三、满羁绊从者的处理
- 四、15绊从者的「夢火の導き」
- 五、Σ第二层%完整来源
- 六、20%条件礼装列表
- 七、用户数据层
- 八、搜索算法
- 九、冠位战模式（双冠位）
- 十、两种前置模式
- 十一、助战礼装筛选功能
- 十二、标签体系
- 十三、战斗形象系统（灵基再临与灵衣）
- 十四、从者优先级系统
- 十五、战斗形象优先级系统
- 十六、当前实现缺陷修复
- 十七、核心算法解决方法
- 十八、验证清单
- 十九、项目结构
- 二十、Agent 执行清单
- 二十一、风险与缓解
- 二十二、关键数据

---

## 〇、项目概述

构建一个部署在 GitHub Pages 上的纯前端 FGO 羁绊最大化编队推荐器。用户输入持有的从者、礼装、羁绊等级、羁绊上限和锁定配置，系统在 COST 约束下输出全队总羁绊最大的 6 人编队（5 自出 + 1 助战），并给出每人的礼装配置、总羁绊明细和助战选择理由。

游戏数据通过 GitHub Actions 定时从 Atlas Academy API 抓取并自动提交更新，**用户永远不需要手动填入或更新游戏数据**。

**硬约束**：
- 锁定/练度从者必须上场
- COST 不超上限
- 助战礼装不占 COST
- 部分已定模式下，用户预设内容不可改动

**优化目标**：字典序优化——第一优先级最大化主练从者的羁绊获取总和，第二优先级最大化全队总羁绊。

**核心原则：COST 是约束，不是目标。** 不要求填满 COST，也不要求必须上场 5 人。系统以羁绊总量最大化为唯一目标。

**支持模式**：
- 普通模式：每人 1 礼装槽
- 冠位战模式：己方冠位 + 助战冠位各 3 礼装槽，槽位 2/3 不占 COST
- 全待定模式：前排位置由系统自主决定
- 部分已定模式：用户通过预设模块指定部分内容，系统补全剩余

**核心设计原则**：
- 助战礼装不是事后补丁，而是每个候选队伍评分的内在组成部分
- 礼装是全队光环，对全队满足条件的成员生效
- 满羁绊从者在羁绊计算中贡献为0；其携带的礼装光环仍对队友生效
- 15绊从者给除自身和助战外的队友+25%羁绊
- 位置决策逐人独立计算，禁止用乘数相加
- 去重键为礼装ID，不是效果向量
- COST 不填满也允许
- 从者数量不强制 5 人
- 从者优先级是软偏好，不牺牲羁绊总量
- 战斗形象优先级也是软偏好，默认允许羁绊计算覆盖

---

## 一、自动更新策略

### 1.1 设计原则

**用户永远不需要手动填入或更新游戏数据。** 所有从者、礼装、特性、效果数值均通过自动化流水线从 Atlas Academy API 获取。新从者、新礼装、新特性会在数据源刷新后自动进入系统。Atlas Academy 的数据由服务器自动维护并更新，通常可在游戏更新的一个小时内刷新新数据。

### 1.2 数据源与端点

使用 Atlas Academy FGO Game Data API（https://api.atlasacademy.io），提供 NA 和 JP 两个区域的完整数据。

| 端点 | 用途 |
|---|---|
| `/nice/{region}/servant/search` | 获取所有从者完整数据（含完整 traits） |
| `/nice/{region}/equip/search` | 获取所有礼装完整数据（含羁绊加成效果） |
| `/export/{region}/servant/all.json` | 从者全量导出 |
| `/export/{region}/equip/all.json` | 礼装全量导出 |
| `/export/{region}/nice_trait.json` | 特质定义 |
| `/export/{region}/nice_enums.json` | 游戏枚举值 |

### 1.3 GitHub Actions 定时更新工作流

```yaml
# .github/workflows/update-data.yml
name: Update Game Data

on:
  schedule:
    - cron: '0 0 * * *'
    - cron: '0 */6 * * *'
  workflow_dispatch:
  repository_dispatch:
    types: [atlas-update]

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - uses: actions/cache@v4
        with:
          path: scripts/.cache
          key: atlas-data-${{ github.run_id }}
      - run: pip install httpx fgo-api-types
      - run: python scripts/fetch_data.py
      - run: python scripts/validate_data.py
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/data/
          git diff --cached --quiet || git commit -m "chore: update game data $(date +%Y-%m-%d_%H:%M)"
          git push
```

### 1.4 数据抓取脚本

```python
# scripts/fetch_data.py
import httpx, json, os
from datetime import datetime
from fgo_api_types.nice import NiceServant, NiceEquip

REGION = "JP"
BASE = f"https://api.atlasacademy.io/nice/{REGION}"
EXPORT_BASE = f"https://api.atlasacademy.io/export/{REGION}"
DATA_DIR = "public/data"

def fetch_servants():
    r = httpx.get(f"{EXPORT_BASE}/servant/all.json", timeout=120)
    if r.status_code != 200:
        r = httpx.get(f"{BASE}/servant/search", params={"lang": "en"}, timeout=120)
    servants = []
    for item in r.json():
        s = NiceServant.parse_obj(item)
        servants.append({
            "id": s.id, "name": s.name,
            "className": s.className, "rarity": s.rarity,
            "cost": s.cost,
            "traits": [t.name for t in s.traits],
            "attribute": s.attribute, "gender": s.gender,
            "bondCap": 10, "isGrand": False,
            "battleSprites": extract_battle_sprites(s),
        })
    return servants

def extract_battle_sprites(s):
    """基础战斗形象只有3种：初始、灵基再临第1阶段、灵基再临第3阶段"""
    sprites = []
    for stage in range(3):
        sprites.append({
            "type": "ascension", "stage": stage,
            "displayName": ["初始形象", "灵基再临第1阶段形象", "灵基再临第3阶段形象"][stage],
            "traits": [t.name for t in s.traits],
        })
    for costume in getattr(s, "costumes", []):
        sprites.append({
            "type": "costume", "costumeId": costume.id,
            "name": costume.name, "displayName": f"灵衣：{costume.name}",
            "traits": [t.name for t in s.traits] + ["hasCostume"],
        })
    return sprites

def fetch_craft_essences():
    r = httpx.get(f"{EXPORT_BASE}/equip/all.json", timeout=120)
    if r.status_code != 200:
        r = httpx.get(f"{BASE}/equip/search", params={"lang": "en"}, timeout=120)
    ces = []
    for item in r.json():
        ce = NiceEquip.parse_obj(item)
        effects = extract_bond_effects(ce)
        if effects:
            ces.append({
                "id": ce.id, "name": ce.name,
                "cost": ce.cost, "rarity": ce.rarity,
                "bondEffects": effects,
            })
    return ces

def extract_bond_effects(ce):
    effects = []
    for skill in ce.skills:
        for func in skill.functions:
            if func.funcType == "addIndividuality" or "bond" in str(func).lower():
                effects.append({
                    "selfPercent": func.value,
                    "assistPercent": func.value,
                    "condition": func.condition,
                    "isAssistOnly": func.isAssistOnly,
                })
    return effects

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    servants = fetch_servants()
    ces = fetch_craft_essences()
    json.dump(servants, open(f"{DATA_DIR}/servants.json", "w"), ensure_ascii=False)
    json.dump(ces, open(f"{DATA_DIR}/craft_essences.json", "w"), ensure_ascii=False)
    json.dump({
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "region": REGION, "servantCount": len(servants), "ceCount": len(ces),
    }, open(f"{DATA_DIR}/metadata.json", "w"), ensure_ascii=False)

if __name__ == "__main__":
    main()
```

### 1.5 数据验证脚本

```python
# scripts/validate_data.py
import json, sys

def validate():
    servants = json.load(open("public/data/servants.json"))
    ces = json.load(open("public/data/craft_essences.json"))
    errors = []
    living_human = [s for s in servants if "livingHuman" in s["traits"]]
    if len(living_human) < 20:
        errors.append(f"livingHuman 覆盖数异常: {len(living_human)}")
    for name in ["迦勒底之晨", "报告审查", "手稿之翼", "秘密任务", "至诚一针"]:
        if not any(name in ce["name"] for ce in ces):
            errors.append(f"缺失关键礼装: {name}")
    if len(servants) < 400:
        errors.append(f"从者数异常: {len(servants)}")
    if errors:
        for e in errors: print(f"  - {e}")
        sys.exit(1)
    print(f"验证通过: {len(servants)} 从者, {len(ces)} 礼装")

if __name__ == "__main__":
    validate()
```

---

## 二、羁绊计算公式

### 2.1 最终公式

```
每名从者羁绊 = FLOOR[ FLOOR[ 关卡基础牵绊 × (1 + 先发成员牵绊点数加成) ] × (1 + Σ第二层%) + 英灵肖像固定加成 ] × 茶壶加成
```

- **先发成员牵绊点数加成**：自身在前排 +20%；助战在前排则己方小队全体额外 +4%
- **Σ第二层%**：该从者享受的所有第二层加成之和
- **英灵肖像固定加成**：+50，在第二层乘法之后加算
- **茶壶加成**：使用占星茶壶时 ×2

### 2.2 两个乘区

| 乘区 | 内容 | 计算方式 |
|---|---|---|
| 第一层 | 前排20% + 助战前排4% | 加算后作为整体乘数 |
| 第二层 | 礼装效果 + 15绊光环 + 活动加成 + 玛修光环 | 加算后作为整体乘数 |

两层之间是**乘算关系**。

### 2.3 礼装效果的作用范围

**所有羁绊加成礼装的效果，无论由己方从者装备还是由助战从者装备，都是对全队中满足条件的成员生效。**

不存在"只对携带者自身生效"的羁绊加成礼装（10绊专属羁绊礼装除外）。午茶/午餐等礼装，自己装备和助战装备时数值不同，但作用范围相同——都是全队光环。

### 2.4 午茶效果

午茶效果：**「关卡通关时羁绊值增加1%（最大解放后为5%），助战时提升3%（最大解放时为15%）」**

- 效果是对**全队**生效的
- 己方午茶5% + 助战午茶15% = 全队**20%**

### 2.5 叠加规则

**不同名礼装各算一笔。** 午茶5%、福尔摩斯5%、晚餐5%是三张不同名礼装，各贡献5%，合计15%。

**去重键必须是礼装 ID。**

### 2.6 己方礼装持有约束

达芬奇商店的同一羁绊加成礼装最多兑换5张，刚好够满破一张。因此**己方最多拥有1张满破的某张羁绊加成礼装**。

---

## 三、满羁绊从者的处理

### 3.1 核心定义

**满羁绊从者 = 占位符 + COST消耗 + 羁绊透明。**

判断标准：`当前羁绊等级 < 当前羁绊上限`

| 状态 | 是否参与计算 |
|---|---|
| 12/12 | ❌ |
| 13/13 | ❌ |
| 10/11 | ✅ |
| 14/15 | ✅ |
| 15/15 | ❌ |
| 15/16 | ✅ |

### 3.2 对礼装效果的影响

- 满羁绊从者不享受任何礼装效果
- 满羁绊从者携带的礼装**仍然对全队其他有效从者生效**
- 让满羁绊从者携带光环礼装是理想选择

---

## 四、15绊从者的「夢火の導き」

### 4.1 效果规则

15绊从者给除自身和助战外的所有己方队友提供 **25%羁绊加成**。

- 属于第二层乘区
- 可叠加但边际递减
- **16绊从者仍然保留15绊光环效果**

### 4.2 代码实现

```javascript
function effectiveBond(servant, team, positions, ownCEs, assistCEs) {
    if (servant.bondLevel >= servant.bondCap) return 0;

    const isFront = positions.front.includes(servant.id);
    const assistFront = positions.front.includes(assistId);
    const firstLayer = 1 + (isFront ? 0.20 : 0) + (assistFront ? 0.04 : 0);
    const baseAfterFirst = Math.floor(servant.baseBond * firstLayer);

    let secondLayer = 0;
    for (const ce of ownCEs) {
        if (ce.conditionMet(servant, team, servant.selectedSprite)) secondLayer += ce.percent;
    }
    for (const ce of assistCEs) {
        if (ce.conditionMet(servant, team, servant.selectedSprite)) secondLayer += ce.percent;
    }
    for (const teammate of team) {
        if (teammate.id === servant.id) continue;
        if (teammate.isAssist) continue;
        if (teammate.bondLevel === 15 && teammate.bondCap >= 15) secondLayer += 250;
    }
    secondLayer += activityBonus(servant, team);

    const portrait = servant.hasPortrait ? 50 : 0;
    return Math.floor(Math.floor(baseAfterFirst * (1 + secondLayer / 1000)) + portrait) * (servant.teapot ? 2 : 1);
}
```

### 4.3 玛修的特殊处理

**玛修是唯一COST为0的从者**。

**收益**：15绊全队+25%光环；0 COST解放大量COST
**代价**：占用一个从者栏位，减少一个未满羁绊从者的自身羁绊获取名额

**COST不足时的决策逻辑**：若替换玛修后能装备更高羁绊加成的礼装组合，则推荐玛修方案。

---

## 五、Σ第二层%完整来源

```
Σ第二层% =
    Σ(所有己方礼装中，对该从者生效的效果)
  + Σ(助战礼装中，对该从者生效的效果)
  + Σ(15绊队友提供的25%)
  + 活动加成
  + 玛修光环等其他全队效果
```

---

## 六、20%条件礼装列表

| 礼装名 | 条件 |
|---|---|
| NFFから愛をこめて | ケモノ科（兽科） |
| カルデア・モーニング | 活在当下的人类 |
| レポートチェック | 秩序かつ善 |
| 手稿の翼 | キャスター职阶 |
| シークレット・ミッション | ライダー职阶 |
| 至誠の一針 | 霊衣を持つ者 |
| 幸せな花嫁へ | 秩序の女性 |
| 異星の神 | 星属性または悪 |

"活在当下的人类"覆盖率最低，约24-29人。

---

## 七、用户数据层

```javascript
// localStorage key: "fgo_bond_planner_user_data"
{
    "version": 1,
    "servants": {
        "100": {
            "bondLevel": 10, "bondCap": 15,
            "locked": true, "trained": false,
            "maxAscension": 3,
            "unlockedCostumes": [1001, 1002],
            "preferredSprite": "ascension_2"
        }
    },
    "craftEssences": [1, 2, 3],
    "costLimit": 116,
    "region": "JP",
    "grandServant": 100,
    "assistGrand": { "servantId": 900, "ces": [6001, 6002, 6003] },
    "priorities": [],
    "spritePriority": {
        "mode": "bond_first",
        "order": ["ascension_2", "costume", "ascension_1", "ascension_0"],
        "costumeOrder": [1001, 1002]
    }
}
```

支持从 Chaldea 导入。

---

## 八、搜索算法

### 8.1 问题形式化

**决策变量**：
- 选出自出从者 `T_self ⊆ S`，`L∪E ⊆ T_self`，`|T_self| ≤ 5`
- 为 `T_self` 分配己方礼装（冠位3槽）
- 选择助战从者及其礼装（冠位3槽）
- 决定前排人数（≤3）
- 为每名从者选择战斗形象

**目标**：字典序优化——`maximize (lockedBond_total, totalBond, priorityScore)`

### 8.2 三阶段搜索

**阶段一：从者组合搜索** — BnB，按COST和上界剪枝，贪心warm start。

**阶段二：礼装选择与分配** — 从池中选N张，对全队符合条件的成员生效。

**阶段三：助战礼装枚举** — 枚举所有助战礼装，取总羁绊最大。

**阶段四：战斗形象选择** — 对每名从者，从可用形象中选择使全队羁绊最大的形象。

### 8.3 位置决策

**禁止**使用"前排人数×1.20 + 后排人数×1.00"这类将乘数直接相加的方法。必须逐人独立计算 `floor(floor(base×firstLayer)×secondLayer)+portrait` 后求和。

### 8.4 COST 不作为目标

```javascript
function searchOptimal(userServants, locked, costLimit, ownCEPool, assistCEPool, priorities, spritePriority) {
    let best = null;
    for (let n = locked.length; n <= 5; n++) {
        for (const team of combinations(userServants, n)) {
            if (!containsAll(team, locked)) continue;
            if (sumCost(team) > costLimit) continue;

            const teamWithSprites = team.map(s => ({
                ...s,
                selectedSprite: selectBestSprite(s, team, ownCEPool, assistCEPool, spritePriority).sprite
            }));

            for (const ceCombo of enumerateCECombos(ownCEPool, teamWithSprites.length)) {
                for (const assignment of permutations(ceCombo, teamWithSprites)) {
                    for (const pos of enumeratePositions(teamWithSprites)) {
                        for (const assistCE of assistCEPool) {
                            const bond = totalBond(teamWithSprites, assignment, pos, assistCE);
                            const prio = priorityScore(teamWithSprites, priorities);
                            if (!best || isBetter(bond, prio, best.bond, best.prio)) {
                                best = { team: teamWithSprites, assignment, pos, assistCE, bond, prio };
                            }
                        }
                    }
                }
            }
        }
    }
    return best;
}
```

---

## 九、冠位战模式（双冠位）

### 9.1 冠位从者礼装槽

| 槽位 | 类型 | COST |
|---|---|---|
| 槽位1（自由枠） | 任意概念礼装 | 正常 |
| 槽位2（絆礼装枠） | 该从者专属羁绊礼装（10绊） | 0 |
| 槽位3（増加系礼装枠） | 所有羁绊加成礼装 | 0 |

槽位2/3不占COST。**10绊专属羁绊礼装没有羁绊获取效果**。

### 9.2 双冠位从者

- **己方冠位**：用户指定，3槽，配置由用户控制
- **助战冠位**：好友的从者，3槽，配置由好友决定

**己方冠位礼装同步约束**：自己装备的礼装与好友借用时看到的完全相同。

### 9.3 槽位规则

```javascript
function getSlotCount(servant) { return (servant.isGrand || servant.isAssistGrand) ? 3 : 1; }
function getSlotConstraint(servant, slotIndex) {
    if (!servant.isGrand && !servant.isAssistGrand) return "any";
    return ["any", "bondCE_only", "bonusCE_only"][slotIndex];
}
function getSlotCost(servant, slotIndex, ce) {
    if (!servant.isGrand && !servant.isAssistGrand) return ce.cost;
    return slotIndex === 0 ? ce.cost : 0;
}
```

### 9.4 羁绊上限16

日服已通过「カルデアの大夢火」开放至16级。**16绊从者仍然保留15绊光环效果**。

### 9.5 冠位战基础羁绊

冠位钻研战 Lv100★★★ 为 **4748**。其他难度不同，需从数据源获取。

---

## 十、两种前置模式

### 10.1 全待定模式

用户不指定上场从者。系统搜索从者组合、礼装选择、助战、前排位置、战斗形象。

### 10.2 部分已定模式

用户通过预设模块指定至少1名从者、可能的前排和礼装。系统在这些硬约束下补全剩余。

**预设数据结构**：
```javascript
{
    "lockedServants": [100, 200],
    "trainedServants": [300],
    "frontline": [100, 200, null],
    "servantCEs": { "100": { "slot0": 5001, "slot1": 5002, "slot2": 5003 } },
    "servantSprites": { "100": "ascension_2", "200": "costume_1001" },
    "grandServant": 100,
    "assistGrand": { "servantId": 900, "ces": [6001, 6002, 6003] }
}
```

---

## 十一、助战礼装筛选功能

系统给出**推荐助战礼装列表**，标注每张礼装在该队伍下的**总羁绊贡献**。用户勾选某礼装后，系统**重新筛选**所有满足"助战使用该礼装"的编队方案，并按总羁绊排序。

---

## 十二、标签体系

### 12.1 从者绑定标签

| 字段 | 对应标签 |
|---|---|
| `className` | 职阶标签 |
| `rarity` | 星级标签 |
| `cost` | COST 标签 |
| `attribute` | 属性/阵营标签 |
| `traits` | 全部特性标签 |
| `gender` | 性别标签 |

这些是**从者级属性**，不因战斗形象变化而改变。

### 12.2 标签在搜索中的使用

**条件筛选**：在生成候选池时过滤

**羁绊计算**：对每张已装备的礼装，遍历队伍中每个从者的**当前战斗形象的特性集合**

---

## 十三、战斗形象系统（灵基再临与灵衣）

### 13.1 术语定义

| 术语 | 含义 | 用途 |
|---|---|---|
| **灵基再临** | 养成系统 | 决定哪些战斗形象可用 |
| **战斗形象** | 从者详情页中选择的战斗外观 | 决定战斗中的模型、技能组、特性集合 |
| **灵衣** | 通过任务解锁的额外战斗形象 | 独立的战斗形象选项 |

### 13.2 可用的战斗形象

**排除灵衣后，从者的基础战斗形象只有3种**：

| 战斗形象 | 解锁条件 | 说明 |
|---|---|---|
| **初始形象** | 获得从者时自动解锁 | 0破 |
| **灵基再临第1阶段形象** | 完成第1次灵基再临 | 1破/2破共用 |
| **灵基再临第3阶段形象** | 完成第3次灵基再临 | 3破/4破共用 |

**灵基再临第4阶段（最终再临）不会解锁新的战斗形象**。3破和4破的战斗模型是同一个。

灵衣作为额外选项，开放后会在"战斗形象"栏中出现。

### 13.3 数据结构

```javascript
{
  "id": 100,
  "className": "caster",
  "rarity": 5,
  "cost": 16,
  "baseBond": 1000,
  "battleSprites": [
    { "type": "ascension", "stage": 0, "displayName": "初始形象",
      "traits": ["livingHuman", "caster"] },
    { "type": "ascension", "stage": 1, "displayName": "灵基再临第1阶段形象",
      "traits": ["livingHuman", "caster"] },
    { "type": "ascension", "stage": 2, "displayName": "灵基再临第3阶段形象",
      "traits": ["livingHuman", "caster"] },
    { "type": "costume", "costumeId": 1001, "name": "灵衣名",
      "displayName": "灵衣：灵衣名",
      "traits": ["livingHuman", "caster", "hasCostume"] }
  ]
}
```

### 13.4 从者身份不因战斗形象变化而分裂

无论选择哪个战斗形象，从者 ID、职阶、星级、COST、基础羁绊面板、羁绊等级/上限、是否冠位**永远不变**。配队搜索中，从者只被选中一次。

---

## 十四、从者优先级系统

### 14.1 设计原则

**优先级是软偏好，不牺牲羁绊总量。** 系统首先保证羁绊最大化，当多个方案羁绊总量相同时，才用优先级作为决胜因素。

### 14.2 优先级维度

| 维度 | 示例 |
|---|---|
| **星级** | "5星优先"、"4星优先" |
| **职阶** | "Caster优先" |
| **特性** | "livingHuman优先" |
| **属性/阵营** | "秩序优先"、"善优先" |
| **性别** | "女性优先" |
| **羁绊等级** | "低羁绊优先"（优先练新从者） |
| **羁绊上限** | "16绊优先" |
| **COST** | "低COST优先" |
| **自定义列表** | "这些从者优先" |
| **已开放灵衣** | "有灵衣优先" |

### 14.3 优先级规则的数据结构

```javascript
{
    "priorities": [
        { "id": "rule_1", "type": "rarity", "operator": ">=", "value": 5,
          "weight": 10, "enabled": true, "label": "5星优先" },
        { "id": "rule_2", "type": "trait", "operator": "includes",
          "value": "livingHuman", "weight": 8, "enabled": true,
          "label": "活在当下的人类优先" }
    ],
    "mode": "weighted_sum",  // weighted_sum | lexicographic
    "tieBreaker": "priority"
}
```

### 14.4 优先级评分的计算

```javascript
function priorityScore(team, priorities) {
    let score = 0;
    for (const servant of team) {
        for (const rule of priorities) {
            if (!rule.enabled) continue;
            if (ruleMatches(servant, rule)) score += rule.weight;
        }
    }
    return score;
}

function ruleMatches(servant, rule) {
    switch (rule.type) {
        case "rarity":       return compare(servant.rarity, rule.operator, rule.value);
        case "trait":        return rule.operator === "includes"
                                    ? servant.traits.includes(rule.value)
                                    : !servant.traits.includes(rule.value);
        case "className":    return servant.className === rule.value;
        case "attribute":    return servant.attribute === rule.value;
        case "gender":       return servant.gender === rule.value;
        case "bond_level":   return compare(servant.bondLevel, rule.operator, rule.value);
        case "bond_cap":     return compare(servant.bondCap, rule.operator, rule.value);
        case "cost":         return compare(servant.cost, rule.operator, rule.value);
        case "custom_list":  return rule.value.includes(servant.id);
        case "has_costume":  return servant.battleSprites.some(s => s.type === "costume");
        default:             return false;
    }
}
```

### 14.5 优先级不影响羁绊最大化的保证

**关键设计**：优先级只在羁绊总量**完全相同**时才生效。用户永远不会因为设置了优先级而损失羁绊。

---

## 十五、战斗形象优先级系统

### 15.1 默认选择顺序

1. **灵基再临第3阶段形象**（3破/4破共用）
2. **灵衣**（按用户指定的顺序）
3. **灵基再临第1阶段形象**
4. **初始形象**

**但这是软偏好**。如果某个非优先形象能让全队羁绊更高，系统会选择那个形象。

### 15.2 两种模式

| 模式 | 行为 |
|---|---|
| **羁绊优先**（默认） | 比较所有可用形象的羁绊贡献，选最高的 |
| **严格顺序** | 严格按优先级顺序选第一个可用形象 |

### 15.3 用户配置

```javascript
{
    "spritePriority": {
        "mode": "bond_first",  // bond_first | strict_order
        "order": [
            "ascension_2",   // 灵基再临第3阶段形象
            "costume",       // 灵衣
            "ascension_1",   // 灵基再临第1阶段形象
            "ascension_0"    // 初始形象
        ],
        "costumeOrder": [1001, 1002, 1003],
        "unlockedCostumes": [1001, 1002]
    }
}
```

### 15.4 代码实现

```javascript
function selectBestSprite(servant, team, ownCEs, assistCEs, spritePriority) {
    const availableSprites = servant.battleSprites.filter(
        s => isSpriteAvailable(s, servant)
    );

    if (spritePriority.mode === "strict_order") {
        const sorted = sortSpritesByPriority(availableSprites, spritePriority);
        return { sprite: sorted[0], bond: null };
    }

    let best = null, bestBond = -Infinity;
    for (const sprite of availableSprites) {
        const bond = effectiveBondWithSprite(servant, sprite, team, ownCEs, assistCEs);
        if (bond > bestBond) {
            bestBond = bond;
            best = sprite;
        }
    }
    return { sprite: best, bond: bestBond };
}

function isSpriteAvailable(sprite, servant) {
    if (sprite.type === "costume") {
        return servant.unlockedCostumes?.includes(sprite.costumeId) ?? false;
    }
    return servant.maxAscension >= sprite.stage;
}
```

### 15.5 输出展示

```
最优编队（总羁绊：12345）
├─ 从者A → 战斗形象：灵衣「XXX」
│   理由：灵衣形象命中迦勒底之晨，比默认3破形象多200羁绊
│   羁绊：2500
├─ 从者B → 战斗形象：灵基再临第3阶段形象（默认）
│   羁绊：2400
```

---

## 十六、当前实现缺陷修复

| 缺陷 | 修复 |
|---|---|
| makeCeCands用命中向量去重 | 去重键改为 `ce.id` |
| 从者按COST最低填人 | 改为特质感知填充 + 助战上界评分 |
| 主题队锚定整段关掉 | 改为软偏好 |
| 助战礼装队定完后现算 | 纳入搜索评分 |
| basic_servant缺特质 | 从 `nice_servant` 获取完整traits |
| 礼装只对携带者生效 | 改为遍历全队礼装 |
| 位置评估用乘数相加 | 改为逐人独立计算 |
| 满羁绊从者粗暴排除 | 改为判断"当前等级 < 当前上限" |
| 游戏数据需手动更新 | 改为 GitHub Actions 定时自动抓取 |
| 强制填满COST | 改为COST仅作约束 |
| 无优先级系统 | 新增从者优先级系统 |
| 无战斗形象选择 | 新增战斗形象优先级系统 |

---

## 十七、核心算法解决方法

### 17.1 makeCeCands 的具体修复

```javascript
function buildOwnCEList(userCEs) {
    const byId = {};
    for (const ce of userCEs) {
        if (!byId[ce.id] || ce.limitBreak > byId[ce.id].limitBreak) {
            byId[ce.id] = ce;
        }
    }
    return Object.values(byId);
}
```

### 17.2 特质感知填充的贪心算法

```javascript
function greedyFill(locked, candidates, costLimit, ownCEs, assistCEs, baseBond) {
    let team = [...locked];
    let remainingCost = costLimit - sumCost(locked);
    while (team.length < 5) {
        let best = null, bestScore = -Infinity;
        for (const c of candidates) {
            if (team.includes(c)) continue;
            if (c.cost > remainingCost) continue;
            const bondWith = totalBond([...team, c], ownCEs, assistCEs, baseBond);
            const bondWithout = totalBond(team, ownCEs, assistCEs, baseBond);
            const score = (bondWith - bondWithout) / c.cost;
            if (score > bestScore) { bestScore = score; best = c; }
        }
        if (!best) break;
        team.push(best);
        remainingCost -= best.cost;
    }
    return team;
}
```

### 17.3 BnB 剪枝上界的计算

```javascript
function upperBound(partialTeam, remainingSlots, candidates, costLimit,
                    ownCEs, assistCEs, baseBond) {
    let optimisticTeam = [...partialTeam];
    const sorted = candidates
        .filter(c => !partialTeam.includes(c))
        .sort((a, b) => b.baseBond - a.baseBond);
    for (let i = 0; i < remainingSlots && i < sorted.length; i++) {
        optimisticTeam.push(sorted[i]);
    }
    let maxBond = 0;
    for (const assistCE of assistCEs) {
        const bond = totalBond(optimisticTeam, ownCEs, [assistCE], baseBond);
        maxBond = Math.max(maxBond, bond);
    }
    return maxBond;
}
```

**关键**：上界必须**不低估**。

### 17.4 礼装全队光环遍历的性能优化

```javascript
function precomputeCEMatrix(servants, ces) {
    const matrix = {};
    for (const ce of ces) {
        matrix[ce.id] = {};
        for (const s of servants) {
            for (const sprite of s.battleSprites) {
                const key = `${s.id}_${sprite.type}_${sprite.stage ?? sprite.costumeId}`;
                matrix[ce.id][key] = ce.conditionMet(s, sprite) ? ce.percent : 0;
            }
        }
    }
    return matrix;
}
```

### 17.5 字典序优化的具体实现

```javascript
const W_LOCKED = 1000000;
const W_TOTAL = 1;

function scoreTeam(team, ...) {
    let lockedBond = 0, totalBond = 0;
    for (const s of team) {
        const eb = effectiveBond(s, ...);
        totalBond += eb;
        if (s.isMain) lockedBond += eb;
    }
    return W_LOCKED * lockedBond + W_TOTAL * totalBond;
}
```

### 17.6 冠位3槽的搜索空间控制

- **槽2**：固定为该从者的羁绊礼装
- **槽3**：从加成礼装池中选1张
- **槽1**：默认不放或放最低COST礼装

### 17.7 满羁绊从者携带光环礼装的分配策略

```javascript
function assignCEs(team, cePool) {
    const validServants = team.filter(s => s.bondLevel < s.bondCap);
    const cappedServants = team.filter(s => s.bondLevel >= s.bondCap);
    const auraCEs = cePool.filter(ce => ce.isTeamAura);
    const selfCEs = cePool.filter(ce => !ce.isTeamAura);
    for (const s of cappedServants) {
        if (auraCEs.length > 0) assign(s, auraCEs.pop());
    }
    for (const s of validServants) {
        const best = selectBestCE(s, [...selfCEs, ...auraCEs], team);
        assign(s, best);
    }
}
```

### 17.8 输出结果的结构

```javascript
{
    "team": [
        {
            "id": 100, "name": "...", "position": "front",
            "sprite": { "type": "costume", "costumeId": 1001, "name": "灵衣名" },
            "spriteReason": "灵衣形象命中迦勒底之晨",
            "ce": { "id": 5001, "name": "午茶" },
            "bond": 1234
        }
    ],
    "assist": { "servantId": 900, "ce": {...}, "contribution": 5678 },
    "totalBond": 12345,
    "lockedBond": 3456,
    "priorityScore": 35,
    "costUsed": 98,
    "costLimit": 116,
    "costRemaining": 18,
    "assistCandidates": [...],
    "warnings": []
}
```

---

## 十八、验证清单

| 场景 | 预期结果 |
|---|---|
| 己方携带迦勒底之晨，队伍4人活在当下 | 4人各获得20% |
| 己方午茶5%+助战午茶15% | 全队获得20% |
| 己方A带午茶5%+己方B带午茶5% | 不存在 |
| 5人队4人命中livingHuman | 助战选迦勒底之晨20% |
| 5人队3人命中livingHuman | 助战选午茶15% |
| 12/12锁定从者 | 不参与计算 |
| 14/15锁定从者 | 参与计算 |
| 午茶5%+福尔摩斯5%+晚餐5% | 独立累加15% |
| 15绊从者+4人未满 | 15绊自身0，4人各+25% |
| 全待定模式前排由系统决定 | 输出包含前排配置 |
| 部分已定模式锁定2人 | 2人位置礼装不变 |
| 己方冠位3槽 | 槽2无羁绊效果，槽3放加成礼装 |
| 16绊从者 | 保留15绊光环，自身参与计算 |
| COST不足，替换玛修 | 系统推荐玛修方案 |
| 游戏更新后新从者自动出现 | 无需手动操作 |
| COST充足但5人队羁绊低于4人队 | 输出4人队 |
| 设置"5星优先"规则 | 同分方案中优先5星 |
| 优先级与羁绊冲突 | 羁绊更高方案胜出 |
| 默认战斗形象优先级 | 3破形象 > 灵衣 > 1破 > 初始 |
| 灵衣命中更多20%礼装 | 系统选灵衣 |
| 用户设置"严格顺序" | 严格按顺序选 |

---

## 十九、项目结构

```
├── .github/workflows/
│   ├── update-data.yml
│   └── deploy.yml
├── scripts/
│   ├── fetch_data.py
│   ├── validate_data.py
│   └── .cache/
├── public/data/
│   ├── servants.json
│   ├── craft_essences.json
│   ├── traits.json
│   └── metadata.json
├── js/
│   ├── app.js
│   ├── bond_calculator.js
│   ├── team_searcher.js
│   ├── ce_allocator.js
│   ├── priority_engine.js
│   ├── sprite_selector.js
│   ├── data_loader.js
│   └── user_data.js
├── css/style.css
├── index.html
└── README.md
```

---

## 二十、Agent 执行清单

### Phase 1：数据层（1–2 天）
1. 创建仓库结构
2. 实现 `scripts/fetch_data.py`（含战斗形象提取）
3. 实现 `scripts/validate_data.py`
4. 配置 `.github/workflows/update-data.yml`

### Phase 2：计算层（3–5 天）
5. 实现 `bond_calculator.js`
6. 实现 `team_searcher.js`
7. 实现 `ce_allocator.js`
8. 实现 `priority_engine.js`
9. 实现 `sprite_selector.js`
10. 实现 Web Worker 包装

### Phase 3：前端层（2–3 天）
11. 实现 `user_data.js`
12. 从者/礼装选择 UI
13. 预设模块 UI
14. 优先级配置 UI
15. 战斗形象优先级配置 UI
16. 结果展示

### Phase 4：验证与部署（1–2 天）
17. 运行验证清单
18. 配置 GitHub Pages 部署
19. 编写 README

---

## 二十一、风险与缓解

| 风险 | 缓解 |
|---|---|
| nice层数据量大 | 使用 export 端点 |
| Actions cron延迟 | 每日+每6小时双频率 |
| 前端搜索慢 | Web Worker + 3秒时间预算 |
| 羁绊上限地区差异 | 手动设置 |
| 15绊光环地区差异 | 手动开关 |
| 冠位战地区差异 | 模式切换 |
| Atlas Academy API 不可用 | 缓存 + 回退 |
| COST不填满导致搜索空间增大 | 限制队伍大小枚举 |
| 优先级规则过多导致搜索变慢 | 优先级不参与剪枝 |
| 战斗形象选择增加搜索维度 | 在队伍确定后进行 |

---

## 二十二、关键数据

- 羁绊上限：10（正常），15（5梦火），16（大梦火，日服）
- 15绊光环：25%，除自身和助战外队友，可叠加
- 玛修：奏四后15绊，cost 0，絆25%礼装放置器
- 冠位战基础羁绊：4748（Lv100★★★）
- 20%礼装最低覆盖：活在当下的人类，约24-29人
- 午茶：自己5%/助战15%，全队光环
- 午餐：自己10%/助战10%，全队光环
- 福尔摩斯/晚餐：自己5%/助战5%，全队光环
- **基础战斗形象**：3种（初始、灵基再临第1阶段、灵基再临第3阶段）
- **战斗形象默认优先级**：3破形象 > 灵衣 > 1破形象 > 初始
- **战斗形象默认模式**：bond_first（羁绊优先）