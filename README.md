# 通关羁绊计算器

现行文档：

- `docs/PRODUCT_SPEC.md` 产品行为
- `docs/SOLVER_SPEC.md` 羁绊公式与求解器
- `docs/SOLVER_INDEX_SPEC.md` Solver Index 与 Action 预计算
- `docs/BOND_BONUS_SPEC.md` 活动羁绊
- `docs/AGENT_TASK.md` Agent 协议
- `docs/CORRECTNESS_REPORT.md` 验证状态
- `docs/BATTLE_SPEC.md` 战斗边界（本轮冻结）

GitHub Pages 静态页。打开仓库 Pages 地址即可用。

```bash
# 跑公式与账号解析验收
npm test

# 校验图鉴快照 schema
npm run validate-data

# 本地预览
npm run dev

npm run build-solver-index
npm run validate-solver-index
npm run benchmark

# 拉取 Atlas 国服图鉴快照（GitHub Actions 每 6 小时也会跑）
npm run snapshot
```

页面：https://springs59.github.io/FGO-Max-Bond-Team-Setup/

公式：

最终羁绊 = (floor(floor(关卡基础羁绊 × (1 + 前排)) × (1 + Σ第二层百分比)) + Σ固定值) × 茶壶倍率

前排单独先乘一层。礼装、午餐/午茶/福尔摩斯、活动被动、15绊在第二层加算后乘。茶壶最后单独 ×2。助战本人不拿羁绊。

己方前排 +20%。助战占前排时己方全体再叠 +4%（前排 24%，后排 4%）。助战在后排时第一层不加这 4%。普通自动配队会同时比较前排、后排助战，以总羁绊选择位置。

## 配队

 - 自由配队：从完整国服图鉴搜索从者和礼装（普通礼装、从者 10 绊礼装、午餐/午茶/20% 都能搜）
  - 账号配队：导入 Chaldea 的 `userdata.json`，或导入抓包保存的 `login.php` / `toplogin`。国服/台服正文与 Chaldea 相同：URL 解码后再 Base64（`ey` 开头）；日服/美服是 JSON。也兼容 PHP `array()` 和 HTTP 信封。非助战槽只显示持有库存，15 绊和礼装满破按账号自动勾。助战仍用完整图鉴。

登录回包没有名为「羁绊上限」的字段。当前羁绊是 `userSvtCollection.friendshipRank`，羁绊灯是 `friendshipExceedCount`。上限 = 默认档（玛修 5 / 他人 10）+ 灯数，最高 16。圣杯次数是 `userSvt.exceedCount`，不抬羁绊上限。

页面上三种求解模式共用同一套编队与礼装数据：

- 最大羁绊：穷举己方从者与羁绊礼装，以 `assemblePlan()` / `calcParty()` 的精确羁绊为准
- 周回：对更广的 `allPlans` 候选分别做战斗模拟，按最快 / 羁绊优先 / 稳定脚本 / 均衡打分
- 关卡通关：对更广候选分别模拟；`theoreticalClear` 看静态路径，失败率看当前简化模型的随机样本。技能/敌人数据缺失时只给结构模板。`failRate=0` 只表示当前模型与当前样本未失败

启发式只用于排序和 warm start，不会偷偷丢掉更优候选。

导入的账号数据保存在当前浏览器的 `localStorage` 中，刷新后可恢复；10 分钟后过期并清除，也可以在页面中手动清除。请在共用设备上及时清除。

## 游戏数据

从者与礼装搜索都支持编号、名称和外号。字母不区分大小写，兼容全角输入、名称标点和空格，例如 `Ｃ呆`、`C 呆`、`术 C呆`；完整名称或外号命中优先于部分命中。支持“从者外号 + 灵衣名”组合检索，例如 `棉被 风王`。列表仅显示立绘和名称，形态名用于区分同名灵基；普通配队、主练、锁定、钉选及排除入口共用同一规则；账号模式仍只检索该入口允许的持有库存。

从者外号表 `src/data/aliases.json` 随每日快照从 Mooncell 的 `微件:ServantsList/data` 合并更新，并保留本地补充。礼装外号在 `src/data/ce-aliases.json` 中按图鉴编号维护，例如 `黑杯`、`宝石翁`、`小蒙娜`；同一个外号可以对应多个礼装，结果保留所有匹配项。此表与计算数据分开，快照更新不会覆盖手工补充，也不会改变礼装加成或预计算结果。继续扩充时在相应编号的 `aliases` 数组中追加名称即可。

页面启动只读仓库快照：`src/data/servants.json`、`src/data/ces.json`、`src/data/quests.json`、`src/data/version.json`、常规 `src/data/solver-index.json`、活动 `generated/activity-score-index.json`、`src/data/bond-bonuses.json` 和 `generated/solution-index.json`。关卡基础羁绊与关卡阶段绑定，取自 Atlas 国服 `mstQuestPhase.friendshipExp`。单职阶修炼场不限制上场从者职阶；无特殊要求的关卡复用通用计算，按本关基础羁绊结算。活动计算先按加成机制分类，计算模板由自身加成、全队光环、关卡作用范围和目标范围组成；同一模板且实际受影响从者、倍率、助战规则、基础羁绊均相同的关卡共享一次求解。新活动自动匹配已知模板。常规队伍迁入活动候选并逐队重算，活动从者进入队伍时也重算其他成员所受的全队光环和条件礼装；超时方案标记为候选，作为浏览器精确求解的初始下界。账号、COST、茶壶和钉选条件由浏览器求解。每 6 小时更新后需刷新页面。

启动时一并载入 `traits.json`、`enemies.json`、`skills.json`、`noble-phantasms.json`，组装成 `GameData`。后三份没有真实数值时保持空数组，战斗计划只出结构模板。

GitHub Actions 每 6 小时拉 Atlas CN+JP 快照。常规数据指纹改变时重建常规索引；活动数据、时间窗或活动关卡开放状态改变时重建活动矩阵和队伍索引，并复用常规队伍。历史活动按机制模板分类，审计写入 `generated/bond-mechanism-audit.json`；不支持的新羁绊机制使快照失败，避免错误套用。校验、`npm test` 和 benchmark 通过后才提交。

## 精确曲线与组合条件

新增两次取整的羁绊曲线、保留所有从者/形态身份的组合要素索引，以及默认自由配队的礼装向量动态规划。页面分别报告总羁绊、基准和加成量。曲线物化候选标记 `candidate-only`，账号与钉选等条件仍需精确补算。详见 [精确曲线、组合条件与默认查询动态规划](docs/exact-curves-and-factors.md)。

`npm run build-curve-index` 生成曲线及因子文件；`npm run validate-curve-index` 核对全部身份、命中向量和独立公式。Actions 将这些校验纳入提交前流程。

## 多尺寸布局与关卡查找

宽屏电脑将设置和结果并排展示；平板按可用宽度排列关卡和队伍卡片，手机单列并固定底部推荐按钮。主练、锁定和高级筛选默认收起，已指定项目会显示提示。

关卡支持名称、章节、地点、羁绊值联合搜索，可按当前活动、自由本、主线剧情、每日任务、冠位和一次通关筛选。活动主线与活动周回分开标注，默认只列出当前开放的收录关卡；历史和未开放关卡可单独切换查看。选中关卡后会收起查找面板，点“更换关卡”可重新展开；最近六次选择按区服保存在当前浏览器。

`generated/quest-browser-index.json` 从 Atlas Academy 的 `afterClear` 字段保留重复规则。`repeatFirst` / `repeatLast` 对应可重复，`close` / `closeDisp` 对应一次通关，`resetInterval` 对应定期重置，缺少字段时显示未标注。展示索引独立于羁绊求解索引，每日快照更新；开放时间不代表账号已解锁。当前目录仍仅覆盖既有快照收录的含羁绊关卡，并不冒充全部历史剧情目录。

[多尺寸预览](./layout-preview.html) 提供 320、390、640、834、1024、1440 六种宽度，便于验收。

## 2026-10-06 查询和详情修复

普通自动配队使用礼装效果向量与身份/COST 动态规划，比较活动自身和全队增益、账号持有份数、未满破/满破、可用灵基、满绊状态及前后排助战。小规模用独立穷举逐项对照，输出仍通过完整公式重新结算。复杂钉选、冠位和特殊效果继续使用通用求解器；只有搜索完成才能标记最大值。开始新查询时清除旧推荐。提供的实际账号在 Node 验证环境中约 0.69 秒完成原本超过 30 分钟的普通查询，结果 15039、COST 116；设备和约束不同会影响耗时。

补入 Mooncell 术语表及礼装页面的 44 项外号映射，来源见 [ALIAS-SOURCES.md](docs/ALIAS-SOURCES.md)。礼装详情合并为一个界面：队伍内查看当前队伍作用对象，自出/助战套装查看全部推荐队伍的去重作用对象；助战礼装筛选保持筛选操作。

从者详情按所选灵基显示自身特性和主动技能、职阶技能、宝具效果，采用该形态最新可用强化版本。灵基切换同步星级、职阶、属性、COST 和详情。445 名国服从者基础字段已与 Atlas 国服 nice 数据逐项核对；形态覆盖字段及独有职阶技能一并保存为离线快照，国服详情不再回退到未实装的日服资料。玛修圣骑士显示五星、人属性及该形态技能。


## 国服与日服

两服使用独立的从者、礼装、灵基、技能、活动和关卡快照；同 ID 的强化与实装差异也按区服处理。切服会清除旧队伍与关卡，并恢复对应账号和偏好。外号、显示名和计算规则共用，国服预计算仅用于国服。日服快照不可用时阻止推荐，不以国服补齐。详情见 [区服数据边界](docs/REGION-DATA.md)。
