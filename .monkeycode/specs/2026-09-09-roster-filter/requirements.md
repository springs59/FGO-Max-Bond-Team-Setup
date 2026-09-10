# Requirements Document

## Introduction

玩家在搜索从者与羁绊礼装时，需要 Chaldea / Mooncell 同款筛选：按职阶、星级、属性、特性决定看见谁、屏蔽谁。搜索结果把满破羁绊加成更高的排在上面。页面正文字体改为无衬线，降低长时间点选的阅读负担。

## Glossary

- **显示**：该组有选项时，只保留命中该组的从者
- **屏蔽**：该组有选项时，去掉命中该组的从者
- **全中**：特性组需同时具备所选全部特性
- **满破加成**：礼装满破技能的羁绊百分比（rate / 10）

## Requirements

### Requirement 1

**User Story:** AS 玩家, I want 按职阶、星级、属性、特性筛选从者, so that 搜索列表只留下我要看的人

#### Acceptance Criteria

1. WHEN 玩家点选某一职阶、星级、属性或特性, THE 系统 SHALL 把该选项加入对应筛选组
2. WHEN 某一筛选组处于显示且已有选项, THE 系统 SHALL 只在从者搜索结果中保留命中该组的从者
3. WHEN 某一筛选组处于屏蔽且已有选项, THE 系统 SHALL 从从者搜索结果中去掉命中该组的从者
4. WHEN 玩家点「清空」, THE 系统 SHALL 撤掉全部筛选选项并恢复显示
5. WHEN 玩家触发一键推荐且某一筛选组已有选项, THE 系统 SHALL 只从通过该筛选的从者中排出编队
6. WHEN 从者属性为 Atlas 的 human, THE 系统 SHALL 把它与人属性视为同一项

### Requirement 2

**User Story:** AS 玩家, I want 特性筛选能要求同时命中多项, so that 我能找出秩序且善这类组合

#### Acceptance Criteria

1. WHEN 特性组开启全中且选了至少两项, THE 系统 SHALL 只保留同时具备所选全部特性的从者
2. WHEN 特性组未开启全中且选了至少一项, THE 系统 SHALL 保留具备其中任一项特性的从者

### Requirement 3

**User Story:** AS 玩家, I want 搜索结果把高羁绊加成放在最上面, so that 我先看到 20% 礼装和能吃到高加成的从者

#### Acceptance Criteria

1. WHEN 系统列出羁绊礼装搜索结果, THE 系统 SHALL 按满破加成从高到低排列，加成相同则按图鉴编号升序
2. WHEN 系统列出从者搜索结果, THE 系统 SHALL 在名称匹配分相同的情况下，按该从者任意形态能吃到的最高满破礼装加成从高到低排列

### Requirement 4

**User Story:** AS 玩家, I want 页面正文字体更容易扫读, so that 长时间筛选和点选不那么累

#### Acceptance Criteria

1. WHEN 页面加载, THE 系统 SHALL 使用无衬线中文字体显示正文、按钮与筛选标签
2. WHEN 显示关卡羁绊与 COST 数字, THE 系统 SHALL 使用等宽数字字形
