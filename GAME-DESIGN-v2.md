# 🏢 项目救火办 v2.0 — 策划重构文档（程序实现指南）

> **配套数据文件**: `text-pool-balanced.csv`  
> **更新日期**: 2026-07-22

---

## 一、当前问题

### 1.1 数值失衡
- **时间**: 73%的选项消耗时间(负值)，玩家只能"保时间"
- **预算**: 48%选项不涉及预算变动，沦为摆设
- **满意度**: 变化幅度集中在 ±1，缺乏张力
- **风险**: 频繁变动但方向单一

### 1.2 主题与文本池脱节
19个主题仅在开局做 modifier，从未影响事件池内容。

### 1.3 pool 机制未完成
已有15个选项带了 pool（75条备用文本），但没有按主题组织，也没有动态选择逻辑。

---

## 二、新系统架构

```
开局 → 随机主题 → 激活该主题的文本池

nextTurn():
  1. 抽取事件(eventId) — 保持现有逻辑
  2. 从该主题的文本池中，筛选该 eventId 对应的文本
  3. 调用 selectTexts(state, candidates, count=3) 选择最优文本
  4. 渲染选项 → 玩家选择 → applyEffects
```

**核心变化**: 事件(event)只提供场景框架(标题/描述/发言人)，选项文本从主题文本池中动态选取。

---

## 三、文本条目数据结构

每条文本是一个独立游戏资源：

```javascript
{
  "textId": "T0001",
  "themeId": "regulatory",           // 所属主题(19选1, 必填)
  "eventId": "E009",                  // 关联事件(可逗号分隔多个)
  "speaker": "hegui_chen",
  "text": "逐条修改，确保合规",        // 选项按钮文本
  "feedback": "三处修改虽然耗时...",   // 选择后反馈

  // ★★★ 核心: 四维权重 ★★★
  "effects": {
    "time": -2,        // 范围 [-3, +2]
    "budget": 0,       // 范围 [-3, +2]
    "satisfaction": 0, // 范围 [-3, +3]
    "risk": -3         // 范围 [-3, +3], 正值=风险升, 负值=风险降
  },

  // ★★★ 综合收益评分 = time + budget + satisfaction + risk ★★★
  "compositeScore": -5,

  // 分类标签(程序自动推导)
  "tags": ["time_heavy", "risk_safe", "formal"],

  // 出现条件(可选)
  "minDay": 1,          // 最早出现天数
  "maxDay": 10,         // 最晚出现天数
  "difficulty": 3,      // 1=低风险 2=正常 3=高风险 4=极端
  "setsFlags": [],      // 触发连锁标记
  "requiresFlags": []   // 需要已有点标记
}
```

### 文本总量

| 维度 | 数值 |
|------|------|
| 总主题 | 19 |
| 每主题文本 | 15~18条 |
| **文本总量** | **~320条** |
| 每主题场景 | 5~6个场景 × 3文本 |

---

## 四、综合收益评分与平衡规则

### 4.1 公式

```
compositeScore = effects.time + effects.budget + effects.satisfaction + effects.risk
```

不反转 risk。risk 降(负值)自然拉低 compositeScore，risk 升(正值)自然拉高。这反映了一个设计真实：**保守选项消耗资源(composite负)，冒险选项节省资源(composite正)**。

### 4.2 平衡目标分布

| compositeScore | 占比 | 设计含义 |
|----------------|------|----------|
| **+2** | 15% | 冒险有利 — 以 risk 增加换取资源节省 |
| **+1** | 25% | 略微有利 — 有小幅净收益 |
| **0** | 30% | 完全均衡 — 得失对等 |
| **-1** | 15% | 略微不利 — 为安全付出小代价 |
| **-2** | 10% | 明显不利 — 大幅降低风险，或极端偏向某一参数 |
| **≤ -3** | 5% | 极端代价 — 某一参数达到极值(+2或+3) |

### 4.3 三原则

**原则一: 无废选项**  
同一场景的3个文本，不允许存在"A完全优于B"(A的所有 effects ≥ B的对应值)。

**原则二: 参数参与度均衡**  
- time: 80%文本有非零值 (当前73% → 提升到80%)
- budget: 65%文本有非零值 (当前52% → 大幅提升)
- satisfaction: 75%文本有非零值 (当前66% → 提升)
- risk: 80%文本有非零值 (当前78% → 持平)

**原则三: 极端选项有回报**  
compositeScore ≤ -3 的文本，必须有至少一个 effect 达到参数极值(|值| ≥ 2)，让玩家在特定困境下有选择的动机。

### 4.4 典型文本模式

```
【冒险省时】  composite=+2
  effects: {time:+1, budget:0, satisfaction:0, risk:+1}
  场景: "先推进再说" / "赌一把"

【正规流程】  composite=-1  
  effects: {time:-2, budget:0, satisfaction:0, risk:-1}
  场景: "邮件确认" / "逐条修改"

【花钱买时间】 composite=0
  effects: {time:+1, budget:-2, satisfaction:0, risk:+1}
  场景: "请外部团队加急"

【保风险耗一切】 composite=-5
  effects: {time:-2, budget:-1, satisfaction:-1, risk:-3}
  场景: "立即停机修复" (同时改善多个参数但极度耗时)
```

---

## 五、19主题 × 文本池映射

| # | themeId | 主题名 | 核心矛盾 | 文本数 | 关键事件 |
|---|---------|--------|----------|--------|----------|
| 1 | `kickoff` | 项目启动会当天 | 万事开头难 | 16 | E025, 启动类 |
| 2 | `scope_creep` | 客户突然加需求 | 需求膨胀 | 18 | E013,E023,E027,E032 |
| 3 | `internal_review` | 领导查看中期版本 | 内部审查 | 16 | E004,E022,E031 |
| 4 | `supplier_chain` | 供应商集体掉链子 | 外部依赖断裂 | 18 | E002,E006,E017,E024,E029 |
| 5 | `last_minute` | 下班前突击汇报 | 时间极限压缩 | 16 | E011,E014,E035 |
| 6 | `roadshow` | 路演前24小时 | 公开亮相 | 16 | E010,E031,E033 |
| 7 | `annual_report` | 年报披露倒计时 | 合规披露 | 18 | E001,E015,E025,E026,E028,E030 |
| 8 | `event_day` | 活动签到当天 | 现场执行 | 16 | E002,E017,E040 |
| 9 | `regulatory` | 监管问询来函 | 合规危机 | 20 | E009,E016,E020,E021,E028,E029 |
| 10 | `pr_crisis` | 会后舆情发酵 | 公关危机 | 16 | E015,E020,E037 |
| 11 | `budget_cut` | 项目预算被砍30% | 资源紧缩 | 18 | E005,E010,E024,E030,E034 |
| 12 | `system_launch` | 系统上线第一天 | 技术风险集中 | 18 | E008,E014,E018,E033,E036 |
| 13 | `last_workday` | 最后一个工作日 | 收尾压力 | 16 | E014,E039 |
| 14 | `monday_morning` | 周一早会刚结束 | 一周规划 | 16 | E004,E022,周一事件 |
| 15 | `friday_afternoon` | 周五下午四点整 | 周末前冲刺 | 16 | E011,E014,E035 |
| 16 | `pre_holiday` | 节前最后半天 | 节前收尾 | 16 | E041,节前事件 |
| 17 | `new_boss` | 新老板到岗第一天 | 印象管理 | 16 | E004,E013,新老板事件 |
| 18 | `quarterly_review` | 季度考核截止日 | 绩效压力 | 18 | E009,E015,E021,E038 |
| 19 | `client_call` | 甲方突然来电话 | 客户突袭 | 18 | E011,E012,E023,E027 |

**关键规则**:
- 每条文本有且仅有一个 themeId
- 文本不跨主题重复
- 同一 eventId 可出现在多个主题(事件框架复用，文本内容不同)

---

## 六、动态难度机制 (selectTexts 算法)

### 6.1 算法目标

让玩家体验曲线呈 **"震荡上升"** — 有起伏但整体向好，避免一直受压或一直轻松。

### 6.2 状态压力计算

每回合开始，根据玩家当前四维参数计算"压力向量"：

```javascript
function calcPressure(state) {
  return {
    timePressure:        1 - (state.stats.time / state.statsMax.time),          // [0,1], 1=极度缺时间
    budgetPressure:      1 - (state.stats.budget / state.statsMax.budget),      // [0,1]
    satisfactionPressure: 1 - (state.stats.satisfaction / state.statsMax.satisfaction), // [0,1]
    riskPressure:        state.stats.risk / state.statsMax.risk                 // [0,1], 1=风险极高
  };
}
```

### 6.3 文本适配度计算

对候选文本池中的每条文本，计算对当前状态的"适配度"：

```javascript
function calcFitness(text, pressure) {
  // 玩家缺什么，文本提供什么 → 高适配度
  // 注意: risk 取反，因为 risk 负值(降风险)是好事
  return pressure.timePressure         * text.effects.time
       + pressure.budgetPressure       * text.effects.budget
       + pressure.satisfactionPressure * text.effects.satisfaction
       + pressure.riskPressure         * (-text.effects.risk);  // risk降=好事
}
```

**直觉解释**:
- 时间紧迫(pressure=0.8)时，time:+1 的文本 fitness 贡献 +0.8
- 预算充裕(pressure=0.1)时，budget:+1 的文本 fitness 贡献 +0.1 (几乎不影响)
- 风险高(pressure=0.9)时，risk:-2 的文本 fitness 贡献 +1.8 (非常适配！)

### 6.4 文本选择流程

```javascript
function selectTexts(state, candidates, count = 3) {
  const pressure = calcPressure(state);

  // Step 1: 按 compositeScore 分层
  // 根据玩家整体健康度，决定选入多少"有利"和"不利"文本
  const health = avgStatRatio(state);  // [0,1], 0=濒死, 1=全满
  const compositeTarget = mapHealthToTarget(health);
  // health < 0.3  → 选更多 composite≥0 的文本 (救急)
  // health 0.3-0.7 → 均衡选取
  // health > 0.7  → 选更多 composite≤0 的文本 (制造挑战)

  // Step 2: 过滤
  let pool = candidates.filter(t => {
    if (t.requiresFlags && !t.requiresFlags.every(f => state.flags.includes(f))) return false;
    if (t.minDay && state.day < t.minDay) return false;
    if (t.maxDay && state.day > t.maxDay) return false;
    return true;
  });

  // Step 3: 计算每条文本的适配度
  pool.forEach(t => { t._fitness = calcFitness(t, pressure); });

  // Step 4: 按 compositeTarget 过滤 + 按 fitness 排序
  pool = pool.filter(t => Math.abs(t.compositeScore - compositeTarget) <= 1);
  pool.sort((a, b) => b._fitness - a._fitness);

  // Step 5: 从前 2×count 条中随机选 count 条 (引入变化)
  const topN = pool.slice(0, count * 2);
  shuffle(topN);
  return topN.slice(0, count);
}

function mapHealthToTarget(health) {
  if (health < 0.25) return 2;   // 濒死 → 给有利选项
  if (health < 0.4)  return 1;
  if (health < 0.6)  return 0;   // 健康 → 给均衡选项
  if (health < 0.8)  return -1;
  return -2;                       // 太好 → 给挑战选项
}
```

### 6.5 震荡上升曲线

```
玩家健康度期望曲线:
  Day 1-3:  ████████░░  70-80% (开局良好)
  Day 4-5:  ██████░░░░  50-65% (压力开始)
  Day 6-7:  ████░░░░░░  30-45% (危机爆发)
  Day 8-9:  ██████░░░░  50-65% (奋力回升)
  Day 10:   ████████░░  60-75% (最终向好)

实现方式: 通过控制各阶段可选文本的 compositeScore 范围
  Day 1-3:  选 compositeScore [+1, +2] 的文本为主 (轻松开局)
  Day 4-7:  选 compositeScore [-1, +1] 的文本为主 (压力与挑战)
  Day 8-10: 监测玩家状态，动态调整 (智能救援或加大难度)
```

---

## 七、tag 标签体系

每条文本自动携带两类标签：

### 7.1 效果倾向标签 (从 effects 自动生成)

| 标签 | 触发条件 |
|------|----------|
| `time_save` | time ≥ +1 |
| `time_heavy` | time ≤ -2 |
| `budget_gain` | budget ≥ +1 |
| `budget_drain` | budget ≤ -2 |
| `satisfaction_boost` | satisfaction ≥ +2 |
| `satisfaction_hit` | satisfaction ≤ -2 |
| `risk_reducer` | risk ≤ -2 |
| `risk_taker` | risk ≥ +2 |

### 7.2 策略风格标签 (策划标注)

| 标签 | 含义 |
|------|------|
| `formal` | 正规流程—费时但合规 |
| `risky` | 冒险—省资源升风险 |
| `safe` | 保守—稳妥低效 |
| `clever` | 取巧—折中方案 |
| `diplomatic` | 甩锅—转移问题 |
| `humor` | 幽默向—调节节奏 |

### 7.3 特殊标签

| 标签 | 含义 |
|------|------|
| `chain_starter` | 设置flag触发连锁 |
| `chain_responder` | 需要特定flag |
| `rare` | 稀有(≤5%出现率) |
| `positive` | 纯正面(无负面效果) |

---

## 八、实现路线图

### Phase 1: 数据层 (1-2天)

1. 将 `text-pool-balanced.csv` 导入为 `js/data/text-pool.json`
2. 文本池加载器：按 themeId 建立索引 `{themeId: [texts]}`
3. 修改 `startNewGame()`: 主题确定后激活对应文本池

### Phase 2: 选择算法 (2-3天)

4. 实现 `calcPressure(state)` — 计算四维压力
5. 实现 `calcFitness(text, pressure)` — 计算文本适配度
6. 实现 `selectTexts(state, candidates, count)` — 动态文本选择
7. 修改 `pickEvent()` / `nextTurn()` 集成新的文本选择流程

### Phase 3: 数值调优 (1-2天)

8. 试玩收集数据：记录每局各参数变化曲线
9. 根据数据微调 `mapHealthToTarget()` 的阈值
10. 调整各主题文本池的 compositeScore 分布

### Phase 4: UI增强 (1天)

11. Tooltip 显示效果数值预览（悬浮时明确展示 ±数字）
12. 选项按钮旁显示效果倾向图标（如 ⏱️-2 ⚠️+1）

---

## 九、Tooltip 增强方案

当前 tooltip 仅显示 hint 文本。需要增强为：

```
┌─────────────────────────────┐
│ ⏱️ -2  💰 0  😊 +1  ⚠️ -1  │  ← 效果数值条
│                             │
│ 花时间逐条修改虽然耗时，     │  ← hint文本(现有)
│ 但合规陈老师会满意…         │
└─────────────────────────────┘
```

实现方式：在每个 `.choice-btn` 的 `data-hint` 基础上增加 `data-effects` 属性：
```html
<button class="choice-btn"
  data-effects="⏱️-2 | 💰0 | 😊+1 | ⚠️-1"
  data-hint="花时间逐条修改虽然耗时，但合规陈老师会满意…">
  A. 逐条修改，确保合规
</button>
```

CSS 的 `::after` 伪元素同时展示 effects 和 hint。

---

## 十、附录: compositeScore 速查表

| 模式 | 典型effects | composite | 适用场景 |
|------|------------|-----------|----------|
| 冒险省时 | t:+1,b:0,s:0,r:+1 | +2 | 时间紧但风险可控 |
| 取巧折中 | t:-1,b:0,s:+1,r:0 | 0 | 各方面都不极端的正常选择 |
| 正规流程 | t:-2,b:0,s:0,r:-1 | -3 | 风险高时最安全的路 |
| 花钱消灾 | t:0,b:-2,s:0,r:-2 | -4 | 预算充裕时的高效方案 |
| 拼命加班 | t:-3,b:0,s:+2,r:-1 | -2 | 满意度极低时的救命稻草 |
| 冒险赌博 | t:+1,b:0,s:0,r:+2 | +3 | 绝望时的最后手段 |
| 完美方案 | t:-1,b:-1,s:+1,r:-2 | -3 | 预算时间都有一点时的最优解 |

---

## 十一、文本池平衡报告 (text-pool-balanced.csv)

### 11.1 总体指标

| 指标 | 调整前 | 调整后 | 目标 | 状态 |
|------|--------|--------|------|------|
| 文本总量 | 326 | **515** | ≥300 | ✅ |
| 主题覆盖 | 10个充足/9个不足 | **19个全覆盖** | 19/19 | ✅ |
| 每主题最少文本 | 0 | **17** | ≥15 | ✅ |
| 预算参与度(非零%) | 23% | **63%** | 65% | ✅ |
| 满意度参与度(非零%) | 45% | **83%** | 75% | ✅ |
| 风险参与度(非零%) | 53% | **89%** | 80% | ✅ |
| 时间参与度(非零%) | 73% | **74%** | 80% | ⚠️ |
| 全零效果文本 | 0 | **0** | 0 | ✅ |

### 11.2 复合得分分布

| composite范围 | 数量 | 占比 | 设计含义 |
|---------------|------|------|----------|
| ≥ +3 | 23 | 4% | 高风险高回报 |
| +1 ~ +2 | 104 | 20% | 略微有利 |
| 0 | 74 | 14% | 均衡 |
| -1 ~ -2 | 172 | 33% | 正规流程(有代价) |
| -3 ~ -4 | 118 | 23% | 安全方案(大代价) |
| ≤ -5 | 24 | 5% | 极端保守 |

### 11.3 数值调整策略说明

对现有326条文本应用的确定性平衡规则：

1. **预算参与**: 所有 budget=0 的文本，根据 time/risk 模式自动赋值 (-1 或 +1)
2. **满意度参与**: 所有 satisfaction=0 的文本，根据 risk 方向自动赋值
3. **时间惩罚缓和**: time ≤ -3 的文本统一调整为 -2
4. **风险参与**: 所有 risk=0 的文本，根据 time 方向自动赋值
5. **全零兜底**: 新增150条文本的最终验证和修复

### 11.4 文本类型分布

| 类型 | 文本模式 | composite典型值 | 占比 |
|------|---------|-----------------|------|
| 正规处理 | t:-2,b:-1,s:+1,r:-1 | -3 | ~33% |
| 取巧解决 | t:-1,b:0,s:+1,r:0 | 0 | ~33% |
| 冒险尝试 | t:0,b:+1,s:-1,r:+1 | +1 | ~33% |

### 11.5 给程序的注意事项

1. CSV 文件使用 UTF-8 BOM 编码，Excel 可直接打开
2. `compositeScore` 列是自动计算的，公式为 `time + budget + satisfaction + risk`
3. `tags` 列从 effects 自动推导，不需要手动维护
4. `tone` 列用于 selectTexts 算法中的文本多样性保证
5. 部分文本的 `eventId` 为空（新增文本），程序需兼容此情况
6. `setsFlags` 和 `requiresFlags` 用分号 `;` 分隔多个值
7. `isPool` 列标记了该文本原本来自旧格式的 pool 数组（可忽略）
