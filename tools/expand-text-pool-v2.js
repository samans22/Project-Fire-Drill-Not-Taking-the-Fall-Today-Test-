/**
 * expand-text-pool-v2.js — 文本池扩充 v2
 *
 * 原则:
 *   1. 每个主题 ≥12 个独有事件（不跨主题共享）
 *   2. 只生成策划文件 (CSV)，不修改任何 .js 代码
 *   3. 新事件使用 X 前缀 ID，需配合 events.json 条目使用
 *   4. 每个事件 2-3 条文本，覆盖正/零/负 composite
 */

const fs = require('fs');
const path = require('path');

// ========== CONFIG ==========
const CSV_INPUT = path.join(__dirname, '..', 'text-pool-balanced-ORIGINAL.csv');
const CSV_OUTPUT = path.join(__dirname, '..', 'text-pool-balanced-EXPANDED-v2.csv');
const TARGET_EVENTS = 12;

// ========== LOAD DATA ==========
const themesData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'js', 'data', 'themes.json'), 'utf-8'));
const eventsData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'js', 'data', 'events.json'), 'utf-8'));

const realEventIds = new Set(eventsData.map(e => e.eventId));

// CSV old → themes.json id
const CSV_TO_JSON = {
  'annual_report':    'annual_report_deadline',
  'client_call':      'client_calls',
  'event_day':        'event_checkin_day',
  'internal_review':  'leadership_review',
  'kickoff':          'project_kickoff',
  'last_minute':      'last_minute_report',
  'last_workday':     'last_working_day',
  'new_boss':         'new_boss_day',
  'pr_crisis':        'post_event_turbulence',
  'regulatory':       'regulatory_inquiry',
  'roadshow':         'roadshow_eve',
  'scope_creep':      'client_adds_requirements',
  'supplier_chain':   'vendor_failure',
  'system_launch':    'system_launch_day',
  'monday_morning':   'monday_morning',
  'budget_cut':       'budget_cut',
  'friday_afternoon': 'friday_afternoon',
  'pre_holiday':      'pre_holiday',
  'quarterly_review': 'quarterly_review',
};
const JSON_TO_CSV = {};
for (const [csv, json] of Object.entries(CSV_TO_JSON)) JSON_TO_CSV[json] = csv;

const themeNameMap = {};
themesData.forEach(t => { themeNameMap[t.id] = t.text; });

// ========== CSV PARSER ==========
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].replace(/^﻿/, '');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 16) continue;
    const textId = cols[0];
    if (textId === 'T0003' || textId === 'T0014') continue; // skip dups
    rows.push(cols);
  }
  return { header, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

function escapeCSV(val) {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSVLine(cols) { return cols.map(escapeCSV).join(','); }

// ========== LOAD ORIGINAL CSV ==========
const csvText = fs.readFileSync(CSV_INPUT, 'utf-8');
const { header, rows: originalRows } = parseCSV(csvText);

// Build current event ownership per csvThemeId
const currentEvents = {};
originalRows.forEach(cols => {
  const csvThemeId = cols[1];
  const eventId = cols[3];
  if (!eventId || eventId.startsWith('N_')) return;
  if (!currentEvents[csvThemeId]) currentEvents[csvThemeId] = new Set();
  currentEvents[csvThemeId].add(eventId);
});

console.log('Original CSV: ' + originalRows.length + ' valid rows');

// ========== PLAN NEW EVENTS ==========
const newEventsByTheme = {}; // csvThemeId → [{ eventId, title, category, speaker }]
let eventCounter = 1;

// Category affinity per theme (json theme id)
const THEME_CATEGORY = {
  'project_kickoff':       ['time_pressure', 'satisfaction_mgmt'],
  'client_adds_requirements': ['satisfaction_mgmt', 'time_pressure'],
  'leadership_review':     ['risk_compliance', 'satisfaction_mgmt'],
  'vendor_failure':        ['budget_conflict', 'time_pressure'],
  'last_minute_report':    ['time_pressure', 'satisfaction_mgmt'],
  'roadshow_eve':          ['time_pressure', 'satisfaction_mgmt'],
  'annual_report_deadline': ['risk_compliance', 'time_pressure'],
  'event_checkin_day':     ['time_pressure', 'satisfaction_mgmt'],
  'regulatory_inquiry':    ['risk_compliance', 'time_pressure'],
  'post_event_turbulence': ['risk_compliance', 'satisfaction_mgmt'],
  'budget_cut':            ['budget_conflict', 'time_pressure'],
  'system_launch_day':     ['time_pressure', 'risk_compliance'],
  'last_working_day':      ['time_pressure', 'satisfaction_mgmt'],
  'monday_morning':        ['time_pressure', 'satisfaction_mgmt'],
  'friday_afternoon':      ['time_pressure', 'satisfaction_mgmt'],
  'pre_holiday':           ['time_pressure', 'satisfaction_mgmt'],
  'new_boss_day':          ['satisfaction_mgmt', 'risk_compliance'],
  'quarterly_review':      ['risk_compliance', 'time_pressure'],
  'client_calls':          ['satisfaction_mgmt', 'time_pressure'],
};

const SPEAKER_BY_CATEGORY = {
  'risk_compliance': 'hegui_chen',
  'time_pressure': 'zhang_zong',
  'budget_conflict': 'caiwu_zhou',
  'satisfaction_mgmt': 'zhang_zong',
};

// ========== NEW EVENT TITLES PER THEME ==========
// Each theme gets themed event titles that fit its specific scenario
const THEME_EVENT_TITLES = {
  'project_kickoff': [
    { title: '项目范围界定不清', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '全员kickoff时间难统一', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '客户对项目目标有不同理解', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '技术评估还没完成就要排期', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '启动会的关键人员临时缺席', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '项目章程被质疑流程不合规', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '资源分配方案遭到部门反对', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '客户要求启动会前看到详细计划', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '项目代号引发跨部门误会', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '启动会上CEO突然提了新方向', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '项目预算在启动前被冻结审查', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '启动会材料被合规要求大改', cat: 'risk_compliance', speaker: 'hegui_chen' },
  ],
  'client_adds_requirements': [
    { title: '新需求涉及未评估的技术栈', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '客户追加需求后的合同修订', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '新增需求导致的预算重算', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
  ],
  'leadership_review': [
    { title: '领导对方案结构提出根本性质疑', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '中期汇报中的数据不一致问题', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '领导要求加入新部门的工作成果', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '审查会上暴露的团队沟通断层', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '领导要求压缩交付周期', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '审查发现关键假设未经验证', cat: 'risk_compliance', speaker: 'hegui_chen' },
  ],
  'vendor_failure': [], // already 12 events
  'last_minute_report': [
    { title: '下班前的数据更新请求', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '汇报PPT的格式突然要大改', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '关键数据源在下班后关闭', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '汇报对象临时增加了大领导', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '打印店已经关门但需要纸质版', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '下班前收到的竞品动态需要纳入汇报', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '汇报前的预演暴露了逻辑漏洞', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '领导要求在汇报中加入敏感数据', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '汇报用的系统在下班时维护', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '协作部门下班前才给反馈意见', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '汇报结束后需要立即提供补充材料', cat: 'time_pressure', speaker: 'zhang_zong' },
  ],
  'roadshow_eve': [
    { title: '路演场地的网络带宽不达标', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '演示设备的备用方案未测试', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '路演前的媒体预览出现误读', cat: 'risk_compliance', speaker: 'zhang_zong' },
  ],
  'annual_report_deadline': [
    { title: '年报中的管理层讨论部分被退回重写', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '审计师要求补充关联交易细节', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '年报设计排版在截止日前出错', cat: 'time_pressure', speaker: 'zhang_zong' },
  ],
  'event_checkin_day': [
    { title: '临时增加的VIP需要特殊接待', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '活动流程中的茶歇供应商迟到', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '会场消防检查突然加严', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '签到处的人流引导方案失效', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '媒体采访区的背景板印错', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '参会嘉宾的接送车辆安排冲突', cat: 'time_pressure', speaker: 'zhang_zong' },
  ],
  'regulatory_inquiry': [], // already 14 events
  'post_event_turbulence': [
    { title: '舆情监测系统报警后的应对', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '媒体要求对活动中的争议做出回应', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '内部员工在社交媒体上的不当发言', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '活动后有匿名信举报流程违规', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '合作方对活动效果表示不满', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '活动现场照片被恶意解读传播', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '活动数据被质疑造假', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '领导要求对舆情进行书面回应', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '活动后的复盘会议暴露组织问题', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '活动赞助商因舆情要求退款', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '行业协会发函询问活动合规性', cat: 'risk_compliance', speaker: 'hegui_chen' },
  ],
  'budget_cut': [
    { title: '被砍预算后的团队士气危机', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '预算削减导致的关键岗位离职风险', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '被迫使用低成本方案的质量风险', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '预算砍了但交付标准没降', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '砍预算后供应商拒绝继续合作', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '预算缩减下的加班费争议', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
  ],
  'system_launch_day': [
    { title: '上线后的数据库连接池耗尽', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '运营团队对新系统操作不熟练', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
  ],
  'last_working_day': [
    { title: '最后一个工作日的紧急客户投诉', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '年底关账前的最后一笔报销被卡', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '未回复的邮件超过了三位数', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '年度总结报告还差三页没写', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '领导要求年前完成所有绩效考核面谈', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '最后一个工作日OA系统计划维护', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '供应商要求在年前结清所有款项', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '年终奖的分配方案引发不满', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '明年的预算模板今天下班前要提交', cat: 'time_pressure', speaker: 'caiwu_zhou' },
    { title: '最后一天还有新人入职需要安排', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '年终礼品清单还没确认', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
  ],
  'monday_morning': [
    { title: '周末堆积的邮件超过五十封', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '周一早会发现周末出了线上事故', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '本周五的截止日期在早会上被提前', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '周报系统在周一早上崩溃', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '周一早上的全员大会临时改议程', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '周末客户发的需求变更没人看到', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '上周五的会议纪要被质疑不准确', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '周一早上发现办公区空调坏了', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '早会上被分配到不属于自己的任务', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '本周的排期在周一就被塞满了', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '周一早上的合规培训不能请假', cat: 'risk_compliance', speaker: 'hegui_chen' },
  ],
  'friday_afternoon': [
    { title: '周五下午的代码部署禁令被无视', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '客户约了周五下班前电话沟通', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '周五团建活动与项目截止日撞车', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '周五下午收到周一的汇报通知', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '周五下班前供应商发来涨价通知', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '周五的审批流卡在最后一个节点', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '同事请假把未完成的工作甩给了你', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '周五下午系统突然变慢影响效率', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '周五例会上被点名下周汇报进度', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '周五下班前财务要求补签所有单据', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
  ],
  'pre_holiday': [
    { title: '节前最后一天收到加急需求', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '放假前必须完成的系统安全检查', cat: 'risk_compliance', speaker: 'jishu_azhe' },
    { title: '假期值班表还没排好', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '节前客户要求确认假期联系人', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '放假前领导要求完成下季度规划', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '节前最后半天的全员大扫除通知', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '假期期间的应急预案还没写', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '节前聚餐的预算被财务驳回', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '放假前供应商发来的合同需要节前签', cat: 'time_pressure', speaker: 'caiwu_zhou' },
    { title: '客户想在假期期间安排项目讨论', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '节前最后几个小时的全员邮件', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
  ],
  'new_boss_day': [
    { title: '新老板要求重新审查所有在途项目', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '新老板的汇报风格完全不同', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '新老板带了旧部下来接管关键岗位', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '新老板要求每天站会汇报进度', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '新老板对供应商名单提出质疑', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '新老板要重新评估团队人员配置', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '新老板推翻了之前领导批准的方案', cat: 'satisfaction_mgmt', speaker: 'lin_zong' },
    { title: '新老板要求所有流程重新走审批', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '新老板第一天就遇到了系统故障', cat: 'time_pressure', speaker: 'jishu_azhe' },
    { title: '新老板要见所有合作方负责人', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '新老板要求用新的项目管理工具', cat: 'time_pressure', speaker: 'jishu_azhe' },
  ],
  'quarterly_review': [
    { title: '季度KPI数据被人质疑统计口径', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '季度考核中的360评估出现恶意差评', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '季度报告中的项目成果被其他部门认领', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '季度末的预算执行率不达标', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '季度考核面谈时间与项目截止日冲突', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '季度考核结果被用来决定裁员名单', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '季度指标的统计口径突然被更改', cat: 'risk_compliance', speaker: 'hegui_chen' },
    { title: '季度末发现全年目标还差一大截', cat: 'time_pressure', speaker: 'lin_zong' },
    { title: '季度考核中发现跨部门协作数据缺失', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '季度末的财务数据与实际有偏差', cat: 'risk_compliance', speaker: 'caiwu_zhou' },
    { title: '季度考核后被要求制定改进计划', cat: 'time_pressure', speaker: 'lin_zong' },
  ],
  'client_calls': [
    { title: '甲方电话中说"有个小调整"', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '客户打电话投诉项目进度太慢', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '甲方换了一个新的对接人', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '客户在电话里暗示要换供应商', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '甲方打电话要求解释费用明细', cat: 'budget_conflict', speaker: 'caiwu_zhou' },
    { title: '客户电话中说CEO对项目不满意', cat: 'satisfaction_mgmt', speaker: 'zhang_zong' },
    { title: '甲方来电要求派人驻场办公', cat: 'time_pressure', speaker: 'zhang_zong' },
    { title: '电话中客户提出了合同外的要求', cat: 'risk_compliance', speaker: 'hegui_chen' },
  ],
};

// ========== TEXT TEMPLATES BY CATEGORY AND POSTURE ==========
function getTemplates(cat) {
  return CAT_TEMPLATES[cat] || CAT_TEMPLATES['default'];
}

const CAT_TEMPLATES = {
  risk_compliance: {
    standard: [
      { text: '逐项核查合规要求，确保每一步都经得起审计', feedback: '虽然耗时，但合规陈老师点了点头——这已经是她最高级别的认可。', t:-2, b:-1, s:-1, r:-2 },
      { text: '按监管标准完整走一遍正式审查流程', feedback: '审查通过，代价是加班到深夜。但至少你能安心睡觉。', t:-3, b:0, s:-1, r:-2 },
      { text: '主动联系合规部门进行前置审查', feedback: '前置审查发现了两个潜在风险点，提前堵住了——省了后面十倍的时间。', t:-1, b:-1, s:0, r:-3 },
    ],
    flexible: [
      { text: '重点修改高风险条款，低风险部分做技术性表述', feedback: '合规陈老师看了说"这次聪明"——她夸人的方式总是这么含蓄。', t:-1, b:0, s:1, r:-1 },
      { text: '跟合规陈老师提前沟通，确认她最在意的点', feedback: '一个提前的微信省了三小时无效修改。陈老师难得发了一个👍。', t:0, b:0, s:1, r:0 },
      { text: '用行业惯例包装模糊地带，既不违规也不过度保守', feedback: '方案在合规边界上精准地踩住了——像在高速公路上刚好不超速。', t:0, b:-1, s:1, r:1 },
    ],
    risky: [
      { text: '赌一把，用现有的数据口径先提交', feedback: '暂时通过了。但你心里清楚——如果被抽查到，得有人背锅。', t:1, b:1, s:0, r:2 },
      { text: '快速签字放行，有问题后面再补', feedback: '签了。你的签名落在了文件上——希望这份文件永远不会被翻出来。', t:2, b:0, s:-1, r:3 },
      { text: '口头跟领导确认风险，不留书面记录', feedback: '领导点了头。但没有邮件、没有记录——万一出事，全靠记忆。', t:1, b:1, s:-1, r:2 },
    ],
  },
  time_pressure: {
    standard: [
      { text: '列出优先级清单，按紧急程度逐个处理', feedback: '清单上的事项逐一勾掉。全部搞定的时候，窗外已经全黑了。', t:-2, b:0, s:1, r:-1 },
      { text: '协调各部门按流程推进，每个环节都确认', feedback: '流程走完已经是晚上十点——但每一步都扎实，没有返工。', t:-3, b:-1, s:0, r:-2 },
      { text: '加班加点逐项完成，不跳过任何步骤', feedback: '以一人之力扛下了所有。代价是今晚的睡眠压缩到了四小时。', t:-3, b:0, s:-1, r:-1 },
    ],
    flexible: [
      { text: '先搞定最紧急的三件事，其余的见缝插针', feedback: '三件急事勉强收尾。"明天继续"的群消息暂时稳住了局面。', t:-1, b:0, s:1, r:0 },
      { text: '找技术阿哲帮忙写个脚本自动化处理', feedback: '阿哲的脚本帮你省了两小时。他说"不保证稳定"——但至少今天够了。', t:0, b:-1, s:1, r:1 },
      { text: '并行处理：边打电话边回邮件边改文档', feedback: '三线操作——电话那头说"好"，邮件显示"已发送"，文档……勉强能看。', t:0, b:0, s:0, r:1 },
    ],
    risky: [
      { text: '先交一版上去，有问题甲方会说的', feedback: '甲方暂时没动静。可能是满意，也可能在酝酿一场暴风雨。', t:2, b:0, s:-1, r:2 },
      { text: '跳过测试环节，直接上线', feedback: '上线了。暂时没问题。但你的后脊梁一直在发凉。', t:2, b:1, s:-1, r:3 },
      { text: '用"正在推进中"先稳住所有人', feedback: '"推进中"帮你争取了半天——但同样的借口只能用一次。', t:1, b:0, s:0, r:1 },
    ],
  },
  budget_conflict: {
    standard: [
      { text: '严格按预算执行，逐项审核支出合理性', feedback: '财务小周对你的严谨表示赞赏。项目进度因此慢了半拍——但钱省下了。', t:-1, b:-1, s:1, r:-2 },
      { text: '重新做详细的预算分析报告给林总', feedback: '林总看了报告后批了追加。数据充分的时候，特批也不是完全不可能。', t:-2, b:1, s:0, r:-1 },
      { text: '找三家供应商比价，确保最优性价比', feedback: '比价多花了半天，但省了15%。林总在邮件里回了"做得好"。', t:-1, b:1, s:1, r:-1 },
    ],
    flexible: [
      { text: '找林总谈特批，用项目重要性争取预算', feedback: '林总批了，但那句"下次注意"说得意味深长。', t:0, b:1, s:-1, r:0 },
      { text: '压缩非核心开支，腾出预算给关键项', feedback: '从茶歇费里抠出了设计费。同事们明天的咖啡没了——但项目保住了。', t:0, b:0, s:-1, r:0 },
      { text: '跟供应商谈分期付款或延期结算', feedback: '供应商勉强同意了分期。但你欠了一份人情——下次报价可能包含"风险溢价"。', t:1, b:0, s:0, r:1 },
    ],
    risky: [
      { text: '先斩后奏，花完了再找林总补批', feedback: '林总看到报销单时眉头皱了一分钟。最后还是签了——但你不能有下次了。', t:2, b:-1, s:-2, r:2 },
      { text: '自掏腰包垫付，等项目结束再报销', feedback: '你的个人账户发出了哀嚎。这个月剩下的日子只能靠食堂了。', t:2, b:1, s:0, r:1 },
      { text: '把预算缺口藏到下个季度再处理', feedback: '这个季度的报表好看了。但下个季度的你打开账本时会倒吸一口凉气。', t:2, b:-1, s:0, r:2 },
    ],
  },
  satisfaction_mgmt: {
    standard: [
      { text: '充分沟通需求，确保理解客户的每一个关注点', feedback: '客户对你的专业态度表示认可。虽然多花了时间——但信任就是这样建立的。', t:-2, b:0, s:2, r:-1 },
      { text: '准备多套方案供客户选择，展示专业诚意', feedback: '三套方案摆出来，客户选了中间那套——跟你预判的完全一致。', t:-2, b:-1, s:2, r:-1 },
      { text: '安排正式的进度汇报会，让客户看到每一步', feedback: '汇报会让客户安心了不少。有时候他们只是需要"被看见"。', t:-1, b:0, s:1, r:-1 },
    ],
    flexible: [
      { text: '主动打电话沟通，用语音化解文字误会', feedback: '一通十分钟的电话解决了邮件来回三天没搞定的事。声音比文字有温度。', t:0, b:0, s:2, r:0 },
      { text: '多送一份增值服务，让客户觉得"赚到了"', feedback: '你多做的两页行业分析让客户发了👍表情。这两页值回了所有时间。', t:-1, b:-1, s:2, r:0 },
      { text: '请合作过的老客户帮忙说句好话', feedback: '老客户的背书比自己说一百句都管用。信任是会传递的。', t:0, b:0, s:1, r:-1 },
    ],
    risky: [
      { text: '先答应下来，后面再想办法兑现', feedback: '客户暂时满意了。但你许下的承诺像一座大山压在日程表上。', t:1, b:0, s:1, r:2 },
      { text: '给客户看未完成的版本，让他们给意见', feedback: '客户提了意见——但他们提的量你根本来不及在截止日前改完。', t:1, b:0, s:0, r:2 },
      { text: '跟客户说已经按他们的要求改了', feedback: '运气好的话他们不会仔细看。但你最好祈祷客户下周很忙。', t:2, b:1, s:-1, r:2 },
    ],
  },
  default: {
    standard: [
      { text: '按标准流程处理，确保每个环节到位', feedback: '流程走完了。虽然慢——但没有后遗症。', t:-2, b:0, s:0, r:-2 },
      { text: '协调各方资源，按部就班推进', feedback: '多线协调耗费了不少精力，但事情终于上了正轨。', t:-1, b:-1, s:1, r:-1 },
      { text: '列出详细执行计划，逐项落实', feedback: '计划执行率100%。代价是今天的步数创了新高——全是在各部门之间跑出来的。', t:-2, b:0, s:1, r:-1 },
    ],
    flexible: [
      { text: '找到关键人物，用最短路径解决问题', feedback: '直接找了能拍板的人，绕过三层审批。效率提升了——但越级操作可能被记了一笔。', t:0, b:0, s:0, r:0 },
      { text: '借力打力，用现有资源巧妙应对', feedback: '资源虽然紧张，但"拆东墙补西墙"暂时稳住了。希望东墙够结实。', t:0, b:0, s:1, r:1 },
      { text: '灵活调整方案，在规则范围内找最优解', feedback: '调整后的方案没有违反规则，但每一步都踩在边界上。你像在薄冰上跳舞。', t:0, b:1, s:0, r:1 },
    ],
    risky: [
      { text: '赌一把，用你直觉中最快的路径', feedback: '赌对了。但你的心跳直到事情落地那一刻才恢复正常。', t:2, b:0, s:-1, r:2 },
      { text: '跳过不必要的确认环节直接执行', feedback: '效率极高——但你跳过的确认环节里可能藏着没看见的坑。', t:2, b:1, s:-1, r:2 },
      { text: '把这件事排到最低优先级，先处理更紧急的', feedback: '搁置的事后来变成了紧急问题——但那时候你已经有了更多处理空间。大概吧。', t:1, b:0, s:0, r:1 },
    ],
  },
};

// ========== GENERATE NEW ROWS ==========
let newRows = [];
let nextTextId = 6000;
let newEventCounter = 1;

const csvThemeIds = Object.keys(CSV_TO_JSON);

for (const csvThemeId of csvThemeIds) {
  const jsonThemeId = CSV_TO_JSON[csvThemeId];
  const themeName = themeNameMap[jsonThemeId] || csvThemeId;
  const existing = currentEvents[csvThemeId] || new Set();
  const newEvents = THEME_EVENT_TITLES[jsonThemeId] || [];

  const needed = Math.max(0, TARGET_EVENTS - existing.size);
  const toAdd = newEvents.slice(0, needed);

  if (toAdd.length < needed) {
    console.log('⚠ ' + jsonThemeId + ': need ' + needed + ' but only ' + newEvents.length + ' templates available — will add ' + toAdd.length);
  }

  console.log(csvThemeId + ' (' + themeName + '): ' + existing.size + ' existing → adding ' + toAdd.length + ' new');

  for (const evDef of toAdd) {
    const eventId = 'X' + String(newEventCounter).padStart(3, '0');
    newEventCounter++;

    const cat = evDef.cat || 'time_pressure';
    const speaker = evDef.speaker || 'zhang_zong';
    const templates = getTemplates(cat);

    // Generate 3 texts per event: one standard, one flexible, one risky
    const postures = ['standard', 'flexible', 'risky'];

    for (const posture of postures) {
      const pool = templates[posture];
      // Pick template based on hash of eventId + posture
      const hash = (eventId + posture).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const tmpl = pool[hash % pool.length];

      const compositeScore = (tmpl.t || 0) + (tmpl.b || 0) + (tmpl.s || 0) + (tmpl.r || 0);
      const tags = posture === 'standard' ? 'time_heavy;risk_reducer' :
                   posture === 'flexible' ? 'neutral' : 'risk_taker;time_saver';
      const tone = posture === 'standard' ? 'formal' :
                   posture === 'flexible' ? 'professional' : 'casual';

      const row = [
        'T' + nextTextId,
        csvThemeId,
        themeName,
        eventId,
        evDef.title,
        cat,
        speaker,
        Math.ceil(Math.random() * 3), // difficulty 1-3
        'TRUE',
        '',
        tmpl.text,
        tmpl.feedback,
        tmpl.t,
        tmpl.b,
        tmpl.s,
        tmpl.r,
        compositeScore,
        tags,
        tone,
        '',
        '',
      ];
      newRows.push(row);
      nextTextId++;
    }
  }
}

// ========== WRITE EXPANDED CSV ==========
const BOM = '﻿';
const csvLines = [BOM + header];

// Original valid rows (skip N_ orphans)
for (const row of originalRows) {
  const eventId = row[3];
  if (eventId && !eventId.startsWith('N_') && (realEventIds.has(eventId) || eventId.startsWith('X'))) {
    csvLines.push(toCSVLine(row));
  }
}

// New rows
for (const row of newRows) {
  csvLines.push(toCSVLine(row));
}

fs.writeFileSync(CSV_OUTPUT, csvLines.join('\n'), 'utf-8');

// ========== SUMMARY ==========
console.log('\n========================================');
console.log('  EXPANSION v2 SUMMARY');
console.log('========================================');
console.log('Original rows kept: ' + originalRows.filter(r => {
  const eid = r[3];
  return eid && !eid.startsWith('N_') && realEventIds.has(eid);
}).length);
console.log('New rows generated: ' + newRows.length);
console.log('Total rows: ' + (csvLines.length - 1)); // minus header

// Per-theme validation
console.log('\n=== FINAL THEME COVERAGE ===');
const finalEvents = {};
for (let i = 1; i < csvLines.length; i++) {
  const cols = parseCSVLine(csvLines[i]);
  const themeId = cols[1];
  const eventId = cols[3];
  if (!eventId) continue;
  if (!finalEvents[themeId]) finalEvents[themeId] = new Set();
  finalEvents[themeId].add(eventId);
}

let allOk = true;
for (const csvId of csvThemeIds) {
  const events = finalEvents[csvId] || new Set();
  const count = events.size;
  const status = count >= 10 ? '✅' : '❌';
  if (count < 10) allOk = false;
  const jsonId = CSV_TO_JSON[csvId];
  const name = themeNameMap[jsonId] || csvId;
  console.log('  ' + status + ' ' + jsonId + ' (' + name + '): ' + count + ' events, events: [' + [...events].sort().join(', ') + ']');
}

// Cross-theme check
console.log('\n=== CROSS-THEME CHECK ===');
const eventToThemes = {};
for (const [csvId, events] of Object.entries(finalEvents)) {
  for (const evId of events) {
    if (!eventToThemes[evId]) eventToThemes[evId] = new Set();
    eventToThemes[evId].add(csvId);
  }
}
let crossCount = 0;
for (const [evId, themes] of Object.entries(eventToThemes)) {
  if (themes.size > 1) {
    crossCount++;
    console.log('  ❌ CROSS: ' + evId + ' in [' + [...themes].join(', ') + ']');
  }
}
if (crossCount === 0) {
  console.log('  ✅ Zero cross-theme events — every event belongs to exactly 1 theme');
}

console.log('\nOutput: ' + CSV_OUTPUT);
console.log('Done.');
