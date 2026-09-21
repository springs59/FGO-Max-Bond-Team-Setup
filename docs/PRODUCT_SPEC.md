# Product Spec

现行文档：`PRODUCT_SPEC.md`（产品） / `SOLVER_SPEC.md`（公式与求解器） / `AGENT_TASK.md`（Agent 协议） / `CORRECTNESS_REPORT.md`（验证状态） / `BATTLE_SPEC.md`（战斗边界）。

线上：https://springs59.github.io/FGO-Max-Bond-Team-Setup/

本页是 GitHub Pages 静态通关羁绊计算器。页面启动只读仓库快照，不拉 Atlas 整包。

## Modes

- 自由配队：国服图鉴搜索从者与礼装（普通礼装、10 绊礼装、午餐/午茶/20% 都能搜）。
- 账号配队：导入 Chaldea `userdata.json`，或 `login.php` / `toplogin`。国服/台服正文 URL 解码后再 Base64（`ey` 开头）；日服/美服是 JSON。兼容 PHP `array()` 与 HTTP 信封。非助战槽只用持有库存；15 绊与礼装满破按账号勾。助战仍用完整图鉴。

账号文件只在浏览器内存，刷新即清空。

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

登录回包没有名为「羁绊上限」的字段。当前羁绊是 `friendshipRank`，灯是 `friendshipExceedCount`。上限 = 默认档（玛修 5 / 他人 10）+ 灯数，最高 16。圣杯 `exceedCount` 不抬羁绊上限。当前 ≥ 上限：本人 0。当前 ≥ 15：给队友梦火（本人除外）。

## Quests

关卡级联：种类 → 职阶或章节 → 难度或关卡。选中后写入基础羁绊、普通本/冠位战、职阶。「全部职阶」只出现在未锁职阶的关卡。数值来自快照 `quests.json`（Mooncell 名，Atlas CN `bond`）。`collapseQuests` 合并键是显示名 + AP + 羁绊 + phase。

## Data

启动读取 `src/data/servants.json`、`ces.json`、`quests.json`、`version.json`、`traits.json`、`enemies.json`、`skills.json`、`noble-phantasms.json`。后三份为空时战斗只出结构模板。从者外号只放在 `src/data/aliases.json`（`collectionNo` → `{ name, aliases }`），页面加载时再拼到从者上；快照不把外号写进 `servants.json`。Mooncell 新外号会合并进 aliases，本地多出来的外号会保留。GitHub Actions 每天拉 Atlas CN+JP；校验失败则保留上一版。

## Claims

周回与关卡通关不得宣传游戏内必过。战斗边界见 `BATTLE_SPEC.md`。公式见 `SOLVER_SPEC.md`。
