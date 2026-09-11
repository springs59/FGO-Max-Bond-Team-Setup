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
助战占前排时，己方全体再叠 +4%（前排合计 24%，后排 4%）
后排无助战前排时 0%

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

[对照 Chaldea 再改羁绊规则]
- Date: 2026-09-09
- Context: 用户要求自动配队按灵基区分加成，并在操作前参照 Chaldea 仓库数据
- Instructions:
  - 改羁绊公式、礼装条件、灵基特质前，先对照 Chaldea 仓库 `lib/app/modules/bond/` 与 `Servant.getIndividuality`
  - 每个 limit（灵基 0-4 与灵衣 battleCharaId）单独取特质，不能混用默认 traits
  - 礼装 `overWriteTvalsList` 为 AND 组、`functvals` 为 OR；匹配用 signed individuality
  - 国服 Atlas `nice_equip` 的 AND 条件常只在 `script.overwriteTvals`，`overWriteTvalsList` 为空；解析时先读 list，空则读 script
   - 每个灵基/灵衣是一套独立特性；编队按特性进组，礼装按已上场形态的特质结算；同一从者不同形态可作为不同方案竞争；相同特质优先默认灵基

[外号称呼方式参考 Mooncell]
- Date: 2026-09-09
- Context: 用户要求外号称呼方式参考 mooncell
- Instructions:
  - 外号以 Mooncell 微件 ServantsList/data 的 name_other 为准，用 & 分隔
  - 职阶前缀外号原样保留（红Saber、樱Saber、C狐、C狗、R姐）
  - name_other 里 Mooncell 写了的词原样保留，包括蓝呆的 Saber
  - 同名从者用 name_link 的括号职阶区分，例如 库·丘林(Caster)、两仪式(Assassin)
  - 日英官方名可搜索，排在外号后面

[羁绊最大化通用编队]
- Date: 2026-09-09
- Context: 用户要求先穷举各种编队与礼装组合，拉表后定最高通用公式
- Instructions:
  - 单人公式：`floor(floor(B × (1+前排)) × (1+R))`，肖像 +50 加在两段 floor 之后，茶壶最后 ×2
  - 礼装 `target=ptFull` 会叠：R = 全队每张命中该从者的礼装 rate 之和。常驻没有无条件 20%；6 张满破午餐 = 60%
  - 勾选留助战位后固定后排助战位：只排最多 5 名己方拿羁绊；助战位不上从者，只给助战礼装；关掉才 6 己无助战
  - 选礼装按实际通关羁绊穷举组合（每个栏位用该栏位倍率计入命中从者），取总羁绊最高，总羁绊相同时再取练度羁绊最高。去重键是礼装 ID；午茶 5%、福尔摩斯 5%、晚餐 5% 可叠。主题队锚定在有练度/锁定时仍跑。助战按该队命中加总现算：5 人队 20% 命中 ≥4 才超过午茶 15%。迦勒底之晨的 livingHuman 覆盖约 24–29 人是正常的。填人按特质覆盖率/COST（COST 0 最高优先），优先能叠多张条件 20% 的从者；玛修默认 0 COST 仍优先于 Paladin
  - 助战固定后排（前排己方 +20%）；助战礼装用对方副本，不占用己方同一张；冠位战同样：助战冠位只给普通+报酬礼装，不上从者、不写羁绊礼装
  - 己方与助战的同名礼装各记一笔：午茶自己 5%、助战 15%，分开展示和加算；`ApplySupportSvt==0` 的礼装助战戴了不加
  - 能否拿羁绊只看当前羁绊 < 上限，不要按 15/16 等固定档位。当前 >= 15 给梦火光环（本人除外，可叠）；当前 >= 上限才是本人 0、不自动上场。锁定满上限仍占位。账号 bondCap 默认 10，friendshipExceedCount/maxFriendshipRank 可到 16

[冠位战与 20% 礼装]
- Date: 2026-09-09
- Context: Discovered by Agent while performing 深度学习 FGO 对战/羁绊/冠位戴冠戦
- Category: Workflow & Collaboration
- Instructions:
  - 20% 礼装（满破）命中超过一半可拿羁绊的己方时，优于午餐 10%。常驻 20% 全是条件礼装
  - 检查报告=秩序且善（AND）；献给幸福的新娘=秩序女性（AND）；异星之神=恶或星（OR）；手稿之翼=术阶；秘密任务=骑阶；至诚的一针=灵衣；迦勒底之晨=活人；来自NFF的爱=兽科
  - 冠位研钻战锁职阶、必须编冠位从者、可借同职阶冠位助战；7 难度，100★★★ 基础羁绊 4748，消耗 40AP+风暴罐
  - 冠位 3 礼装：普通礼装占 COST；羁绊礼装仅该从者自己的10绊礼装（原效果或 50% NP），通关羁绊不加（Chaldea 跳过 equip2）；报酬礼装仅获得量提升类（午餐/午茶/20%等），免费且计入通关羁绊
  - 冠位助战同样 3 礼装；8 张光环 = 己方冠位普通+报酬 + 其余 4 己方普通 + 助战冠位普通+报酬；助战礼装用对方副本，不占用己方同一张
  - Extra I = 裁定者/复仇者/月之癌/盾兵；Extra II = Alterego/Foreigner/Pretender/可获得兽职（德拉科 beast、Beast Eresh、U-奥尔加玛丽）；图鉴排除所罗门/Beast Boss/E-玛丽等不可获得从者

[COST 上限手填并可按账号锁定]
- Date: 2026-09-09
- Context: 用户要求 COST 自己设置，导入账号后可按御主等级自动锁定；并质疑页面启动拉 Atlas 整包
- Instructions:
  - 推荐给出帕累托方案，按总羁绊从高到低列出（COST 升高则总羁绊升高）；不必强制手填上限
  - 若填写了 COST 数字，只在 COST 不超过该值的方案里取羁绊最高（礼装可不上）；空着则列表第一套即最高羁绊
  - 关卡用级联下拉：种类（修炼场/宝物库/冠位研钻战/每日其他/自由本）→ 职阶或章节 → 难度或关卡；选中后写入基础羁绊、普通本/冠位战、职阶
  - 「全部职阶」只出现在未锁职阶的关卡（宝物库/自由本）
  - 导入登录回包且解析到 userGame.lv / userLv 时，可勾选按账号锁定 COST（Atlas CN NiceUserLevel.maxCost）
  - Chaldea userdata.json 无御主等级，不能从该文件锁定 COST
  - 图鉴加载用仓库快照 servants.json / bond-ces.json，页面启动不拉 Atlas 整包
  - 关卡用仓库 quests.json（Mooncell 名）；修炼场锁职阶；冠位研钻战 9 条 4748/40AP；Atlas CN 每日 bond
  - 一键推荐比较人数与礼装张数，空槽允许
  - 账号导入 localStorage 仅 10 分钟；比较顺序用选择框（全队总羁绊 / 主练羁绊）；助战从者模块后做
  - Actions 拉 JP basic_servant 合并特质并分析，写 metadata.json；NGA 笔记 `.monkeycode/docs/nga-bond-notes.md`
  - 从者 COST 和礼装 COST 一起算
  - 推荐把帕累托方案全部列出，点选切换；羁绊总量最高的放最上面
  - 筛选显示/屏蔽同时作用于搜索和一键推荐；Atlas 属性 human 按人处理
  - 玛修配队按灵基分开算：默认 4 星 COST 0 地属性；Paladin/`c800190`/`c800200` 为 5 星 COST 16 人属性（特质 201→202）。推荐优先 0 COST 默认灵基；筛选星级/属性按形态，Paladin 只在条件需要时上场。快照用 Atlas nice `rarity=4` 覆盖 `basic_servant` 的 3
