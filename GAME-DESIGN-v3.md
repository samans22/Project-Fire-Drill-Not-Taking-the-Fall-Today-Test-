# 🏢 项目救火办：今日不背锅 — 策划案 v3.0（整合版）

> **整合来源**: GAME-DESIGN-v2.md + GAME-REVIEW-ROADMAP.md + INTEGRATED-ROADMAP.md + GAME-DESIGN-TABLES.md
> **更新日期**: 2026-07-22
> **当前版本**: v0.8（P0 + P1 已实现，P2 起步）
> **定位**: 程序实现指南 — 从 P2 阶段开始的全部策划需求

---

## 一、当前状态（v0.8 基线）

### 1.1 已实现系统

| 系统 | 状态 | 关键文件 |
|------|------|----------|
| 核心循环（事件→选择→反馈→推进） | ✅ 完成 | `game.js` |
| 四维数值 + 健康度颜色 | ✅ 完成 | `game.js`, `ui.js` |
| 19 主题 + modifier + 加权事件池 | ✅ 完成 | `themes.json`, `events.js` |
| 主题文本覆写（textOverrides） | ✅ 完成 | `themes.json`, `events.js` |
| 70/30 boosted/general 事件抽取 | ✅ 完成 | `events.js:_themeWeightedPick` |
| 动态难度层级（difficultyTier 1-4） | ✅ 完成 | `game.js` |
| 每日事件配额（3 件/天） | ✅ 完成 | `game.js`, `main.js` |
| 多阶段事件（pendingNextEventId） | ✅ 完成 | `main.js`, `events.json` |
| 文本池系统（515 条，按主题索引） | ✅ 完成 | `text-pool.json`, `balancer.js` |
| 综合评分 compositeScore | ✅ 完成 | `balancer.js:computeComposite` |
| 动态文本选择 selectTexts() | ✅ 完成 | `balancer.js:selectTexts` |
| 四维压力计算 calcPressure() | ✅ 完成 | `balancer.js:calcPressure` |
| 文本适配度 calcFitness() | ✅ 完成 | `balancer.js:calcFitness` |
| 震荡修正（连续高/低收益强制转向） | ✅ 完成 | `balancer.js` |
| Tooltip 增强（效果数值预览） | ✅ 完成 | `balancer.js:formatEffectsHint` |
| 群聊活化（氛围/预警/事件反应） | ✅ 完成 | `chat.js` |
| 11 结局 + 条件匹配 | ✅ 完成 | `endings.json`, `game.js` |
| 3 项目包 × 8 角色 | ✅ 完成 | `projects.json`, `characters.json` |
| 自动存档（localStorage） | ✅ 完成 | `storage.js` |

### 1.2 当前数据规模

| 指标 | 数值 |
|------|------|
| 事件总数 | 94（E001-E046, M001-M008 子事件, T001-T013 子事件） |
| 文本池总量 | 515 条（19 主题，每主题 17-42 条） |
| 主题数 | 19（全部配置 eventPool + modifier） |
| 结局数 | 11 |
| 角色数 | 8 |
| 项目包 | 3 |
| 连锁路径 | 6+ |

### 1.3 当前已知问题

| # | 问题 | 严重度 | 说明 |
|---|------|--------|------|
| B1 | 约 45 条文本的 eventId 为占位符（N_M01 等） | 🔴 高 | 这些文本永远不会被选中——eventId 不匹配任何真实事件 |
| B2 | text-pool.json 存在重复文本 | 🟡 中 | T0001 和 T0003 完全一致——CSV 生成脚本的遗留问题 |
| B3 | ui.js 调用 `Balancer.selectFromPool()` 但该方法不存在 | 🔴 高 | 旧格式 pool 数组的动态选择功能已失效 |
| B4 | text-pool.json 中 `_total: 515` 包含了 orphans | 🟡 中 | 实际可用的文本少于 515 |

---

## 二、P2 — 文本池内容品质提升（2-3 周）

> **目标**: 修复孤儿文本和重复文本，提升文本叙事质量，确保每个事件有足够的可选文本

### 2.1 修复孤儿文本（B1）

**问题描述**: text-pool-balanced.csv 生成时，为 9 个薄主题创建了 scaffold 文本（正规处理/取巧解决/冒险尝试），但它们的 eventId 使用了占位符（N_M01, N_L01 等），与 events.json 中任何真实事件都不匹配。

**影响范围**: ~45 条文本（约 9% 的文本池）当前不可达。

**修复方案**:

1. 将 45 条孤儿文本的 eventId 改为真实事件 ID
2. 分配原则：根据文本的 themeId，查该主题的 boosted 事件列表，将孤儿文本分配给该主题最相关的事件
3. 分配后确保每个主题的核心事件至少有 3 条可选文本

**各主题孤儿文本分配参考**:

| themeId | 孤儿 ID 前缀 | 建议分配的 eventId |
|----------|-------------|-------------------|
| monday_morning | N_M01~N_M05 | E004, E022, E011 |
| last_minute | N_L01~N_L05 | E011, E014, E035 |
| friday_afternoon | N_F01~N_F05 | E011, E014, E035 |
| pr_crisis | N_P01~N_P05 | E015, E020, E037 |
| pre_holiday | N_H01~N_H05 | E041, E011, E014 |
| new_boss | N_B01~N_B05 | E004, E013, E022 |
| quarterly_review | N_Q01~N_Q05 | E009, E015, E021 |
| last_workday | N_W01~N_W05 | E014, E039, E012 |
| kickoff | N_K01~N_K05 | E004, E025, E003 |

### 2.2 文本去重（B2）

**问题描述**: text-pool.json 中存在完全重复的文本条目（相同 text + 相同 effects + 相同 feedback）。

**修复方案**:

1. 程序侧：写一个去重脚本，按 `(themeId, text, effects)` 三元组去重
2. 策划侧：对于被删除的重复条目，手工补充等量的新文本
3. 去重后确保每主题仍 ≥ 17 条文本

### 2.3 修复 selectFromPool 缺失（B3）

**问题描述**: `ui.js:100` 调用 `Balancer.selectFromPool(choice.pool, state.stats, state.day)`，但 `balancer.js` 中没有这个方法。

**背景**: 旧格式 events.json 中，部分 choice 带有 `pool` 数组（75 条 pool 文本）。在 v0.8 中，文本选择改为 `_injectTextPoolChoices()` 从 text-pool.json 按 eventId 匹配，但 `ui.js` 仍然保留了旧的 pool 处理逻辑。

**修复方案**（二选一）:

- **方案 A（推荐）**: 在 `balancer.js` 中添加 `selectFromPool(pool, stats, day)` 方法作为兼容层——内部调用 `selectTexts(pool, stats, day, 1)`
- **方案 B**: 移除 `ui.js` 中的旧 pool 处理逻辑，全部走 `_injectTextPoolChoices()`

### 2.4 文本叙事品质提升

**问题描述**: ~189 条新增 scaffold 文本使用模板化句式（"正规处理：逐条修改确保合规" / "取巧解决：灵活应对寻捷径" / "冒险尝试：大胆推进赌一把"），缺乏职场质感和具体场景。

**提升方向**:

| 维度 | 当前 | 目标 |
|------|------|------|
| 文本具体性 | "灵活应对寻捷径" | "改两处措辞，第三处加脚注说明数据口径" |
| 反馈叙事性 | "问题解决了" | "合规陈老师看了一眼，说'你这是在走钢丝'——但没有驳回" |
| 职场黑话密度 | 低 | 中高（"对齐一下""拉通""闭环""抓手""赋能"） |
| 句式多样性 | 3 种模板 | 多种职场语气（请示/推锅/拉同盟/拖延/硬刚） |

**实施方式**:
1. 策划逐条重写 ~189 条 scaffold 文本的 `text` 和 `feedback` 字段
2. 不改动 `effects` 数值（保持平衡）
3. 优先重写高频主题（annual_report 39 条, client_call 42 条, roadshow 40 条）

### 2.5 text-pool.json 质量指标

P2 完成后的验收标准：

| 指标 | 当前 | 目标 |
|------|------|------|
| 孤儿文本（eventId 无匹配） | ~45 | **0** |
| 重复文本 | 若干 | **0** |
| 每主题最少文本 | 17 | **17**（保持） |
| 每事件最少可选文本 | 不定 | **≥ 3**（在对应主题中） |
| 模板化文本占比 | ~37% | **≤ 10%** |

---

## 三、P3 — 概率与不确定性机制（2 周）

> **目标**: 打破 100% 确定性——部分选项的结果不完全可预测，增加紧张感和重玩价值

### 3.1 概率效果（Probabilistic Effects）

**核心概念**: 某些选项的 effects 不再是固定值，而是包含一个随机范围或触发概率。

**数据结构**:

```javascript
// 现有格式（确定性）
"effects": { "time": -2, "budget": 0, "satisfaction": 1, "risk": -1 }

// 新格式（概率性 — 向后兼容，确定性选项不受影响）
"effects": { "time": -2, "budget": 0, "satisfaction": 1, "risk": -1 },
"probability": {
  "chance": 0.3,            // 30% 触发概率
  "bonusEffects": { "satisfaction": 1, "risk": -1 },  // 触发时的额外效果
  "penaltyEffects": { "risk": 1 },                     // 未触发时的惩罚（可选）
  "narrativeHint": "有30%的概率客户会额外满意"           // 悬浮提示文本
}
```

**使用场景**:

| 场景 | 概率 | 设计意图 |
|------|------|----------|
| 赌一把型选择 | 40% 成功率 | 高风险高回报——"赌赢了血赚，赌输了血亏" |
| 专业型选择 | 80% 成功率 | 大概率成功但不保证——"以你的经验应该能搞定" |
| 必定型选择 | 100% | 维持现有正规流程选项，给玩家安全的退路 |

**UI 表现**:
- 概率选项的 tooltip 中显示成功率，如 `🎲 成功率: 40%`
- 成功/失败时 feedback 有两套不同文本
- 概率选项按钮有不同的视觉样式（如虚线边框或 🎲 emoji）

### 3.2 隐藏后果（Hidden Consequences）

**核心概念**: 部分选项的 effects 不在 tooltip 中完全展示——玩家需要凭经验或直觉判断。

**设计原则**: 不是"欺骗玩家"，而是"不完全信息"——给线索但不给数字。

**实现方式**:

```javascript
{
  "text": "赌一把，用小许整理的版本直接发送",
  "effects": { "time": 0, "satisfaction": 1 },    // tooltip 显示这些
  "hiddenEffects": { "risk": 2 },                   // tooltip 不显示这些
  "hint": "小许说他已经检查过了……但你注意到他的眼神在躲闪", // 叙事线索
  "hiddenHint": "隐隐觉得哪里不对"                    // 选后才会揭示
}
```

**使用限制**:
- 每局最多 15-20% 的选项有隐藏后果
- 隐藏后果的绝对值 ≤ 2（不会大到让玩家觉得"被坑了"）
- 永远不隐藏正面效果（只隐藏负面效果或连锁标记）

### 3.3 随机事件修饰（Random Modifiers）

**核心概念**: 事件触发时，有小概率附加一个临时修饰，轻微改变该事件的效果。

**实现方式**:

```javascript
// 在 pickEvent() 后、显示前随机判定
function applyRandomModifier(event, state) {
  const roll = Math.random();
  if (roll < 0.10) {
    // 10% 概率: "领导特别关注此事" — 满意度变化翻倍
    event._modifier = { satisfactionMultiplier: 2 };
    event._modifierLabel = '🔍 领导特别关注';
  } else if (roll < 0.20) {
    // 10% 概率: "系统故障" — 所有选项额外 -1 时间
    event._modifier = { timePenalty: -1 };
    event._modifierLabel = '⚠️ 系统突发故障';
  }
  return event;
}
```

**修饰类型**:

| 修饰名 | 概率 | 效果 | 叙事标签 |
|--------|------|------|----------|
| 领导特别关注 | 10% | satisfaction 变化 ×1.5 | 🔍 领导特别关注 |
| 系统故障 | 8% | 所有选项 time -1 | ⚠️ 系统突发故障 |
| 供应商配合 | 8% | budget 惩罚减半 | 🤝 供应商意外配合 |
| 实习生助攻 | 5% | 随机一个正面效果 +1 | 🌟 小许灵光一现 |
| 合规加急 | 5% | risk 降低 ×1.5 | 📋 合规绿色通道 |

### 3.4 P3 验收标准

- [ ] `probability` 字段在 balancer.js 中正确解析和计算
- [ ] 至少 15 个选项配置了概率效果
- [ ] `hiddenEffects` 字段在 balancer.js 中正确合并但不显示在 tooltip
- [ ] 至少 10 个选项配置了隐藏后果
- [ ] 随机事件修饰系统在 `pickEvent()` 后自动触发
- [ ] 5 种随机修饰全部实装
- [ ] 概率选项的 tooltip 正确显示成功率

---

## 四、P4 — Meta 系统与重玩价值（3-4 周）

> **目标**: 驱动玩家"再来一局"，建立长期粘性

### 4.1 成就系统

**数据存储**: `localStorage` 中的 `achievements` 对象

**成就设计** (20 个):

**通关类** (6 个):
| ID | 名称 | 条件 | 隐藏? |
|----|------|------|-------|
| `first_win` | 第一次下班 | 首次通关任意结局 | |
| `all_green_ending` | 全绿交付 | 达成「全绿交付」结局 | |
| `overtime_champion` | 加班冠军 | 达成「加班冠军」结局 | |
| `budget_master` | 铁算盘 | 达成「成本控制大师」结局 | |
| `crisis_survivor` | 危机终结者 | 达成「危机公关新星」结局 | |
| `auto_pilot` | 自动化救场 | 触发「自动化救场」结局 | 🔒 |

**行为类** (8 个):
| ID | 名称 | 条件 | 隐藏? |
|----|------|------|-------|
| `risk_taker` | 刀尖舞者 | 单局累计选择 risk ≥ +2 的选项 5 次 | |
| `safety_first` | 安全第一 | 单局从未选择 risk ≥ +2 的选项 | |
| `people_pleaser` | 甲方读心术 | 单局 satisfaction 从未低于 7 | 🔒 |
| `last_second` | 最后一秒 | 第 10 天 time = 1 时通关 | 🔒 |
| `budget_burner` | 烧钱大户 | 单局累计消耗 budget ≥ 8 | |
| `yes_man` | 好好先生 | 连续 5 次选择 composite ≤ 0 的选项 | 🔒 |
| `cowboy` | 孤胆英雄 | 连续 5 次选择 composite ≥ +1 的选项 | 🔒 |
| `perfect_day` | 完美一天 | 一天内处理的 3 个事件净效果全为正 | |

**收集类** (6 个):
| ID | 名称 | 条件 | 隐藏? |
|----|------|------|-------|
| `collector_3` | 收集新人 | 解锁 3 个不同结局 | |
| `collector_7` | 收集达人 | 解锁 7 个不同结局 | |
| `collector_all` | 全结局制霸 | 解锁全部 11 个结局 | |
| `three_projects` | 三个项目三场戏 | 用 3 个不同项目各通关一次 | |
| `all_characters` | 全员熟面孔 | 见过所有 8 个角色的事件 | |
| `hidden_ending` | 隐藏剧本 | 触发任意隐藏结局 | 🔒 |

**UI 展示**:
- 主界面底部显示 `🏆 成就: 5/20`
- 成就触发时弹出短暂提示（不打断游戏）
- 结局画面后展示本局新解锁的成就

### 4.2 结局图鉴

**数据存储**: `localStorage` 中的 `endingGallery` 对象

**UI**: 主界面新增「结局图鉴」按钮，展示：
- 已解锁结局：彩色卡片，显示结局名 + 标签 + 达成条件
- 未解锁结局：灰色剪影，显示 `???`
- 进度条：`📖 结局图鉴: 5/11`

**结局回顾**: 每个已解锁结局附带：
- 结局标题 + 标签
- 结尾文本
- 达成该结局时的关键统计（day, 剩余 stats, 关键 flag）
- 「这条路线上的关键选择」: 回顾 2-3 个重要选择节点

### 4.3 角色好感度（隐藏数值）

**核心概念**: 不向玩家展示数值，但后台追踪。好感度影响结局叙事和少量事件选项。

**追踪维度**:

| 角色 | 好感度变量 | 正面行为 | 负面行为 |
|------|-----------|----------|----------|
| 技术阿哲 | `affinity_zhe` | 选他的方案、不让他加班 | 总是打补丁、让他背锅 |
| 实习生小许 | `affinity_xu` | 帮他收拾残局、给他机会 | 让他善后、在领导面前推责 |
| 合规陈老师 | `affinity_chen` | 尊重合规流程、主动自查 | 绕过合规、选模糊表述 |
| 财务小周 | `affinity_zhou` | 按流程报销、不找他特批 | 总找林总特批、自掏腰包 |

**数值范围**: -5 ~ +5，初始 0

**触发方式**: 选择特定选项时 ±1。在 events.json 的 choice 上新增可选字段：
```javascript
{
  "text": "找林总特批",
  "affinityEffects": { "caiwu_zhou": -1, "lin_zong": -1 }
}
```

**影响方式**:
- 好感度 ≥ 3：结局文本多一段该角色的正面评价
- 好感度 ≤ -3：结局文本多一段该角色的负面评价
- 好感度极值（±5）：影响特定事件的可用选项（如阿哲主动帮你修bug）

### 4.4 跨局数据

**数据存储**: 所有 meta 数据统一存储在 `localStorage` 的 `meta_progress` key 下：

```javascript
{
  "achievements": { "first_win": true, "risk_taker": true, ... },
  "endingGallery": { "all_green": { "unlocked": true, "count": 2, "bestStats": {...} }, ... },
  "affinity": { "zhe": 2, "xu": -1, "chen": 4, "zhou": 0 },
  "stats": { "totalGames": 12, "totalWins": 8, "totalEvents": 67, "favoriteProject": "esg_report" }
}
```

### 4.5 P4 验收标准

- [ ] 20 个成就全部可触发，触发条件验证正确
- [ ] 成就触发时 UI 提示不打断游戏流程
- [ ] 结局图鉴正确显示已解锁/未解锁结局
- [ ] 4 个角色的好感度正确追踪（-5 ~ +5）
- [ ] 好感度影响至少 3 个结局的叙事文本
- [ ] 跨局数据在 localStorage 中正确持久化
- [ ] 主界面显示成就进度和结局收集进度

---

## 五、P5 — 体验打磨与发布（2 周）

> **目标**: Juice & Polish，移动端适配，最终测试

### 5.1 数值动画

| 动画 | 触发时机 | 表现 |
|------|----------|------|
| 数值跳动 | 选择后 stats 变化 | 对应数值 +1 绿色闪 300ms，-2 红色闪 500ms |
| 进度条过渡 | 选择后 bar-fill 宽度变化 | CSS `transition: width 0.4s ease` |
| 风险脉冲 | risk ≥ 7 | 风险条 `animation: pulse 1s infinite` 红色闪烁 |
| 天数翻页 | advanceDay | 天数数字旋转切换效果 |

### 5.2 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` `2` `3` | 选择对应选项（A/B/C） |
| `Space` | 点击「继续处理」按钮 |
| `N` | 开始新游戏（仅在开始界面和结局界面） |

### 5.3 UI 微优化

| 优化项 | 说明 |
|--------|------|
| 风险预警色 | risk ≥ 7 时顶部栏整体偏红色温 |
| 下班倒计时 | 事件卡片旁显示 `⏰ 距下班还有 [N] 件事`（根据 eventsPerDay - eventsToday） |
| 悬浮 tooltip 延迟 | 从即时显示改为 hover 300ms 后显示（减少误触） |
| 选项按钮悬停效果 | 轻微放大 + 阴影增强 |

### 5.4 移动端适配

**当前问题**: 三栏布局（聊天 + 事件卡片 + 统计）在宽度 < 768px 时可能溢出。

**目标布局（移动端 < 768px）**:
- 统计栏：顶部固定横排，显示 4 个数值条 + 配额
- 事件卡片：占主体区域
- 群聊：折叠为底部抽屉，点击展开

**验收标准**:
- 宽度 375px（iPhone SE）：可正常游玩，无需横向滚动
- 宽度 414px（iPhone 11）：布局舒适，文字清晰
- 触摸目标（选项按钮）≥ 44px 高度

### 5.5 数值平衡测试

**测试方法**: 写一个简单的模拟器，自动跑 N 局，统计：

| 指标 | 目标 |
|------|------|
| 结局触发率 | 每个结局 ≥ 3% |
| 致命结局率（延期/换人/合规拦截） | 15-25% |
| 通关率（到达 Day 10） | 60-70% |
| 平均单局事件数 | 25-30 |
| 时间平均终值 | 3.5-5.5 |
| 预算平均终值 | 4.0-6.5 |
| 满意度平均终值 | 4.0-6.5 |
| 风险平均终值 | 3.5-6.0 |

### 5.6 P5 验收标准

- [ ] 4 种数值动画实装
- [ ] 3 种键盘快捷键实装
- [ ] 移动端三栏→折叠布局实装
- [ ] 375px 宽度可用
- [ ] 自动模拟 100 局通过（结局分布符合目标）
- [ ] 无阻断性 bug

---

## 六、实现路线图总览

```
P2 (Week 1-3):   文本池内容品质     → v0.9  「文本焕新」
  ├─ 修复孤儿文本 eventId
  ├─ 文本去重 + 叙事重写
  ├─ 修复 selectFromPool 缺失
  └─ 验收：0 孤儿 + 0 重复 + 模板化 ≤ 10%

P3 (Week 4-5):   概率与不确定性     → v0.10 「赌徒觉醒」
  ├─ 概率效果系统
  ├─ 隐藏后果系统
  ├─ 随机事件修饰
  └─ 验收：15+ 概率选项 + 10+ 隐藏后果 + 5 种随机修饰

P4 (Week 6-9):   Meta 系统          → v0.11 「再来一局」
  ├─ 成就系统（20 个）
  ├─ 结局图鉴
  ├─ 角色好感度（隐藏）
  ├─ 跨局数据持久化
  └─ 验收：全部 Meta 系统可玩

P5 (Week 10-11): 打磨与发布         → v1.0  「正式发布」
  ├─ 数值动画 + 键盘快捷键
  ├─ 移动端适配
  ├─ 数值平衡测试
  └─ 验收：移动端可用 + 100 局模拟通过
```

---

## 七、P2 优先级详解（即刻可做）

### 7.1 本周可完成（不需要新系统，纯数据修复）

| # | 任务 | 涉及文件 | 工作量 |
|---|------|----------|--------|
| 1 | 修复 B1：将 45 条孤儿文本的 eventId 改为真实事件 | `text-pool.json` | 2h |
| 2 | 修复 B3：在 balancer.js 添加 `selectFromPool()` | `balancer.js` | 0.5h |
| 3 | 修复文案：重写 kickoff 主题的 21 条文本（叙事化） | `text-pool.json` | 3h |
| 4 | 修复文案：重写 monday_morning 的 23 条文本 | `text-pool.json` | 3h |
| 5 | 修复文案：重写 last_workday 的 24 条文本 | `text-pool.json` | 3h |

### 7.2 下周可完成（需要新增数据结构）

| # | 任务 | 涉及文件 | 工作量 |
|---|------|----------|--------|
| 6 | 文本去重脚本 + 补充新文本 | `text-pool.json` | 3h |
| 7 | 重写 remaining scaffold 文本（~120 条） | `text-pool.json` | 8h |
| 8 | 验证每主题核心事件 ≥ 3 条可选文本 | 质量检查 | 2h |

---

## 八、关键算法补充（P3 程序实现参考）

### 8.1 概率效果解析

```javascript
function resolveProbabilityEffects(effects, probability) {
  if (!probability) return effects;  // 确定性选项，直接返回

  const roll = Math.random();
  const resolved = { ...effects };

  if (roll < probability.chance) {
    // 成功：叠加 bonus
    if (probability.bonusEffects) {
      for (const [k, v] of Object.entries(probability.bonusEffects)) {
        resolved[k] = (resolved[k] || 0) + v;
      }
    }
    resolved._probResult = 'success';
  } else {
    // 失败：叠加 penalty（如果有）
    if (probability.penaltyEffects) {
      for (const [k, v] of Object.entries(probability.penaltyEffects)) {
        resolved[k] = (resolved[k] || 0) + v;
      }
    }
    resolved._probResult = 'failure';
  }

  return resolved;
}
```

### 8.2 隐藏效果合并

```javascript
function mergeHiddenEffects(effects, hiddenEffects) {
  const merged = { ...effects };
  if (hiddenEffects) {
    for (const [k, v] of Object.entries(hiddenEffects)) {
      merged[k] = (merged[k] || 0) + v;
    }
  }
  return merged;
}
```

### 8.3 随机修饰触发

```javascript
const RANDOM_MODIFIERS = [
  { chance: 0.10, label: '🔍 领导特别关注', effects: { satisfactionMultiplier: 1.5 } },
  { chance: 0.08, label: '⚠️ 系统突发故障', effects: { timePenalty: -1 } },
  { chance: 0.08, label: '🤝 供应商意外配合', effects: { budgetMultiplier: 0.5 } },
  { chance: 0.05, label: '🌟 小许灵光一现', effects: { randomBonus: 1 } },
  { chance: 0.05, label: '📋 合规绿色通道', effects: { riskMultiplier: 1.5 } },
];

function rollRandomModifier() {
  const roll = Math.random();
  let cumulative = 0;
  for (const mod of RANDOM_MODIFIERS) {
    cumulative += mod.chance;
    if (roll < cumulative) return mod;
  }
  return null;
}
```

---

## 九、数据文件结构更新预览

### 9.1 text-pool.json 条目（P3 增强后）

```javascript
{
  "textId": "T0001",
  "themeId": "annual_report",
  "eventId": "E001",
  "speaker": "zhang_zong",
  "text": "逐条修改，确保合规",
  "feedback": "三处修改虽然耗时，但避免了潜在监管风险。",
  "failureFeedback": "你改了两处但漏了一处——合规陈老师明天还会来找你。",  // 新增：失败反馈
  "effects": { "time": -2, "budget": 0, "satisfaction": -1, "risk": -2 },
  "probability": {                                                   // 新增：概率配置
    "chance": 0.7,
    "bonusEffects": { "satisfaction": 1 },
    "penaltyEffects": { "risk": 1 },
    "narrativeHint": "有70%概率合规陈老师会满意"
  },
  "hiddenEffects": { "risk": 1 },                                   // 新增：隐藏后果
  "affinityEffects": { "hegui_chen": 1 },                           // 新增：好感度影响
  "compositeScore": -5,
  "tags": ["time_heavy", "risk_reducer"],
  "tone": "formal",
  "difficulty": 3
}
```

### 9.2 events.json choice 条目（P3 增强后）

```javascript
{
  "text": "找林总特批",
  "effects": { "time": -1, "budget": 1, "satisfaction": -1, "risk": 0 },
  "feedback": "林总签了字，但记住了你不按流程办事。",
  "affinityEffects": { "caiwu_zhou": -1 },   // 新增
  "probability": {                              // 新增
    "chance": 0.8,
    "bonusEffects": { "time": 1 },
    "narrativeHint": "林总今天心情不错，80%概率秒批"
  },
  "hint": "走后门虽然快，但会欠人情…"
}
```

---

## 十、附录：设计决策备忘录

### 10.1 为什么 compositeScore 不反转 risk？

`compositeScore = time + budget + satisfaction + risk`

不反转 risk（即不用 `-risk`）的核心理由：
- **设计真实**: 保守选项（降 risk）消耗资源（降 time/budget）→ composite 负；冒险选项（升 risk）节省资源 → composite 正
- **玩家直觉**: 正 composite = 整体赚了（但通常伴随风险上升），负 composite = 整体亏了（但通常伴随风险下降）
- **动态难度配合**: selectTexts 中的 `calcFitness` 在计算时对 risk 取反，所以 risk 降（好事）在 fitness 计算中会被正确奖励

### 10.2 为什么每天固定 3 件事？

- **节奏控制**: 避免玩家一天内遇到 5-7 个事件导致数值剧烈波动
- **叙事节奏**: 一天 3 件事 ≈ 早上一件 / 下午一件 / 下班前一件
- **策略空间**: 玩家知道每天只有 3 次选择机会，会更谨慎
- **总事件量**: 10 天 × 3 件 = 最多 30 次选择，与 94 事件池规模匹配

### 10.3 为什么概率机制在 P3 而不是更早？

- P0/P1 建立稳定的事件池和数值基础（✅ 完成）
- P2 确保文本品质达标（进行中）
- 概率机制依赖稳定的数值基础——如果基础都不稳，加概率会让调试变噩梦
- P3 在 P2 品质稳定后引入，此时所有确定性选项都经过了验证

---

> **下一步**: 程序侧请从 P2（第七章）的「本周可完成」任务开始。策划侧继续推进文本叙事重写。
