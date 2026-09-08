# Requirements Document

## Introduction

本功能把通关羁绊计算器做成 GitHub Pages 静态站，并增加账号配队。游戏图鉴（从者、羁绊礼装）跟随 Atlas 国服自动更新。账号数据由玩家在浏览器里导入 Chaldea 备份 JSON 或国服登录回包 JSON。羁绊公式沿用已锁定的两段 floor。

## Glossary

- **系统**：通关羁绊计算器网页
- **游戏数据**：从者列表、羁绊礼装、关卡基础羁绊等公开图鉴
- **账号数据**：玩家持有的从者、礼装、羁绊等级
- **自由配队**：从完整图鉴里选择上场从者与礼装
- **账号配队**：从已导入的持有库存里选择上场从者与礼装
- **Chaldea 备份**：Chaldea 应用导出的 `userdata.json`
- **登录回包**：玩家自行保存的国服登录成功 JSON，内含 `userSvt` / `userSvtCollection`
- **快照**：仓库内缓存的国服图鉴 JSON，供 Atlas 现场请求失败时使用

## Requirements

### Requirement 1

**User Story:** AS 玩家, I want 在 GitHub 上打开这个静态页, so that 不用自己起本地服务器

#### Acceptance Criteria

1. WHEN 玩家打开 GitHub Pages 地址, THE 系统 SHALL 加载计算器页面并可以计算羁绊
2. WHEN 页面请求静态资源, THE 系统 SHALL 使用相对路径加载 `index.html` 与 `src/` 下的脚本和样式
3. WHEN 仓库 `main` 分支收到推送, THE 系统 SHALL 由 GitHub Actions 发布 GitHub Pages

### Requirement 2

**User Story:** AS 玩家, I want 游戏图鉴自动跟着国服更新, so that 新从者和新羁绊礼装不用手改

#### Acceptance Criteria

1. WHEN 页面启动, THE 系统 SHALL 优先从 Atlas Academy 国服接口拉取从者列表
2. WHEN Atlas 现场拉取失败且仓库快照存在, THE 系统 SHALL 改用仓库内从者快照
3. WHEN 页面启动, THE 系统 SHALL 优先从 Atlas Academy 拉取羁绊礼装并瘦身，失败时使用仓库内 `bond-ces.json`
4. WHEN GitHub Actions 每日快照任务运行, THE 系统 SHALL 把最新国服从者列表与羁绊礼装写入仓库快照
5. WHEN 玩家读取关卡基础羁绊, THE 系统 SHALL 向 Atlas 国服关卡接口请求该关卡的基础羁绊

### Requirement 3

**User Story:** AS 玩家, I want 在自由配队和账号配队之间切换, so that 没有账号文件时也能手搭，有账号文件时只从库存里选

#### Acceptance Criteria

1. WHEN 玩家选择自由配队, THE 系统 SHALL 在从者搜索中提供完整国服图鉴
2. WHEN 玩家选择账号配队且尚未导入账号数据, THE 系统 SHALL 提示导入 Chaldea 备份或登录回包 JSON
3. WHEN 玩家选择账号配队且已导入账号数据, THE 系统 SHALL 在非助战槽的从者搜索中只列出持有从者
4. WHEN 玩家选择账号配队, THE 系统 SHALL 在非助战槽的礼装搜索中只列出持有的羁绊礼装
5. WHEN 玩家在账号配队下把某槽标为助战, THE 系统 SHALL 对该槽使用完整图鉴搜索从者和礼装

### Requirement 4

**User Story:** AS 玩家, I want 导入 Chaldea 备份或登录回包 JSON, so that 库存和 15 绊状态来自我的账号

#### Acceptance Criteria

1. WHEN 玩家选择一个 JSON 文件, THE 系统 SHALL 在浏览器内存中解析该文件
2. WHEN JSON 含 Chaldea 的 `users` / `svtStatus` / `craftEssenceStatus` 结构, THE 系统 SHALL 抽出持有从者、羁绊等级与礼装满破档
3. WHEN JSON 含 `userSvtCollection` 或 `userSvt`, THE 系统 SHALL 按 Chaldea import 同源字段抽出持有从者、`friendshipRank` 与礼装 `limitCount`
4. WHEN `userSvtCollection` 记录带 `status` 且数值小于 2, THE 系统 SHALL 将该记录排除出持有从者
5. WHEN 解析成功, THE 系统 SHALL 显示持有从者人数与羁绊礼装张数
6. IF JSON 无法解析或找不到从者记录, THE 系统 SHALL 提示文件格式无法识别

### Requirement 5

**User Story:** AS 玩家, I want 从库存点选从者时自动带上 15 绊标记, so that 满级从者不用手勾

#### Acceptance Criteria

1. WHEN 玩家在账号配队下选中一名 `bondLv` 或 `friendshipRank` 大于等于 15 的持有从者, THE 系统 SHALL 勾选该槽的 15 绊
2. WHEN 玩家在账号配队下选中一名羁绊等级小于 15 的持有从者, THE 系统 SHALL 将该槽 15 绊按未勾选处理
3. WHEN 玩家在账号配队下选中一张持有礼装且 `limitCount` 大于等于 4, THE 系统 SHALL 勾选该槽礼装满破
4. WHEN 玩家在账号配队下选中一张持有礼装且 `limitCount` 小于 4, THE 系统 SHALL 将该槽礼装满破按未勾选处理
5. WHEN 玩家手动改 15 绊或满破勾选, THE 系统 SHALL 保留玩家当次改动直到再次选中从者或礼装

### Requirement 6

**User Story:** AS 玩家, I want 账号文件只留在我的浏览器, so that GitHub 页面拿不到我的仓库

#### Acceptance Criteria

1. WHEN 玩家导入账号 JSON, THE 系统 SHALL 只在当前页面内存中保存解析结果
2. WHEN 玩家刷新页面, THE 系统 SHALL 清空已导入的账号数据并回到未导入状态

## Locked Decisions

1. 羁绊公式沿用 `.monkeycode/MEMORY.md` 中的两段 floor，本功能不改公式。
2. 账号数据来源是玩家上传的文件。页面不发起国服登录，不拦截网络。
3. 游戏数据更新走 Atlas 国服公开接口加仓库每日快照。
4. 助战槽使用完整图鉴，因为助战来自好友。
