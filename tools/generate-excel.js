/**
 * generate-excel.js - 生成游戏策划数据 Excel 文档
 * 输出: GAME-DESIGN-TABLES.xlsx (多 Sheet)
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const BASE = path.join(__dirname, '..');

// 读取 JSON 数据
const events = JSON.parse(fs.readFileSync(path.join(BASE, 'js', 'data', 'events.json'), 'utf-8'));
const projects = JSON.parse(fs.readFileSync(path.join(BASE, 'js', 'data', 'projects.json'), 'utf-8'));
const characters = JSON.parse(fs.readFileSync(path.join(BASE, 'js', 'data', 'characters.json'), 'utf-8'));
const themes = JSON.parse(fs.readFileSync(path.join(BASE, 'js', 'data', 'themes.json'), 'utf-8'));
const endings = JSON.parse(fs.readFileSync(path.join(BASE, 'js', 'data', 'endings.json'), 'utf-8'));

const wb = XLSX.utils.book_new();

// ---- 辅助函数 ----
function effectStr(e) {
  const parts = [];
  if (e.time && e.time !== 0) parts.push(`时间 ${e.time > 0 ? '+' : ''}${e.time}`);
  if (e.budget && e.budget !== 0) parts.push(`预算 ${e.budget > 0 ? '+' : ''}${e.budget}`);
  if (e.satisfaction && e.satisfaction !== 0) parts.push(`满意度 ${e.satisfaction > 0 ? '+' : ''}${e.satisfaction}`);
  if (e.risk && e.risk !== 0) parts.push(`风险 ${e.risk > 0 ? '+' : ''}${e.risk}`);
  return parts.join(' | ') || '无变化';
}

function flagStr(flags) {
  if (!flags || flags.length === 0) return '—';
  return flags.join(', ');
}

// ============================================================
// Sheet 1: 核心系统概览
// ============================================================
const s1 = XLSX.utils.aoa_to_sheet([
  ['项目救火办：今日不背锅 — 游戏策划数据全表'],
  [],
  ['一、核心数值系统'],
  ['数值', '初始值', '上限', '方向', '归零/爆表后果'],
  ['⏱️ 时间 (time)', 10, 10, '减少=不利', '归零 → 结局「项目延期」'],
  ['💰 预算 (budget)', 10, 10, '减少=不利', '—（不直接触发结局）'],
  ['😊 满意度 (satisfaction)', 10, 10, '减少=不利', '归零 → 结局「客户换团队」'],
  ['⚠️ 风险 (risk)', 0, 10, '增加=不利', '满值(10) → 结局「合规拦截」'],
  [],
  ['健康度颜色', '比例', '含义'],
  ['🟢 绿色', '≥ 70%', '健康'],
  ['🟡 黄色', '40%–69%', '警告'],
  ['🔴 红色', '< 40%', '危险（风险条反转）'],
  [],
  ['游戏进程参数', '值'],
  ['最大天数', 10],
  ['初始回合事件', '不限（直到无可用事件则推进天数）'],
  ['存档方式', 'localStorage 自动存档'],
  ['每局时长', '约 3–5 分钟'],
]);
s1['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 45 }];
XLSX.utils.book_append_sheet(wb, s1, '01-核心系统');

// ============================================================
// Sheet 2: 项目 & 角色 & 主题
// ============================================================
const s2_proj = [['项目ID', '名称', '副标题', '标签', '专属事件']];
projects.forEach(p => s2_proj.push([p.id, p.name, p.subtitle, p.tags.join(', '), p.keyEvents.join(', ')]));

const s2_char = [['角色ID', '名称', '头衔', '口头禅', '角色定位']];
characters.forEach(c => s2_char.push([c.id, c.name, c.title, c.tagline, c.role]));

const s2_theme = [['序号', '每日主题', '开局修正']];
themes.forEach((t, i) => {
  const text = typeof t === 'string' ? t : t.text;
  const mod = (typeof t === 'object' && t.modifier) ? effectStr(t.modifier) : '无';
  s2_theme.push([i + 1, text, mod]);
});

const s2 = XLSX.utils.aoa_to_sheet([
  ['二-A、项目包'],
  ...s2_proj,
  [],
  ['二-B、角色列表'],
  ...s2_char,
  [],
  ['二-C、每日主题（每局随机选1个，带开局数值修正）'],
  ...s2_theme,
]);
s2['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 30 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wb, s2, '02-项目角色主题');

// ============================================================
// Sheet 3: 全部事件 × 选项（核心大表）
// ============================================================
const s3 = [['事件ID', '标题', '分类', '触发条件', '选项', '时间', '预算', '满意度', '风险', '设置Flag', '悬浮提示', '反馈文本']];

events.forEach(ev => {
  const reqStr = ev.requires ? ev.requires.join(', ') : '无（独立事件）';
  ev.choices.forEach((ch, i) => {
    const label = `${String.fromCharCode(65 + i)}. ${ch.text}`;
    s3.push([
      ev.eventId,
      ev.title,
      ev.category || '(缺失)',
      reqStr,
      label,
      ch.effects.time || 0,
      ch.effects.budget || 0,
      ch.effects.satisfaction || 0,
      ch.effects.risk || 0,
      flagStr(ch.setsFlags),
      ch.hint || '',
      ch.feedback,
    ]);
  });
  // 空行分隔事件
  s3.push(['', '', '', '', '', '', '', '', '', '', '', '']);
});

s3['!cols'] = [
  { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 34 },
  { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 6 },
  { wch: 16 }, { wch: 32 }, { wch: 40 },
];
XLSX.utils.book_append_sheet(wb, s3, '03-全部事件选项');

// ============================================================
// Sheet 4: 效果排行榜
// ============================================================
const s4_time_top = [['排名', '事件', '选项', '时间变化', '其他效果']];
const allChoices = [];
events.forEach(ev => {
  ev.choices.forEach((ch, i) => {
    allChoices.push({
      eventId: ev.eventId,
      title: ev.title,
      label: `${String.fromCharCode(65 + i)}. ${ch.text}`,
      time: ch.effects.time || 0,
      budget: ch.effects.budget || 0,
      satisfaction: ch.effects.satisfaction || 0,
      risk: ch.effects.risk || 0,
      other: Object.entries(ch.effects).filter(([k, v]) => k !== 'time' && v !== 0).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '无',
    });
  });
});

// 时间消耗 Top 10
const timeWorst = allChoices.filter(c => c.time < 0).sort((a, b) => a.time - b.time).slice(0, 10);
s4_time_top.push(['', '', '', '', '']);
s4_time_top.push(['⏱️ 最耗时选项 Top 10', '', '', '', '']);
timeWorst.forEach((c, i) => s4_time_top.push([i + 1, `${c.eventId} ${c.title}`, c.label, c.time, c.other]));

// 时间正向（唯一）
s4_time_top.push(['', '', '', '', '']);
s4_time_top.push(['⏱️ 时间正向选项（极其罕见）', '', '', '', '']);
const timePos = allChoices.filter(c => c.time > 0).sort((a, b) => b.time - a.time);
timePos.forEach(c => s4_time_top.push(['—', `${c.eventId} ${c.title}`, c.label, `+${c.time}`, c.other]));

// 预算消耗 Top 5
s4_time_top.push(['', '', '', '', '']);
s4_time_top.push(['💰 最烧钱选项 Top 5', '', '', '', '']);
const budgetWorst = allChoices.filter(c => c.budget < 0).sort((a, b) => a.budget - b.budget).slice(0, 5);
budgetWorst.forEach((c, i) => s4_time_top.push([i + 1, `${c.eventId} ${c.title}`, c.label, '', `预算 ${c.budget}`]));

// 满意度极值
s4_time_top.push(['', '', '', '', '']);
s4_time_top.push(['😊 满意度变化极值', '', '', '', '']);
const satExtremes = allChoices.filter(c => Math.abs(c.satisfaction) >= 2).sort((a, b) => b.satisfaction - a.satisfaction);
satExtremes.forEach(c => s4_time_top.push(['—', `${c.eventId} ${c.title}`, c.label, '', `满意度 ${c.satisfaction > 0 ? '+' : ''}${c.satisfaction}`]));

// 风险降幅 Top 5
s4_time_top.push(['', '', '', '', '']);
s4_time_top.push(['⚠️ 风险降幅 Top 5', '', '', '', '']);
const riskBest = allChoices.filter(c => c.risk < 0).sort((a, b) => a.risk - b.risk).slice(0, 5);
riskBest.forEach((c, i) => s4_time_top.push([i + 1, `${c.eventId} ${c.title}`, c.label, '', `风险 ${c.risk}`]));

s4_time_top['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 34 }, { wch: 10 }, { wch: 36 }];
XLSX.utils.book_append_sheet(wb, s4_time_top, '04-效果排行榜');

// ============================================================
// Sheet 5: 连锁事件路径
// ============================================================
const s5 = [['连锁类型', '起始事件', '起始选项', '设置Flag', '触发事件', '连锁事件标题', '延迟惩罚/奖励']];

const chainDefs = [
  ['🔴 负面连锁', 'E001-B', '用定性表述先顶上', 'data_missing', 'E016', '合规追问数据来源', '需花 3 时间补救数据，或 1 时间争取延期'],
  ['🔴 负面连锁', 'E002-C', '先直接进场，稍后补登', 'qr_unverified', 'E017', '会后名单对不上', '需花 2 时间核对监控，或快速更新留坏印象'],
  ['🟢 正面连锁', 'E002-B', '重新生成专属二维码', 'qr_verified', 'E019', '自动化流程解锁', '时间+1 风险-2，还可触发特殊结局'],
  ['🔴 负面连锁', 'E008-B', '要求阿哲打补丁先撑过去', 'tech_debt', 'E018', '技术债爆发', '全游戏最重惩罚(-3/-2/-1)，或继续打补丁'],
  ['🔴 负面连锁', 'E009-B', '改两处，保留一处模糊表述', 'compliance_gap', 'E020', '合规隐患发酵', '风险-3 但代价高，或私下沟通欠人情'],
  ['🔴 负面连锁', 'E006-C', '先用去年数据估算', 'estimated_data', 'E021', '审计抽查数据溯源', '需花 3 时间补数据，或坦白承认降低满意度'],
];

chainDefs.forEach(d => s5.push(d));

s5['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, s5, '05-连锁事件路径');

// ============================================================
// Sheet 6: 结局系统
// ============================================================
const s6_header = ['结局ID', '结局名', '标签', '类型', '触发条件', '条件详情', '结局文本'];
const s6 = [s6_header];

endings.forEach(e => {
  const cond = e.condition || {};
  let type, condDesc, condDetail;

  if (cond.default) {
    type = '默认 fallback';
    condDesc = '任何其他结局都不匹配时';
    condDetail = 'default: true';
  } else if (e.id === 'project_delayed') {
    type = '致命条件';
    condDesc = '时间归零';
    condDetail = 'time ≤ 0';
  } else if (e.id === 'client_lost') {
    type = '致命条件';
    condDesc = '满意度归零';
    condDetail = 'satisfaction ≤ 0';
  } else if (e.id === 'compliance_blocked') {
    type = '致命条件';
    condDesc = '风险爆表';
    condDetail = 'risk ≥ 10';
  } else {
    type = '通关条件';
    const parts = [];
    if (cond.time_min !== undefined) parts.push(`时间 ≥ ${cond.time_min}`);
    if (cond.time_max !== undefined) parts.push(`时间 ≤ ${cond.time_max}`);
    if (cond.budget_min !== undefined) parts.push(`预算 ≥ ${cond.budget_min}`);
    if (cond.budget_max !== undefined) parts.push(`预算 ≤ ${cond.budget_max}`);
    if (cond.satisfaction_min !== undefined) parts.push(`满意度 ≥ ${cond.satisfaction_min}`);
    if (cond.satisfaction_max !== undefined) parts.push(`满意度 ≤ ${cond.satisfaction_max}`);
    if (cond.risk_min !== undefined) parts.push(`风险 ≥ ${cond.risk_min}`);
    if (cond.risk_max !== undefined) parts.push(`风险 ≤ ${cond.risk_max}`);
    if (cond.flags_include) parts.push(`标记: [${cond.flags_include.join(', ')}]`);
    condDesc = parts.join(' + ');
    condDetail = JSON.stringify(cond);
  }

  s6.push([e.id, e.title, e.tag || '', type, condDesc, condDetail, e.text]);
});

s6['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 36 }, { wch: 40 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, s6, '06-结局系统');

// ============================================================
// Sheet 7: 事件抽取机制
// ============================================================
const s7 = XLSX.utils.aoa_to_sheet([
  ['事件抽取算法 (pickEvent)'],
  [],
  ['步骤', '说明'],
  ['1. 优先检查连锁事件', '遍历 state.flags，查找 chainMap 中是否有对应的事件'],
  ['2. 有连锁事件', '在可用连锁事件中随机抽取 1 个（最高优先级）'],
  ['3. 无连锁事件 → 过滤', '条件: 未用过 + 项目标签匹配(*通配或tag交集) + requires条件满足'],
  ['4. 加权随机', '按 followUpWeight 加权抽取（当前所有事件权重默认=1）'],
  ['5. 无可用事件', '推进天数 day++，重新抽取；仍无 → 强制结局'],
  [],
  ['事件分类统计', '数量'],
  ['risk_compliance (风险合规)', 10],
  ['time_pressure (时间压力)', 8],
  ['budget_conflict (预算冲突)', 3],
  ['satisfaction_mgmt (满意度管理)', 2],
  ['总计', 24],
  [],
  ['选项统计', '数量'],
  ['总选项数', 68],
  ['2 选项事件', '4 (E004, E016, E017, E019)'],
  ['3 选项事件', '20'],
  ['平均选项数/事件', '2.8'],
  [],
  ['设计统计', '数量'],
  ['全局标记总数', 7],
  ['连锁路径', '6 (4负面 + 1正面 + 1数据)'],
  ['结局总数', 12],
  ['致命结局', 3],
  ['条件结局', 8],
  ['默认结局', 1],
]);
s7['!cols'] = [{ wch: 36 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, s7, '07-系统机制');

// ============================================================
// Sheet 8: 已知问题 & 改进规划
// ============================================================
const s8 = XLSX.utils.aoa_to_sheet([
  ['已知问题 & 下一步规划参考'],
  [],
  ['#', '问题', '位置', '优先级', '建议方案'],
  [1, 'E004 缺少 category 字段', 'events.json E004', '🟡 低', '添加 "category": "time_pressure"'],
  [2, 'estimated_data flag 无连锁事件', 'E006-C', '🟡 中', '添加类似 E016 的监管追问事件，惩罚"估算数据"行为'],
  [3, '所有事件 followUpWeight 未使用', 'events.json', '🟢 低', '为高频/低频事件设置权重，调节出现概率'],
  [4, '项目专属事件偏少', '整个事件池', '🔴 高', 'ESG 仅 2 个、IPO 仅 1 个、峰会 2 个专属事件，大部分事件通用——各项目重玩体验相似'],
  [5, '正面连锁仅 1 条', 'E002→E019', '🟡 中', '增加更多正面连锁路径（如 estimated_data → 被发现后反而获得更准确数据源）'],
  [6, '缺少中立项/隐藏结局', 'endings.json', '🟡 中', '可增加需要特定 flag 组合的隐藏结局'],
  [7, 'E004 仅 2 个选项', 'events.json', '🟢 低', '可增加第 3 个选项保持一致性'],
  [8, '所有项目共用大部分事件', '事件池', '🔴 高', '建议每种项目类型至少 5-6 个专属事件，增强差异化'],
  [9, '56 个选项中 12 个选项 effects 全为 0', 'events.json', '🟡 中', '全 0 选项缺少游戏性后果（如 E002-C, E003-B 等），可考虑增加微小变化'],
  [10, '缺少中期BOSS事件', '事件池', '🟡 中', '可在第 5-6 天固定触发一个高难度事件'],
  [11, '无音效/动画反馈', '全项目', '🟢 低', '关键数值变化时可增加简单的 CSS 动画或音效'],
]);

s8['!cols'] = [{ wch: 4 }, { wch: 36 }, { wch: 20 }, { wch: 8 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, s8, '08-已知问题');

// ============================================================
// 写入文件
// ============================================================
const outPath = path.join(BASE, 'GAME-DESIGN-TABLES.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`✅ Excel 已生成: ${path.basename(outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
