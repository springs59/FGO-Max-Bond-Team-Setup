# Product Spec

现行文档：`PRODUCT_SPEC.md`（产品） / `SOLVER_SPEC.md`（公式与求解器） / `AGENT_TASK.md`（Agent 协议） / `CORRECTNESS_REPORT.md`（验证状态） / `BATTLE_SPEC.md`（战斗边界）。

线上：https://springs59.github.io/FGO-Max-Bond-Team-Setup/

本页是 GitHub Pages 静态通关羁绊计算器。页面启动只读仓库快照，不拉 Atlas 整包。

## Modes

- 自由配队：国服图鉴搜索从者与礼装（普通礼装、10 绊礼装、午餐/午茶/20% 都能搜）。
- 账号配队：导入 Chaldea `userdata.json`，或 `login.php` / `toplogin`。国服/台服正文 URL 解码后再 Base64（`ey` 开头）；日服/美服是 JSON。兼容 PHP `array()` 与 HTTP 信封。非助战槽只用持有库存；15 绊与礼装满破按账号勾。助战仍用完整图鉴。

导入账号保存在当前浏览器或安装版的本机 `localStorage`，刷新或重新打开可恢复，不按时间自动过期；重新导入替换对应区服账号。「清除本机账号」删除本机保存的国服与日服账号，并切回自由配队。

## Solvers

三种模式共用同一套编队与礼装，真值都是 `assemblePlan()` → `calcParty()`。

- 最大羁绊：穷举己方从者与通关羁绊礼装，按 `comparePlans` 取最优。
- 周回：对更广 `allPlans` 做战斗模拟，档位 `fastest` / `bond_first` / `stable_script` / `balanced`。可通关（当前模型）始终排第一。
- 关卡通关：对更广候选模拟。`theoreticalClear` 看静态路径；`failRate` 看当前简化模型的随机样本。技能/敌人数据缺失时只给结构模板。

自动推荐只穷举常驻通关羁绊礼装（午餐/午茶/20% 等）。全量 `ces.json` 只给图鉴与手动搜索。

启发式只排序和 warm start，不删可能最优候选。

## Support

勾选留助战位后，自动推荐把助战固定 6 号后排：不上从者，只给助战礼装，己方最多 5 人拿羁绊。第一层按前排己方 +20%、后排 0%。手动把助战拖到前排时走 `calcParty` 的 24%/4%。助战本人不拿羁绊。

## Pins

卡片「钉住此位」与进阶 1–6 号预设共用 `slot.pinned`。有礼装一起钉；`ceId=0` 时礼装仍由求解器配。助战 6 号只钉礼装。同一从者不能钉进两个己方格。

错误文案：`站位钉住不能重复从者` / `锁定超出编队上限` / `该锁定无法满足`。

## COST

COST 是约束。从者 COST 与礼装 COST 一起算；助战礼装与冠位报酬礼装不计己方 COST。空着则帕累托列表第一套即最高羁绊。填写数字时只在 `costUsed <= limit` 的方案里按 `comparePlans` 取。导入登录回包且解析到御主等级时，可按 Atlas CN `NiceUserLevel.maxCost` 锁定。Chaldea userdata.json 无御主等级，不能从该文件锁 COST。

## Bond cap

登录回包没有名为「羁绊上限」的字段。当前羁绊是 `friendshipRank`，灯是 `friendshipExceedCount`。上限 = 默认档（玛修 5 / 他人 10）+ 灯数，最高 16。圣杯 `exceedCount` 不抬羁绊上限。当前 ≥ 上限：本人 0。当前 ≥ 15：给队友梦火（本人除外）。账号推荐仍考虑已满羁绊但能提供 15 绊或活动全队光环的从者。

## Quests

关卡级联：种类 → 职阶或章节 → 难度或关卡。选中后写入该关卡的基础羁绊和阶段。普通关卡的职阶描述敌方，不限制己方从者；仅有特殊上场规则的关卡才施加职阶约束。数值来自快照 `quests.json`（Mooncell 名，Atlas CN 原始 `mstQuestPhase.friendshipExp`）。`collapseQuests` 合并键是显示名 + AP + 羁绊 + phase。

## Data

启动读取 `src/data/servants.json`、`ces.json`、`quests.json`、`version.json`、`traits.json`、`enemies.json`、`skills.json`、`noble-phantasms.json`，以及 `solver-index.json` 内的活动加成矩阵和 `generated/solution-index.json` 内的默认解。无约束普通修炼场、宝物库及在 Action 时间预算内算出的活动关卡可以命中精确默认解；超时的活动关卡、账号、COST、茶壶和钉选约束在浏览器求解。后三份为空时战斗只出结构模板。从者外号只放在 `src/data/aliases.json`（`collectionNo` → `{ name, aliases }`），页面加载时再拼到从者上；快照不把外号写进 `servants.json`。Mooncell 新外号会合并进 aliases，本地多出来的外号会保留。GitHub Actions 每 6 小时拉 Atlas CN+JP、计算并校验索引；校验失败则保留上一版。新快照需要重新打开或刷新页面才会载入。

## Claims

周回与关卡通关不得宣传游戏内必过。战斗边界见 `BATTLE_SPEC.md`。公式见 `SOLVER_SPEC.md`。


### 聚合本地方案与计算库

所有查询及已实际算出的候选、曲线写入同一个库；保存不以最优或 Top-N 作为门槛。相同候选内容去重，物理编队只以成员、灵基、礼装、满破要求及位置确定身份，独立于账号、库存和旧分数。CE 排序阶段的数值观察与最终结算编队区分存储，不把前者当作已核实编队。

完整有效输入与当前归档修订相同时直接返回已完成答案，跨进程重启及导入迁移后同样跳过搜索。无关账号名称、时间戳或货币变化不失效；影响计算的库存、羁绊、礼装、活动、关卡、规则或数据变化须重新核实。失败的归档不能提交“完整已保存”的精确命中。

界面展示库的汇总与覆盖数量，从整个库检索可适配的编队。导出整个库一次仅生成一个压缩文件，包含答案、候选、完整曲线和物理方案；导入自动去重、保留冲突并原子合并，兼容旧备份。已计算结果长期保留；不为归档额外穷举未展开或剪枝的组合。原生端分块传输、流式保存同一个文件。存储不足或文件超出导入设备限制时提示失败，不静默丢弃已有结果。
