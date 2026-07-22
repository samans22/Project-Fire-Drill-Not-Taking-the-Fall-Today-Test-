# P2 开发规格书 — 文本池修复与品质提升

> **版本**: 1.0  
> **日期**: 2026-07-22  
> **定位**: 程序员执行文档 — 精确到文件/字段/函数的开发需求  
> **前置**: P0 + P1 已完成（v0.8 基线）  
> **目标版本**: v0.9

---

## 〇、审计结论（2026-07-22 实测数据）

对 `text-pool.json` 和 `themes.json` 做了交叉校验，发现的问题比设计文档估算的严重得多：

| # | 问题 | 严重度 | 实测数据 |
|---|------|--------|----------|
| **B0** | **主题 ID 不匹配** — text-pool.json 与 themes.json 的 theme ID 命名不一致 | 🔴🔴 **致命** | 19 个主题中只有 **5 个匹配**，14 个完全不匹配 |
| B1 | 孤儿 eventId — 文本的 eventId 不匹配任何真实事件 | 🔴 高 | **189 条**（占 37%），不是之前估算的 45 条 |
| B2 | 重复文本 | 🟡 中 | 2 对：T0001↔T0003, T0013↔T0014 |
| B3 | `Balancer.selectFromPool()` 缺失 | 🔴 高 | `ui.js:100` 调用不存在的方法 |
| B4 | pr_crisis 主题有文本无主题 / post_event_turbulence 有主题无文本 | 🟡 中 | 1 个孤儿主题 + 1 个空主题 |

**B0 的具体情况**：

```
text-pool.json 的 key       →  themes.json 的 id         状态
─────────────────────────────────────────────────────────────
monday_morning              →  monday_morning             ✅ 匹配
friday_afternoon            →  friday_afternoon           ✅ 匹配
budget_cut                  →  budget_cut                 ✅ 匹配
pre_holiday                 →  pre_holiday                ✅ 匹配
quarterly_review            →  quarterly_review           ✅ 匹配
annual_report               →  annual_report_deadline     ❌ 不匹配
client_call                 →  client_calls               ❌ 不匹配
event_day                   →  event_checkin_day          ❌ 不匹配
internal_review             →  leadership_review          ❌ 不匹配
kickoff                     →  project_kickoff            ❌ 不匹配
last_minute                 →  last_minute_report         ❌ 不匹配
last_workday                →  last_working_day           ❌ 不匹配
new_boss                    →  new_boss_day               ❌ 不匹配
pr_crisis                   →  （不存在）                  ❌ 无对应主题
regulatory                  →  regulatory_inquiry         ❌ 不匹配
roadshow                    →  roadshow_eve               ❌ 不匹配
scope_creep                 →  client_adds_requirements   ❌ 不匹配
supplier_chain              →  vendor_failure             ❌ 不匹配
system_launch               →  system_launch_day          ❌ 不匹配
（不存在）                    →  post_event_turbulence      ❌ 无文本池
```

**B0 的影响**：`Balancer.setTheme(themeId, textPoolData)` 在 `main.js:164` 被调用时，`textPoolData.byTheme[themeId]` 对 14 个主题返回 `undefined` → `_activePool` 被设为空数组 `[]` → `getTextsForEvent()` 永远返回 `[]` → `_injectTextPoolChoices()` 的 `candidates.length < 3` 分支触发 → **回退到事件的原始 choices，文本池系统对这 14 个主题完全无效**。

文本池系统实际只对 5/19 主题（26%）生效。

---

## 一、P2 任务总览

```
P2 分三个阶段执行，严格按依赖顺序：

Phase 1: 数据修复（必须先做，不依赖策划）
  ├─ P1.1  修复 B0：统一 theme ID（text-pool.json ↔ themes.json）
  ├─ P1.2  修复 B1：孤儿 eventId 重新分配
  ├─ P1.3  修复 B2：文本去重
  ├─ P1.4  修复 B3：添加 selectFromPool()
  └─ P1.5  修复 B4：pr_crisis ↔ post_event_turbulence 对齐

Phase 2: 数据质检（程序校验，不依赖策划）
  ├─ P2.1  编写数据完整性校验脚本
  └─ P2.2  运行校验 → 生成报告 → 修复剩余问题

Phase 3: 兼容性保障（代码加固）
  ├─ P3.1  防御性代码：theme ID 模糊匹配回退
  ├─ P3.2  启动时数据健康检查
  └─ P3.3  开发者调试面板（可选）
```

---

## 二、Phase 1 — 数据修复

### P1.1 修复 B0：统一 theme ID（🔴 最高优先级）

**问题**：text-pool.json 和 themes.json 使用了不同的 theme ID 命名，导致 14/19 主题的文本池查找失败。

**修改文件**：`js/data/text-pool.json`

**修改内容**：将 text-pool.json 中 `byTheme` 的 14 个 key 重命名为 themes.json 中对应的 ID：

| text-pool.json 当前 key | 改为 (对齐 themes.json) |
|--------------------------|------------------------|
| `annual_report` | `annual_report_deadline` |
| `client_call` | `client_calls` |
| `event_day` | `event_checkin_day` |
| `internal_review` | `leadership_review` |
| `kickoff` | `project_kickoff` |
| `last_minute` | `last_minute_report` |
| `last_workday` | `last_working_day` |
| `new_boss` | `new_boss_day` |
| `pr_crisis` | `post_event_turbulence` |
| `regulatory` | `regulatory_inquiry` |
| `roadshow` | `roadshow_eve` |
| `scope_creep` | `client_adds_requirements` |
| `supplier_chain` | `vendor_failure` |
| `system_launch` | `system_launch_day` |

同时，将 `pr_crisis` 主题下的所有文本的 `themeId` 字段也改为 `post_event_turbulence`。

**不改动的 5 个 key**（已匹配）：
`monday_morning`, `friday_afternoon`, `budget_cut`, `pre_holiday`, `quarterly_review`

**同步修改**：
- `text-pool.json` 中每个文本条目的 `themeId` 字段必须与新 key 一致
- `text-pool.json` 的 `byTheme` 对象 key 改名后，内部每个文本对象的 `themeId` 字段同步更新
- `_themeCount` 保持 19 不变

**验收**：运行以下验证脚本，确认 19/19 匹配：

```javascript
const tp = require('./js/data/text-pool.json');
const themes = require('./js/data/themes.json');
const poolIds = Object.keys(tp.byTheme).sort();
const themeIds = themes.map(t => t.id).sort();
const missing = themeIds.filter(id => !poolIds.includes(id));
const extra = poolIds.filter(id => !themeIds.includes(id));
console.assert(missing.length === 0, 'Missing from text-pool: ' + missing);
console.assert(extra.length === 0, 'Extra in text-pool: ' + extra);
console.log('P1.1 PASS: 19/19 theme IDs match');
```

---

### P1.2 修复 B1：孤儿 eventId 重新分配

**问题**：189 条文本的 eventId 使用占位符（如 `N_M01`, `N_L01` 等），不匹配 events.json 中任何真实事件。

**修改文件**：`js/data/text-pool.json`

**影响范围**：9 个主题，每个 21 条（共 189 条）：
- `monday_morning` (23 条中 21 条孤儿)
- `last_minute_report` (24 条中 21 条孤儿)
- `friday_afternoon` (27 条中 21 条孤儿)
- `post_event_turbulence` (24 条中 21 条孤儿) — 注意：原 key 为 `pr_crisis`，已在 P1.1 中改名
- `pre_holiday` (24 条中 21 条孤儿)
- `new_boss_day` (24 条中 21 条孤儿)
- `quarterly_review` (24 条中 21 条孤儿)
- `last_working_day` (24 条中 21 条孤儿)
- `project_kickoff` (21 条中 21 条孤儿)

**孤儿 eventId 前缀 → 新主题 ID 映射**（P1.1 完成后）：

| 孤儿前缀 | 主题 ID | 应分配到的 boosted 事件 |
|----------|---------|------------------------|
| `N_M01~N_M21` | `monday_morning` | E003, E004, E011, E013, E022 |
| `N_L01~N_L21` | `last_minute_report` | E004, E012, E013, E014, E023, E045 |
| `N_F01~N_F21` | `friday_afternoon` | E004, E011, E012, E014, E023, E045 |
| `N_P01~N_P21` | `post_event_turbulence` | E015, E020, E021, E022, E044 |
| `N_H01~N_H21` | `pre_holiday` | E004, E011, E012, E014, E045 |
| `N_B01~N_B21` | `new_boss_day` | E003, E004, E013, E022, E031 |
| `N_Q01~N_Q21` | `quarterly_review` | E009, E012, E015, E021, E028, E044 |
| `N_W01~N_W21` | `last_working_day` | E004, E012, E014, E023, E045 |
| `N_K01~N_K21` | `project_kickoff` | E003, E004, E011, E013 |

**分配规则**：
1. 每个主题有 21 条孤儿文本，分配到 4-6 个 boosted 事件
2. 均匀分配：每个 boosted 事件获得 3-5 条文本（21 ÷ boosted事件数）
3. 保持每个事件的文本覆盖不同 composite 值：正/零/负各至少 1 条
4. 孤儿文本的 `eventId` 字段改为单个真实 eventId（不用逗号分隔的多 ID 格式）

**具体分配方案**（可直接执行）：

| 主题 | 事件 | 分配数量 | 建议分配文本 ID 范围 |
|------|------|---------|---------------------|
| `monday_morning` | E003 | 5 | N_M01-N_M05 |
| | E004 | 4 | N_M06-N_M09 |
| | E011 | 4 | N_M10-N_M13 |
| | E013 | 4 | N_M14-N_M17 |
| | E022 | 4 | N_M18-N_M21 |
| `last_minute_report` | E004 | 4 | N_L01-N_L04 |
| | E012 | 4 | N_L05-N_L08 |
| | E013 | 3 | N_L09-N_L11 |
| | E014 | 4 | N_L12-N_L15 |
| | E023 | 3 | N_L16-N_L18 |
| | E045 | 3 | N_L19-N_L21 |
| `friday_afternoon` | E004 | 4 | N_F01-N_F04 |
| | E011 | 4 | N_F05-N_F08 |
| | E012 | 3 | N_F09-N_F11 |
| | E014 | 4 | N_F12-N_F15 |
| | E023 | 3 | N_F16-N_F18 |
| | E045 | 3 | N_F19-N_F21 |
| `post_event_turbulence` | E015 | 5 | N_P01-N_P05 |
| | E020 | 4 | N_P06-N_P09 |
| | E021 | 4 | N_P10-N_P13 |
| | E022 | 4 | N_P14-N_P17 |
| | E044 | 4 | N_P18-N_P21 |
| `pre_holiday` | E004 | 5 | N_H01-N_H05 |
| | E011 | 4 | N_H06-N_H09 |
| | E012 | 4 | N_H10-N_H13 |
| | E014 | 4 | N_H14-N_H17 |
| | E045 | 4 | N_H18-N_H21 |
| `new_boss_day` | E003 | 5 | N_B01-N_B05 |
| | E004 | 4 | N_B06-N_B09 |
| | E013 | 4 | N_B10-N_B13 |
| | E022 | 4 | N_B14-N_B17 |
| | E031 | 4 | N_B18-N_B21 |
| `quarterly_review` | E009 | 4 | N_Q01-N_Q04 |
| | E012 | 4 | N_Q05-N_Q08 |
| | E015 | 4 | N_Q09-N_Q12 |
| | E021 | 3 | N_Q13-N_Q15 |
| | E028 | 3 | N_Q16-N_Q18 |
| | E044 | 3 | N_Q19-N_Q21 |
| `last_working_day` | E004 | 5 | N_W01-N_W05 |
| | E012 | 4 | N_W06-N_W09 |
| | E014 | 4 | N_W10-N_W13 |
| | E023 | 4 | N_W14-N_W17 |
| | E045 | 4 | N_W18-N_W21 |
| `project_kickoff` | E003 | 5 | N_K01-N_K05 |
| | E004 | 4 | N_K06-N_K09 |
| | E011 | 4 | N_K10-N_K13 |
| | E013 | 4 | N_K14-N_K17 |
| （project_kickoff 只有 4 个 boosted 事件） | — | — | N_K18-N_K21 → 分配给 random 池中 E022 等其他高频事件 |

**修改方式**：用脚本批量替换，不手动编辑 189 条 JSON。

```javascript
// 分配映射表：{ themeId: { orphanPrefix: [targetEventIds...] } }
const ALLOCATION = {
  monday_morning:     { prefix: 'N_M', targets: ['E003','E004','E011','E013','E022'] },
  last_minute_report: { prefix: 'N_L', targets: ['E004','E012','E013','E014','E023','E045'] },
  friday_afternoon:   { prefix: 'N_F', targets: ['E004','E011','E012','E014','E023','E045'] },
  post_event_turbulence: { prefix: 'N_P', targets: ['E015','E020','E021','E022','E044'] },
  pre_holiday:        { prefix: 'N_H', targets: ['E004','E011','E012','E014','E045'] },
  new_boss_day:       { prefix: 'N_B', targets: ['E003','E004','E013','E022','E031'] },
  quarterly_review:   { prefix: 'N_Q', targets: ['E009','E012','E015','E021','E028','E044'] },
  last_working_day:   { prefix: 'N_W', targets: ['E004','E012','E014','E023','E045'] },
  project_kickoff:    { prefix: 'N_K', targets: ['E003','E004','E011','E013'] },
};

// 对每个 text-pool.json byTheme[themeId] 中的文本：
// 1. 如果 eventId 匹配 /^N_[A-Z]\d+$/ → 孤儿文本
// 2. 提取序号：parseInt(eventId.match(/\d+/)[0]) - 1 → 0-based index
// 3. targetIndex = index % targets.length
// 4. 将 eventId 替换为 targets[targetIndex]
// 5. 注意：project_kickoff 只有 4 个 boosted 事件，前 20 条均匀分配（0-4,4-8,8-12,12-16），后 1 条（N_K21）分配到 E022
```

**验收**：

```javascript
// 验证 0 条孤儿
const tp = require('./js/data/text-pool.json');
const events = require('./js/data/events.json');
const realIds = new Set(events.map(e => e.eventId));
let orphans = 0;
for (const [themeId, texts] of Object.entries(tp.byTheme)) {
  for (const t of texts) {
    const ids = (t.eventId || '').split(',').map(s => s.trim());
    if (ids.every(id => !realIds.has(id))) orphans++;
  }
}
console.assert(orphans === 0, 'Remaining orphans: ' + orphans);
console.log('P1.2 PASS: 0 orphan eventIds');
```

---

### P1.3 修复 B2：文本去重

**问题**：2 对完全重复的文本。

**修改文件**：`js/data/text-pool.json`

**已知重复**：
- T0001 ↔ T0003（同属 `annual_report_deadline` 主题，P1.1 后 key 已改名）
- T0013 ↔ T0014

**处理方式**：
1. 对每对重复，保留 textId 较小的那条（T0001, T0013）
2. 删除重复条（T0003, T0014）
3. `_total` 从 515 减为 513

**注意**：如果 T0003 或 T0014 是某个主题唯一覆盖某事件的文本，则改为修改其 `text`/`feedback` 内容而非删除。但根据实测，这两对都在同一个主题内、很可能指向相同 eventId，删除不会造成事件覆盖空缺。

**验收**：

```javascript
const seen = new Map();
let dups = 0;
for (const [themeId, texts] of Object.entries(tp.byTheme)) {
  for (const t of texts) {
    const key = themeId + '|' + t.text + '|' + JSON.stringify(t.effects);
    if (seen.has(key)) { dups++; console.log('DUP:', seen.get(key), t.textId); }
    else seen.set(key, t.textId);
  }
}
console.assert(dups === 0, 'Duplicates remaining: ' + dups);
console.log('P1.3 PASS: 0 duplicates');
```

---

### P1.4 修复 B3：添加 `selectFromPool()`

**问题**：`ui.js:99-106` 调用 `Balancer.selectFromPool()`，但该方法不存在。

**背景**：events.json 中部分 choice 带有 `pool` 数组（legacy 格式，约 75 条 pool 文本分散在多个事件中）。当前 `_injectTextPoolChoices()` 已经替代了大部分文本选择逻辑，但 `ui.js` 仍保留了旧 pool 处理路径作为 fallback。

**修改文件**：`js/balancer.js`

**添加方法**：

```javascript
/**
 * 从旧格式 choice.pool 中动态选择 1 条文本（兼容层）
 * @param {array} pool - choice.pool 数组
 * @param {object} stats - 玩家当前 stats
 * @param {number} day - 当前天数
 * @returns {object|null} 选中的文本对象，或 null
 */
selectFromPool(pool, stats, day) {
  if (!pool || pool.length === 0) return null;
  // 委托给 selectTexts，选 1 条
  const results = this.selectTexts(pool, stats, day, 1);
  return results.length > 0 ? results[0] : pool[0]; // fallback: 返回第一条
},
```

**验收**：启动游戏，确保 `ui.js:100` 不再抛出 `TypeError: Balancer.selectFromPool is not a function`。

---

### P1.5 修复 B4：补齐缺失主题的文本池

**问题**：
- `post_event_turbulence` 主题在 themes.json 中存在，但 text-pool.json 中没有对应的文本池（P1.1 中将 `pr_crisis` 改名为 `post_event_turbulence` 后解决）
- 改名后 `pr_crisis` 不再存在，但需确认 `post_event_turbulence` 的 boosted 事件列表 (E015, E020, E021, E022, E044) 在 P1.2 中是否都被覆盖

**修改文件**：无需额外修改（P1.1 + P1.2 共同解决）

**验收**：

```javascript
const tp = require('./js/data/text-pool.json');
const themes = require('./js/data/themes.json');
for (const theme of themes) {
  const pool = tp.byTheme[theme.id];
  console.assert(pool, 'Missing text pool for theme: ' + theme.id);
  console.assert(pool.length >= 17, 'Theme ' + theme.id + ' has < 17 texts: ' + pool.length);
}
console.log('P1.5 PASS: all 19 themes have text pools');
```

---

## 三、Phase 2 — 数据质检

### P2.1 数据完整性校验脚本

**新建文件**：`tools/validate-data.js`

**功能**：一键运行，检查所有数据文件的完整性和一致性。

**检查项**：

```javascript
// 1. 主题 ID 匹配 — text-pool.json vs themes.json（19/19）
// 2. 孤儿 eventId — 所有 text.eventId 必须匹配 events.json 中的真实 ID（0 条）
// 3. 重复文本 — 按 (themeId, text, effects) 去重（0 对）
// 4. 每主题文本数 ≥ 17
// 5. 每主题的 boosted 事件每个 ≥ 3 条文本覆盖
// 6. 所有文本的 effects 值在合理范围 [-5, +5]
// 7. compositeScore 与 effects 计算一致：compositeScore === time+budget+satisfaction+risk
// 8. 所有文本有必填字段：textId, themeId, eventId, text, feedback, effects, compositeScore
// 9. events.json 中所有 choice.pool 数组内的文本 effects 范围检查
// 10. themes.json 中每个主题的 eventPool.boosted 事件 ID 都存在于 events.json
```

**脚本框架**：

```javascript
// tools/validate-data.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

function validate() {
  const tp = load('text-pool.json');
  const themes = load('themes.json');
  const events = load('events.json');
  const realEventIds = new Set(events.map(e => e.eventId));

  const results = { pass: [], fail: [], warn: [] };

  // Check 1: Theme ID alignment
  const poolIds = new Set(Object.keys(tp.byTheme));
  for (const t of themes) {
    if (!poolIds.has(t.id)) results.fail.push('MISSING_POOL: ' + t.id);
  }
  for (const id of poolIds) {
    if (!themes.find(t => t.id === id)) results.fail.push('ORPHAN_POOL: ' + id);
  }

  // Check 2: Orphan eventIds
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      const ids = (t.eventId || '').split(',').map(s => s.trim());
      if (ids.every(id => !realEventIds.has(id))) {
        results.fail.push('ORPHAN_EVENT: ' + t.textId + ' eventId=' + t.eventId);
      }
    }
  }

  // Check 3: Duplicates
  const seen = new Map();
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      const key = themeId + '|' + t.text + '|' + JSON.stringify(t.effects);
      if (seen.has(key)) {
        results.fail.push('DUPLICATE: ' + seen.get(key) + ' <-> ' + t.textId);
      } else {
        seen.set(key, t.textId);
      }
    }
  }

  // Check 4: Min texts per theme
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    if (texts.length < 17) results.fail.push('THIN_THEME: ' + themeId + ' has ' + texts.length + ' texts');
  }

  // Check 5: Coverage per boosted event
  for (const theme of themes) {
    const pool = tp.byTheme[theme.id];
    if (!pool) continue;
    const boosted = theme.eventPool?.boosted || [];
    for (const evId of boosted) {
      const count = pool.filter(t => {
        const ids = (t.eventId || '').split(',').map(s => s.trim());
        return ids.includes(evId);
      }).length;
      if (count < 3) results.warn.push('LOW_COVERAGE: ' + theme.id + ' event ' + evId + ' has ' + count + ' texts');
    }
  }

  // Check 6: Effect value range
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      for (const [stat, val] of Object.entries(t.effects)) {
        if (val < -5 || val > 5) {
          results.fail.push('EFFECT_RANGE: ' + t.textId + ' ' + stat + '=' + val);
        }
      }
    }
  }

  // Check 7: Composite consistency
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      const e = t.effects;
      const calc = (e.time||0) + (e.budget||0) + (e.satisfaction||0) + (e.risk||0);
      if (calc !== t.compositeScore) {
        results.fail.push('COMPOSITE_MISMATCH: ' + t.textId + ' stored=' + t.compositeScore + ' calc=' + calc);
      }
    }
  }

  // Check 8: Required fields
  const REQUIRED = ['textId', 'themeId', 'eventId', 'text', 'feedback', 'effects', 'compositeScore'];
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      for (const field of REQUIRED) {
        if (t[field] === undefined || t[field] === null) {
          results.fail.push('MISSING_FIELD: ' + t.textId + ' missing ' + field);
        }
      }
    }
  }

  // Check 9: themes.json boosted events exist
  for (const theme of themes) {
    const boosted = theme.eventPool?.boosted || [];
    for (const evId of boosted) {
      if (!realEventIds.has(evId)) {
        results.fail.push('BAD_BOOSTED: ' + theme.id + ' boosted ' + evId + ' not in events.json');
      }
    }
  }

  // Report
  console.log('=== Data Validation Report ===');
  console.log('PASS: ' + results.pass.length);
  console.log('FAIL: ' + results.fail.length);
  console.log('WARN: ' + results.warn.length);
  if (results.fail.length > 0) {
    console.log('\n--- FAILURES ---');
    results.fail.forEach(f => console.log('  ❌ ' + f));
  }
  if (results.warn.length > 0) {
    console.log('\n--- WARNINGS ---');
    results.warn.forEach(w => console.log('  ⚠️ ' + w));
  }

  const exitCode = results.fail.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

validate();
```

**验收**：`node tools/validate-data.js` 输出 `PASS: N, FAIL: 0, WARN: 0`。

---

### P2.2 运行校验 → 修复 → 再校验

**流程**：
1. 执行 P1.1-P1.5 的数据修改
2. 运行 `node tools/validate-data.js`
3. 根据 FAIL 和 WARN 结果逐一修复
4. 重复步骤 2-3 直到 FAIL = 0
5. WARN 项评估后决定是否修复或记录为已知限制

**验收标准**：FAIL = 0, WARN ≤ 5（仅允许不影响功能的警告）

---

## 四、Phase 3 — 兼容性保障

### P3.1 防御性回退：theme ID 模糊匹配

**问题**：如果未来再次出现 theme ID 不匹配（如新增主题时命名不一致），系统应能自动回退而非静默失败。

**修改文件**：`js/balancer.js` 的 `setTheme()` 方法

**修改内容**：在 `setTheme()` 中添加模糊匹配回退逻辑：

```javascript
setTheme(themeId, textPoolData) {
  this._themeId = themeId;
  if (textPoolData && textPoolData.byTheme) {
    // 精确匹配
    if (textPoolData.byTheme[themeId]) {
      this._activePool = textPoolData.byTheme[themeId];
    } else {
      // 模糊匹配回退：尝试找包含相同关键词的 theme key
      const candidates = Object.keys(textPoolData.byTheme).filter(key => {
        // 单向包含：themeId 包含 key 或 key 包含 themeId 的片段
        const short = key.replace(/_/g, '');
        const target = themeId.replace(/_/g, '');
        return short.includes(target) || target.includes(short);
      });
      if (candidates.length === 1) {
        this._activePool = textPoolData.byTheme[candidates[0]];
        console.warn('Balancer: fuzzy-matched theme "' + themeId + '" → "' + candidates[0] + '" (' + this._activePool.length + ' texts)');
      } else if (candidates.length > 1) {
        // 多个候选 → 取最短编辑距离
        console.warn('Balancer: multiple fuzzy matches for "' + themeId + '": ' + candidates.join(', '));
        this._activePool = textPoolData.byTheme[candidates[0]] || [];
      } else {
        console.error('Balancer: no text pool found for theme "' + themeId + '" — text pool system disabled for this session');
        this._activePool = [];
      }
    }
  } else {
    this._activePool = [];
  }
  console.log('Balancer: theme=' + themeId + ', pool=' + this._activePool.length + ' texts');
},
```

**注意**：这是防御性措施，不应替代 P1.1 的正确修复。即使实现了模糊匹配，ID 统一仍然是必须的。

---

### P3.2 启动时数据健康检查

**修改文件**：`js/main.js` 的 `init()` 函数

**修改内容**：在 `loadAllData()` 之后添加运行时健康检查：

```javascript
async function init() {
  UI.init();
  await loadAllData();

  // P2: 运行时数据健康检查
  _runHealthCheck();

  // ... 其余代码不变
}

function _runHealthCheck() {
  const tp = Events.getTextPoolData();
  if (!tp || !tp.byTheme) {
    console.warn('⚠️ text-pool.json 未加载或格式异常');
    return;
  }

  const themeId = gameData.themes?.[0]?.id; // 仅用于测试
  let matchCount = 0;
  let totalTexts = 0;

  for (const theme of gameData.themes) {
    if (tp.byTheme[theme.id]) {
      matchCount++;
      totalTexts += tp.byTheme[theme.id].length;
    }
  }

  const totalThemes = gameData.themes.length;
  if (matchCount < totalThemes) {
    console.error('❌ 文本池主题匹配: ' + matchCount + '/' + totalThemes + ' — ' + (totalThemes - matchCount) + ' 个主题无文本池');
  } else {
    console.log('✅ 文本池健康检查通过: ' + matchCount + ' 主题, ' + totalTexts + ' 条文本');
  }
}
```

**验收**：浏览器 console 中看到 `✅ 文本池健康检查通过: 19 主题, 513 条文本`。

---

### P3.3 开发者调试面板（可选）

**新建文件**：不需要新建文件，在 `js/balancer.js` 上添加调试方法

**功能**：在浏览器 console 中可手动检查文本池状态

```javascript
// 挂载到 window 便于 console 调用
window.__debugBalancer = {
  status() {
    console.log('Theme:', Balancer._themeId);
    console.log('Active pool size:', Balancer._activePool.length);
    console.log('Recent composites:', Balancer.getRecentHistory());
    console.log('Streak high/low:', Balancer._streakHigh, Balancer._streakLow);
  },
  eventCoverage(eventId) {
    const texts = Balancer.getTextsForEvent(eventId);
    console.log('Event ' + eventId + ': ' + texts.length + ' texts');
    texts.forEach(t => {
      const c = t.compositeScore;
      const sign = c > 0 ? '+' : '';
      console.log('  [' + sign + c + '] ' + t.textId + ': ' + t.text.substring(0, 40) + '...');
    });
  },
  listOrphans() {
    const events = Events._pool;
    const realIds = new Set(events.map(e => e.eventId));
    let count = 0;
    for (const t of Balancer._activePool) {
      const ids = (t.eventId || '').split(',').map(s => s.trim());
      if (ids.every(id => !realIds.has(id))) {
        console.log('ORPHAN: ' + t.textId + ' → ' + t.eventId);
        count++;
      }
    }
    console.log('Total orphans in active pool: ' + count);
  },
};
```

挂载代码加在 `balancer.js` 末尾（或 `main.js` 的 `init()` 中）。

---

## 五、不需要修改的文件

以下文件**不需要任何修改**（P2 任务不涉及）：

| 文件 | 原因 |
|------|------|
| `js/game.js` | 无需修改，核心逻辑正确 |
| `js/events.js` | 无需修改，事件加载和主题加权抽取逻辑正确 |
| `js/main.js` | P3.2 仅添加健康检查，核心流程不变 |
| `js/ui.js` | B3 通过 balancer.js 修复，ui.js 代码不变 |
| `js/chat.js` | 无需修改 |
| `js/storage.js` | 无需修改 |
| `js/data/events.json` | 无需修改 |
| `js/data/themes.json` | 无需修改（text-pool.json 向它看齐） |
| `js/data/characters.json` | 无需修改 |
| `js/data/projects.json` | 无需修改 |
| `js/data/endings.json` | 无需修改 |

---

## 六、执行顺序与依赖

```
Phase 1 (数据修复)
├─ P1.1  统一 theme ID          ← 必须先做，后续任务依赖它
├─ P1.2  孤儿 eventId 分配       ← 依赖 P1.1（主题 ID 已改名）
├─ P1.3  文本去重               ← 可与 P1.2 并行
├─ P1.4  添加 selectFromPool()   ← 独立，可随时做
└─ P1.5  验证主题覆盖           ← 依赖 P1.1

Phase 2 (数据质检)
├─ P2.1  编写校验脚本           ← 独立，可在 Phase 1 之前写
└─ P2.2  运行校验 → 修复        ← 依赖 P1.1-P1.5 全部完成

Phase 3 (兼容性保障)
├─ P3.1  模糊匹配回退           ← 独立，可在 P1.1 之后做
├─ P3.2  启动健康检查           ← 独立，可在 P1.1 之后做
└─ P3.3  调试面板               ← 独立，可随时做
```

**推荐执行顺序**：
```
Day 1: P1.1 → P1.4 → P2.1
Day 2: P1.2 → P1.3 → P1.5 → P2.2
Day 3: P3.1 → P3.2 → (P3.3 可选) → 完整回归测试
```

---

## 七、验收检查清单

Phase 1 完成后逐项确认：

- [ ] 运行 `node tools/validate-data.js` → FAIL = 0
- [ ] 启动游戏，console 无报错
- [ ] 随机选择 5 个不同主题开始新游戏，每个主题的事件选项来自文本池（不是事件原始选项）
- [ ] console 中 `Balancer: theme=xxx, pool=NN texts` 的 NN ≥ 17
- [ ] `window.__debugBalancer.status()` 显示正确的活跃池大小
- [ ] 旧 pool 格式的事件（如 E001 的 choice[0].pool）不报错
- [ ] `_total` 字段更新为实际文本总数（513）
- [ ] 所有 189 条原孤儿文本的 eventId 已更新为真实事件 ID

---

## 八、P2 完成后的数据画像（预期）

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 主题 ID 匹配率 | 5/19 (26%) | **19/19 (100%)** |
| 孤儿 eventId | 189 条 (37%) | **0 条** |
| 重复文本 | 2 对 | **0 对** |
| 文本总数 | 515 | **513** |
| 实际可用文本 | ~160（估算，仅 5 个匹配主题的文本） | **513** |
| 每主题最低文本数 | 0（部分主题空池） | **17** |
| 每 boosted 事件最低覆盖 | 不定 | **≥ 3** |
| 文本池系统实际生效范围 | 26% 的主题 | **100% 的主题** |
