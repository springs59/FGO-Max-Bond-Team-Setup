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

# 拉取 Atlas 国服图鉴快照（GitHub Actions 每天也会跑）
npm run snapshot
```

页面：https://springs59.github.io/FGO-Max-Bond-Team-Setup/

公式：

最终羁绊 = (floor(floor(关卡基础羁绊 × (1 + 前排)) × (1 + Σ第二层百分比)) + Σ固定值) × 茶壶倍率

前排单独先乘一层。礼装、午餐/午茶/福尔摩斯、活动被动、15绊在第二层加算后乘。茶壶最后单独 ×2。助战本人不拿羁绊。

己方前排 +20%。助战占前排时己方全体再叠 +4%（前排 24%，后排 4%）。助战在后排时第一层不加这 4%。自动推荐把助战放在 6 号后排。

## 配队

 - 自由配队：从完整国服图鉴搜索从者和礼装（普通礼装、从者 10 绊礼装、午餐/午茶/20% 都能搜）
  - 账号配队：导入 Chaldea 的 `userdata.json`，或导入抓包保存的 `login.php` / `toplogin`。国服/台服正文与 Chaldea 相同：URL 解码后再 Base64（`ey` 开头）；日服/美服是 JSON。也兼容 PHP `array()` 和 HTTP 信封。非助战槽只显示持有库存，15 绊和礼装满破按账号自动勾。助战仍用完整图鉴。

登录回包没有名为「羁绊上限」的字段。当前羁绊是 `userSvtCollection.friendshipRank`，羁绊灯是 `friendshipExceedCount`。上限 = 默认档（玛修 5 / 他人 10）+ 灯数，最高 16。圣杯次数是 `userSvt.exceedCount`，不抬羁绊上限。

页面上三种求解模式共用同一套编队与礼装数据：

- 最大羁绊：穷举己方从者与羁绊礼装，以 `assemblePlan()` / `calcParty()` 的精确羁绊为准
- 周回：对更广的 `allPlans` 候选分别做战斗模拟，按最快 / 羁绊优先 / 稳定脚本 / 均衡打分
- 关卡通关：对更广候选分别模拟；`theoreticalClear` 看静态路径，失败率看当前简化模型的随机样本。技能/敌人数据缺失时只给结构模板。`failRate=0` 只表示当前模型与当前样本未失败

启发式只用于排序和 warm start，不会偷偷丢掉更优候选。

账号文件只在浏览器内存里，刷新即清空。

## 游戏数据

页面启动只读仓库快照：`src/data/servants.json`、`src/data/ces.json`、`src/data/quests.json`、`src/data/version.json`、`src/data/solver-index.json`、`src/data/bond-bonuses.json`。关卡基础羁绊按关卡名搜索（Mooncell 写法，如「狂之修炼场 上级」），数值来自 Atlas 国服 `bond` 字段，与 Chaldea 同源。自动推荐默认 Query → Index → 过滤 → 小规模精确 BnB，只穷举通关羁绊增益礼装。

启动时一并载入 `traits.json`、`enemies.json`、`skills.json`、`noble-phantasms.json`，组装成 `GameData`。后三份没有真实数值时保持空数组，战斗计划只出结构模板。

GitHub Actions 每天拉 Atlas CN+JP 快照，再跑 `validate-data`、`build-solver-index`、`validate-solver-index`、`npm test`、`benchmark`，通过才提交。校验失败则保留仓库里上一份可用数据。
