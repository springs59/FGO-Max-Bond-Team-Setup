# 通关羁绊计算器

GitHub Pages 静态页。打开仓库 Pages 地址即可用。

```bash
# 跑公式与账号解析验收
npm test

# 本地预览
npm run dev

# 拉取 Atlas 国服图鉴快照（GitHub Actions 每天也会跑）
npm run snapshot
```

页面：https://springs59.github.io/FGO-Max-Bond-Team-Setup/

公式：

最终羁绊 = (floor(floor(关卡基础羁绊 × (1 + 前排)) × (1 + Σ第二层百分比)) + Σ固定值) × 茶壶倍率

前排单独先乘一层。礼装、午餐/午茶/福尔摩斯、活动被动、15绊在第二层加算后乘。茶壶最后单独 ×2。助战本人不拿羁绊。

## 配队

- 自由配队：从完整国服图鉴搜索从者和羁绊礼装
- 账号配队：导入 Chaldea 的 `userdata.json`，或导入你已经保存的国服登录回包 JSON（含 `userSvt` / `userSvtCollection`）。非助战槽只显示持有库存，15 绊和礼装满破按账号自动勾。助战仍用完整图鉴。

账号文件只在浏览器内存里，刷新即清空。

## 游戏数据

从者优先请求 Atlas Academy 国服，失败时用 `src/data/servants.json`。羁绊礼装用仓库快照 `src/data/bond-ces.json`（Atlas 礼装搜索已不再支持按 funcType 过滤）。Actions 每天更新快照。
