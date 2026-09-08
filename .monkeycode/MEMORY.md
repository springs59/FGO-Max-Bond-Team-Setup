# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[迁到新项目时原样粘贴羁绊公式]
- Date: 2026-09-08
- Context: 用户确认改用游戏/Chaldea/Bilibili 6639 的两段 floor；迁到新项目时把本条目公式块原样带过去
- Instructions:
  - 迁到新项目时，把本条目中的公式块原样带过去
  - 前排单独先乘一层并 floor；礼装、午餐/午茶/福尔摩斯、活动被动、15绊在第二层加算后再乘并 floor
  - 英灵肖像 +50 加在两段 floor 之后，不吃百分比
  - 茶壶最后单独 ×2；助战本人不拿羁绊
  - 15绊「梦火的指引」进第二层，可叠；助战 15 绊无效；本人满级拿不到羁绊
  - 伤害公式里的 10 绊礼装是另一套，和通关羁绊获取分开

公式原文：

最终羁绊 = (floor(floor(关卡基础羁绊 × (1 + 前排)) × (1 + Σ第二层百分比)) + Σ固定值) × 茶壶倍率
前排单独先乘一层。礼装、午餐/午茶/福尔摩斯、活动被动、15绊在第二层加算后乘。茶壶最后单独 ×2。助战本人不拿羁绊。

第一层（前排）

前排自己的从者 +20%
助战占前排时，那 20% 平分给自己 5 人，每人 +4%
后排 0%

第二层（加算后再乘）

午餐 2%/满破 10%；午茶自己 1%~5%、助战 3%~15%；芙尔摩斯 1%/满破 5%
属性/职阶/灵衣礼装 4%/满破 20%，只给对上条件的从者
活动从者被动常见 +20% 或 +50%；15绊「梦火的指引」每位 +25%，可叠，助战 15 绊无效

社区写法：前排 60% = 第一层 20% × 第二层 40% 礼装，两段各自 floor。

固定值

英灵肖像 +50，加在两段 floor 之后，不吃百分比。

15绊

固定 +25% 基础羁绊，进第二层。本人满级拿不到羁绊。多个 15 绊加算。

手算样例

基础 815，前排，午餐 10% + 午茶 5% + 一张 20%：

floor(815 × 1.20) = 978
floor(978 × 1.35) = 1320
开茶壶：1320 × 2 = 2640

社区 5 人样例：基础 815，每人满破 20% 礼装 + 肖像 50。

前排：floor(floor(815 × 1.20) × 1.40) + 50 = 1419
后排：floor(floor(815 × 1.00) × 1.40) + 50 = 1191
3 × 1419 + 2 × 1191 = 6639
