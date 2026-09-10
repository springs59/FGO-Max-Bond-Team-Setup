# Requirements Document

## Introduction

本功能让通关羁绊计算器的界面展示从者与礼装图像。玩家在搜索、选中槽位时能看到从者头像、灵基、灵衣和礼装图，便于辨认上场角色。图像来自与图鉴相同的国服数据源。计算规则、账号导入与推荐配队比较顺序保持不变。

## Glossary

- **系统**：通关羁绊计算器网页
- **槽位图像**：某个编队槽上展示的从者图像与礼装图像
- **从者图像**：该从者在图鉴中的头像、灵基图像或灵衣图像
- **礼装图像**：该羁绊礼装在图鉴中的图像
- **灵基图像**：从者各灵基阶段对应的图像
- **灵衣图像**：从者已记录的灵衣对应的图像
- **默认从者图像**：图鉴为该从者提供的默认头像
- **图像数据源**：与从者/礼装图鉴相同的国服公开资源

## Requirements

### Requirement 1

**User Story:** AS 玩家, I want 选中从者后在槽位上看到该从者的图像, so that 六人编队能一眼认出谁上场

#### Acceptance Criteria

1. WHEN 玩家为某槽位选中一名从者, THE 系统 SHALL 在该槽位展示这名从者的默认从者图像
2. WHEN 该槽位从者被清空, THE 系统 SHALL 收起该槽位的从者图像并保留槽位控件
3. WHEN 搜索建议列出从者, THE 系统 SHALL 在每条建议中展示对应默认从者图像

### Requirement 2

**User Story:** AS 玩家, I want 选中礼装后在槽位上看到礼装图像, so that 能确认午餐、午茶、职阶礼装有没有装对

#### Acceptance Criteria

1. WHEN 玩家为某槽位选中一张羁绊礼装, THE 系统 SHALL 在该槽位展示这张礼装的礼装图像
2. WHEN 该槽位礼装被清空, THE 系统 SHALL 收起该槽位的礼装图像并保留槽位控件
3. WHEN 搜索建议列出礼装, THE 系统 SHALL 在每条建议中展示对应礼装图像

### Requirement 3

**User Story:** AS 玩家, I want 在槽位里切换这名从者的灵基和灵衣图像, so that 显示的立绘/头像和实际使用的外观一致

#### Acceptance Criteria

1. WHEN 某槽位已选中从者且图像数据源提供至少两个灵基图像或灵衣图像, THE 系统 SHALL 提供切换控件列出可用灵基图像与灵衣图像
2. WHEN 玩家选定某一灵基图像或灵衣图像, THE 系统 SHALL 在该槽位改用所选图像
3. WHEN 图像数据源只提供默认从者图像, THE 系统 SHALL 展示默认从者图像并隐藏切换控件
 4. WHEN 玩家切换灵基图像或灵衣图像, THE 系统 SHALL 改用该形态的特质，并按新特质重算职阶/灵衣礼装是否对上
 5. WHEN 玩家用灵衣名称搜索从者, THE 系统 SHALL 命中该从者的对应灵衣形态，不得改用默认灵基特质

### Requirement 4

**User Story:** AS 玩家, I want 图裂了也能继续配队, so that 图像加载失败不影响计算器

#### Acceptance Criteria

1. IF 某张从者图像或礼装图像加载失败, THE 系统 SHALL 在原图像位置展示该从者或礼装的名称，并保持槽位可选、可算
2. IF 图像数据源暂时不可用, THE 系统 SHALL 继续使用已缓存到页面的从者与礼装名称完成搜索与计算

### Requirement 5

**User Story:** AS 玩家, I want 图像和国家服图鉴对得上, so that 看到的是国服资源

#### Acceptance Criteria

1. WHEN 系统展示从者图像或礼装图像, THE 系统 SHALL 使用与当前图鉴相同的国服图像数据源
2. WHEN 仓库快照中的从者或礼装带有图像地址, THE 系统 SHALL 在在线图像数据源失败时使用快照中的图像地址
