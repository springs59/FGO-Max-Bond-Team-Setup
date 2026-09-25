# Bond Bonus Spec

活动羁绊走统一引擎 `src/bond/`。app / recommend / solver 不得各自实现活动倍率。

## 两条来源

A. `extraPassive` / `servantFriendshipUp`：从者被动。时间窗 + `quest.eventId === rec.eventId`。`condQuestId` 是解锁条件。
B. `questCampaign` + `questFriendship`：关卡活动。支持 targetIds、全关（questId=0）、指定关、isExcepted。

跳过技能 970663（梦火）和礼装技能 99xxxx。历史窗口不得进入当前结果。

## 计算

`getEffectiveBondBonus`：

- `self`：自身 extraPassive
- `party`：ptFull extraPassive，由 `applyBondBonusesToSlots` 加到己方槽
- `questCampaign`：questFriendship
- `totalSecondLayer = self + questCampaign`

`calculateBond` 是唯一公式入口。公式本身见 `docs/SOLVER_SPEC.md`。

## 快照

Action 写入 `src/data/bond-bonuses.json` 与 `src/data/events.json`。目录非空时求解器关闭 UB。浏览器默认不拉 Atlas。快照失败保留上一版。

## UI

卡片展示自身 / 全队 / 关卡来源。活动加成只走引擎自动识别。`preparedSlots()` 先清零活动倍率再跑引擎。

## Index

Bonus Index 在 Action 生成时按时间窗切开当前有效 self/party/questFriendship。Quest 匹配仍在运行时用 `quest.eventId` / questId 完成。不要把活动 ID 写死成生产逻辑。
