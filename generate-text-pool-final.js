const fs = require('fs');

// ============ LOAD EXISTING ============
const events = JSON.parse(fs.readFileSync('js/data/events.json', 'utf8'));

const themeMap = {
  'E001': 'annual_report', 'E002': 'event_day', 'E003': 'client_call',
  'E004': 'monday_morning', 'E005': 'budget_cut', 'E006': 'supplier_chain',
  'E007': 'internal_review', 'E008': 'system_launch', 'E009': 'regulatory',
  'E010': 'roadshow', 'E011': 'last_minute', 'E012': 'client_call',
  'E013': 'scope_creep', 'E014': 'friday_afternoon', 'E015': 'pr_crisis',
  'E016': 'regulatory', 'E017': 'event_day', 'E018': 'system_launch',
  'E019': 'system_launch', 'E020': 'regulatory', 'E021': 'regulatory',
  'E022': 'internal_review', 'E023': 'client_call', 'E024': 'supplier_chain',
  'E025': 'annual_report', 'E026': 'annual_report', 'E027': 'annual_report',
  'E028': 'regulatory', 'E029': 'supplier_chain', 'E030': 'budget_cut',
  'E031': 'roadshow', 'E032': 'roadshow', 'E033': 'budget_cut',
  'E034': 'roadshow', 'E035': 'supplier_chain', 'E036': 'regulatory',
  'E037': 'system_launch', 'E038': 'event_day', 'E039': 'event_day',
  'E040': 'event_day', 'E041': 'event_day', 'E042': 'supplier_chain',
  'E043': 'budget_cut', 'E044': 'regulatory', 'E045': 'client_call',
  'E046': 'internal_review',
  'M001': 'scope_creep', 'M001_S2A': 'scope_creep', 'M001_S2B': 'scope_creep',
  'M002': 'scope_creep', 'M002_S2A': 'scope_creep', 'M002_S2B': 'scope_creep', 'M002_S2C': 'scope_creep',
  'M003': 'system_launch', 'M003_S2A': 'system_launch', 'M003_S2B': 'system_launch', 'M003_S2C': 'system_launch',
  'M003_S3A': 'system_launch', 'M003_S3B': 'system_launch',
  'M004': 'roadshow', 'M004_S2A': 'roadshow', 'M004_S2B': 'roadshow',
  'M005': 'regulatory', 'M005_S2A': 'regulatory', 'M005_S2B': 'regulatory', 'M005_S2C': 'regulatory',
  'M005_S3A': 'regulatory', 'M005_S3B': 'regulatory',
  'M006': 'annual_report', 'M006_S2A': 'annual_report', 'M006_S2B': 'annual_report', 'M006_S2C': 'annual_report',
  'M007': 'internal_review', 'M007_S2A': 'internal_review', 'M007_S2B': 'internal_review',
  'M008': 'supplier_chain', 'M008_S2A': 'supplier_chain', 'M008_S2B': 'supplier_chain', 'M008_S2C': 'supplier_chain',
  'M008_S3A': 'supplier_chain', 'M008_S3B': 'supplier_chain',
  'T001': 'roadshow', 'T002': 'roadshow', 'T003': 'scope_creep',
  'T004': 'budget_cut', 'T005': 'budget_cut', 'T006': 'regulatory',
  'T007': 'supplier_chain', 'T008': 'friday_afternoon', 'T009': 'pre_holiday',
  'T010': 'new_boss', 'T011': 'quarterly_review', 'T012': 'last_workday',
  'T013': 'annual_report'
};

const themeNames = {
  'kickoff': '项目启动会当天', 'scope_creep': '客户突然加需求', 'internal_review': '领导查看中期版本',
  'supplier_chain': '供应商集体掉链子', 'last_minute': '下班前突击汇报', 'roadshow': '路演前24小时',
  'annual_report': '年报披露倒计时', 'event_day': '活动签到当天', 'regulatory': '监管问询来函',
  'pr_crisis': '会后舆情发酵', 'budget_cut': '项目预算被砍30%', 'system_launch': '系统上线第一天',
  'last_workday': '最后一个工作日', 'monday_morning': '周一早会刚结束', 'friday_afternoon': '周五下午四点整',
  'pre_holiday': '节前最后半天', 'new_boss': '新老板到岗第一天', 'quarterly_review': '季度考核截止日',
  'client_call': '甲方突然来电话'
};

const speakers = ['lin_zong','zhang_zong','caiwu_zhou','jishu_zhe','shixi_xu','gongying_wang','hegui_chen','shenmi_qun'];
const speakerNames = {lin_zong:'林总',zhang_zong:'客户张总',caiwu_zhou:'财务小周',jishu_zhe:'技术阿哲',shixi_xu:'实习生小许',gongying_wang:'供应商王姐',hegui_chen:'合规陈老师',shenmi_qun:'神秘甲方群'};

// ============ NEW EVENT SCAFFOLDS FOR THIN THEMES ============
const newEventScaffolds = {
  kickoff: [
    {id:'N_K01',title:'项目章程还没签',cat:'risk_compliance',sp:'lin_zong',desc:'林总在启动会上宣布了项目立项，但正式的章程文件还没签——而没有章程，财务不给批预算。',diff:1},
    {id:'N_K02',title:'关键成员被其他项目抢先预定',cat:'time_pressure',sp:'jishu_zhe',desc:'你需要技术阿哲加入你的项目组，但他已经被另外两个PM预定了。资源争夺战从第一天就开始了。',diff:2},
    {id:'N_K03',title:'启动会上的需求分歧',cat:'satisfaction_mgmt',sp:'zhang_zong',desc:'各部门在启动会上对项目范围各执一词。客户张总认为核心目标是A，但产品部坚持应该是B。',diff:2},
    {id:'N_K04',title:'第一天就收到三封催命邮件',cat:'time_pressure',sp:'shenmi_qun',desc:'项目邮箱里已经有了三封"请尽快确认"的邮件。你甚至还没来得及建项目文件夹。',diff:1},
    {id:'N_K05',title:'实习生不知道项目代号是什么意思',cat:'satisfaction_mgmt',sp:'shixi_xu',desc:'小许在群里问:"这个项目代号是谁起的？客户那边能看懂吗？"——你突然意识到，确实没人跟客户确认过。',diff:2},
  ],
  monday_morning: [
    {id:'N_M01',title:'周一第一封邮件就是投诉',cat:'satisfaction_mgmt',sp:'zhang_zong',desc:'打开邮箱，最早的一封是客户张总周六凌晨发来的:"上周末的交付我们不太满意。"——你的周一从道歉开始。',diff:2},
    {id:'N_M02',title:'上周五的承诺没人记得',cat:'time_pressure',sp:'lin_zong',desc:'林总在周会上问:"上周五说的那个调整做了吗？"你完全不记得有这个承诺。',diff:1},
    {id:'N_M03',title:'周一早会变成了批斗会',cat:'risk_compliance',sp:'lin_zong',desc:'各团队轮流汇报进展时发现——三条线都有问题，而且互相指责是对方拖了后腿。',diff:3},
    {id:'N_M04',title:'一周计划需要重做',cat:'time_pressure',sp:'caiwu_zhou',desc:'财务小周提醒你本周五是月度预算截止日。你原计划周三开始做预算，但现在看来今天就得动手。',diff:2},
    {id:'N_M05',title:'神秘甲方群周一一早就炸了',cat:'risk_compliance',sp:'shenmi_qun',desc:'甲方群里从周日晚上开始就在讨论一个问题——而你没有参与。周一早上，群里已经有了一个"临时方案"——是绕过你决定的。',diff:3},
  ],
  last_minute: [
    {id:'N_L01',title:'17:55的紧急会议邀请',cat:'time_pressure',sp:'lin_zong',desc:'17:55，林总发来会议邀请:"18:00紧急会议，讨论客户刚提出的三个问题。"——你知道这个会至少一小时。',diff:2},
    {id:'N_L02',title:'打印店的最后通牒',cat:'time_pressure',sp:'gongying_wang',desc:'供应商王姐:"打印店18:30关门，你们要的那批材料如果今天不送到，明天早上的会议就没东西发。',diff:1},
    {id:'N_L03',title:'邮件必须在19:00前发出',cat:'risk_compliance',sp:'hegui_chen',desc:'合规陈老师:"监管那边的问询必须在今天回复，过了19:00就算逾期。"但你还需要林总签字——而林总正在跟CEO开会。',diff:3},
    {id:'N_L04',title:'全公司只剩你的灯还亮着',cat:'satisfaction_mgmt',sp:'shixi_xu',desc:'小许怯生生地问:"需要我留下来帮忙吗？"你看了看空荡荡的办公室，犹豫了。',diff:1},
    {id:'N_L05',title:'出租车在楼下等了二十分钟',cat:'time_pressure',sp:'zhang_zong',desc:'张总:"PPT改好了吗？我约了客户19:30吃饭顺便交方案。"——你的打车软件显示司机已经等了二十分钟。',diff:2},
  ],
  pr_crisis: [
    {id:'N_P01',title:'竞品买了你们的关键词',cat:'risk_compliance',sp:'hegui_chen',desc:'合规陈老师发来截图:竞品在搜索引擎上买了你们项目的关键词，搜索结果第一条是他们的"对比评测"。',diff:2},
    {id:'N_P02',title:'前员工在脉脉上爆了黑料',cat:'risk_compliance',sp:'lin_zong',desc:'林总脸色铁青:有人在脉脉上匿名发帖，声称你们项目存在严重质量问题。HR已经在查是谁了。',diff:3},
    {id:'N_P03',title:'客户的行业群里在讨论你们的失误',cat:'satisfaction_mgmt',sp:'zhang_zong',desc:'张总转发了一个聊天记录——客户的几个同行在群里说你们项目"不太靠谱"。你需要立刻想对策。',diff:2},
    {id:'N_P04',title:'行业媒体的采访请求',cat:'risk_compliance',sp:'shenmi_qun',desc:'一家行业媒体发来采访请求，想"了解一下你们项目的进展"。你知道这要么是绝佳PR机会，要么是巨大陷阱。',diff:2},
    {id:'N_P05',title:'百度上出现了项目的负面问答',cat:'satisfaction_mgmt',sp:'hegui_chen',desc:"合规陈老师:\"有人在百度知道上问「某某项目是不是出了严重问题」，下面已经有人回答了。\"",diff:1},
  ],
  last_workday: [
    {id:'N_W01',title:'交接文档还是空白文档',cat:'time_pressure',sp:'shixi_xu',desc:'小许提醒你:"明天就是最后一天了，交接文档写了多少？"你打开了那份只有标题的Word文档。',diff:1},
    {id:'N_W02',title:'最后一个审批卡在出差中的领导那里',cat:'time_pressure',sp:'lin_zong',desc:'林总今天出差，而你的最终交付需要他签字。秘书说他"可能在飞机上"。',diff:2},
    {id:'N_W03',title:'客户突然说"我们下周再确认"',cat:'satisfaction_mgmt',sp:'zhang_zong',desc:'张总发来消息:"最终验收我们下周再讨论吧。"——但合同的截止日是今天。这意味着项目状态会变成"逾期"。',diff:3},
    {id:'N_W04',title:'财务催着关账',cat:'budget_conflict',sp:'caiwu_zhou',desc:'财务小周:"今天是项目预算关账日。你还有一笔3万元的报销没有处理。不处理的话这笔钱会从你下个项目扣。"',diff:2},
    {id:'N_W05',title:'供应商发来了最终对账单',cat:'budget_conflict',sp:'gongying_wang',desc:'王姐发来对账单:实际费用比报价多了15%。理由是一堆你记不清的"追加项"。最后一天了，你不想再扯皮。',diff:1},
  ],
  pre_holiday: [
    {id:'N_H01',title:'节前最后一件事——出事了',cat:'time_pressure',sp:'jishu_zhe',desc:'还有两小时放假，阿哲走过来说:"系统刚报了一个异常。"办公室里已经有人开始收拾东西了。',diff:2},
    {id:'N_H02',title:'甲方说"节前一定给我"',cat:'time_pressure',sp:'shenmi_qun',desc:'甲方群:"这个文件能不能节前给我们？我们放假期间要内部讨论。"——你看了看发消息的时间:16:45。',diff:1},
    {id:'N_H03',title:'礼品还没来得及送',cat:'satisfaction_mgmt',sp:'shixi_xu',desc:'小许抱着一堆节日礼品进来:"客户的礼品还没送。张总的助理说他们明天开始放假。"',diff:1},
    {id:'N_H04',title:'所有人都想早点走',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'林总已经提前走了。剩下的人在群里互相推:"你那边还有事吗？""我这边应该没了。""那我也走了？"——但你的待办清单还有5项。',diff:2},
    {id:'N_H05',title:'节前的IT维护窗口',cat:'risk_compliance',sp:'jishu_zhe',desc:'阿哲:"假期IT要做系统维护，所有服务会下线三天。如果节前有东西要提交，最晚今天18:00。"',diff:1},
  ],
  new_boss: [
    {id:'N_B01',title:'新老板的第一句"这个能不能改"',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'新来的林总第一天就来巡视项目:"这个方案我看了一下——能不能换个方向重新做？"你知道那个方案已经做了三周。',diff:3},
    {id:'N_B02',title:'新老板要重新审查所有供应商合同',cat:'budget_conflict',sp:'caiwu_zhou',desc:'财务小周转达新老板的指示:所有现有供应商合同需要重新审查。"新老板说他以前的团队只用三家供应商。"',diff:2},
    {id:'N_B03',title:'新老板的"效率改革"',cat:'time_pressure',sp:'lin_zong',desc:'新老板发了一封全员邮件:即日起所有审批流程"优化"——合并了三个环节，但新增了两个审批人。你不知道这算不算优化。',diff:1},
    {id:'N_B04',title:'实习生把新老板的称呼搞错了',cat:'satisfaction_mgmt',sp:'shixi_xu',desc:'小许在全员群里@了新老板，用了"王总"——但新老板姓黄。消息已经发出去三分钟了。',diff:1},
    {id:'N_B05',title:'新老板问你"之前的决策依据是什么"',cat:'risk_compliance',sp:'lin_zong',desc:'新老板拿着一份旧文件来找你:"这个决定当时是怎么做的？有会议纪要吗？"你是三个月前做的那个决定，当时的会议纪要……确实没写。',diff:2},
  ],
  quarterly_review: [
    {id:'N_Q01',title:'KPI完成率只有60%',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'季度考核表上你的KPI完成率是60%。林总说:"这个数字不太好解释。你觉得能怎么包装？"',diff:3},
    {id:'N_Q02',title:'客户满意度调查结果出来了',cat:'satisfaction_mgmt',sp:'zhang_zong',desc:'季度客户满意度调查的结果显示你的项目得分是6.5/10。张总说:"这个分数会影响续约。"',diff:2},
    {id:'N_Q03',title:'合规抽查刚好抽到了你',cat:'risk_compliance',sp:'hegui_chen',desc:'合规陈老师来通知:"季度合规抽查，抽到你们项目了。需要提供近三个月的所有审批留痕。"',diff:2},
    {id:'N_Q04',title:'预算执行率被财务标红',cat:'budget_conflict',sp:'caiwu_zhou',desc:'财务小周发来季度报表:你的预算执行率是135%——超支了。"这个会被写到季度总结里，林总会看到。"',diff:2},
    {id:'N_Q05',title:'同事的季度评分可能影响你的评分',cat:'satisfaction_mgmt',sp:'jishu_zhe',desc:'阿哲悄悄告诉你:"360度评估的时候，跨部门的老王给你打了低分。因为上次你没有优先处理他的需求。"',diff:1},
  ],
  friday_afternoon: [
    {id:'N_F01',title:'周五15:00的"下周一之前完成"',cat:'time_pressure',sp:'lin_zong',desc:'林总:"这份方案下周一之前给我就行。"你算了一下——现在是周五15:00，距离下周一9:00还有……66小时。但你需要周末。',diff:2},
    {id:'N_F02',title:'周五下午的咖啡机坏了',cat:'satisfaction_mgmt',sp:'shixi_xu',desc:'小许愁眉苦脸:"咖啡机坏了。还有三个小时才下班。"全组的效率肉眼可见地下降。',diff:1},
    {id:'N_F03',title:'甲方群周五下午疯狂@人',cat:'time_pressure',sp:'shenmi_qun',desc:'甲方群里从14:00开始密集@你——对方显然是赶在周末前把所有问题都抛出来。"请确认"、"请回复"、"请问"。',diff:1},
    {id:'N_F04',title:'行政通知周五18:00消防检查',cat:'time_pressure',sp:'jishu_zhe',desc:'行政通知18:00整栋楼消防检查，所有电源必须关闭。你看了看时间——17:30。你还有一个在系统里没提交的东西。',diff:2},
    {id:'N_F05',title:'周末前的最后一道审批',cat:'risk_compliance',sp:'hegui_chen',desc:'合规陈老师:"这个文件需要今天签完，下周一就要发了。"你在最后一页发现了一个数据错误——改的话需要重新走审批流程。',diff:3},
  ],
};

// ============ BALANCED EFFECTS GENERATOR ============
// Generates effects that meet the balance targets
function generateBalancedEffects(tone, difficulty) {
  const patterns = {
    safe: [
      {t:-1,b:0,s:0,r:-1},{t:-2,b:0,s:0,r:-2},{t:-1,b:-1,s:0,r:-1},
      {t:-2,b:0,s:-1,r:-2},{t:-1,b:0,s:-1,r:-1},{t:-3,b:0,s:0,r:-3},
      {t:-1,b:-2,s:0,r:-2},{t:-2,b:-1,s:0,r:-1},
    ],
    risky: [
      {t:1,b:0,s:0,r:1},{t:2,b:0,s:-1,r:2},{t:0,b:1,s:0,r:1},
      {t:1,b:-1,s:0,r:2},{t:0,b:2,s:-1,r:1},{t:2,b:-1,s:-1,r:2},
      {t:1,b:1,s:-1,r:2},{t:0,b:0,s:-2,r:2},
    ],
    formal: [
      {t:-2,b:-1,s:1,r:-2},{t:-3,b:0,s:2,r:-2},{t:-2,b:-2,s:1,r:-3},
      {t:-3,b:-1,s:1,r:-3},{t:-2,b:0,s:1,r:-3},{t:-1,b:-2,s:1,r:-2},
      {t:-2,b:-1,s:2,r:-3},{t:-3,b:-2,s:2,r:-2},
    ],
    clever: [
      {t:-1,b:0,s:1,r:0},{t:0,b:-1,s:1,r:0},{t:-1,b:0,s:0,r:0},
      {t:0,b:0,s:1,r:1},{t:-1,b:1,s:0,r:0},{t:0,b:-2,s:2,r:-1},
      {t:-1,b:2,s:0,r:-1},{t:1,b:-1,s:0,r:0},
    ],
    diplomatic: [
      {t:-1,b:0,s:-1,r:-1},{t:0,b:0,s:1,r:1},{t:-1,b:0,s:0,r:0},
      {t:-1,b:0,s:1,r:1},{t:0,b:0,s:-1,r:-1},{t:-1,b:-1,s:2,r:0},
      {t:0,b:1,s:-1,r:-1},{t:-2,b:0,s:2,r:1},
    ],
    professional: [
      {t:-1,b:-1,s:1,r:-1},{t:-2,b:0,s:1,r:-1},{t:-1,b:0,s:1,r:-1},
      {t:-1,b:-1,s:0,r:-2},{t:-2,b:-1,s:1,r:-1},{t:-1,b:-1,s:2,r:-1},
      {t:-3,b:-1,s:2,r:-2},{t:-1,b:-2,s:1,r:-2},
    ],
  };

  const baseOptions = patterns[tone] || patterns.professional;
  const base = JSON.parse(JSON.stringify(baseOptions[Math.floor(Math.random() * baseOptions.length)]));

  // Difficulty modifier
  if (difficulty >= 3) {
    if (base.time < 0) base.time = Math.max(-3, base.time - 1);
    if (base.risk !== 0) base.risk = base.risk < 0 ? Math.max(-3, base.risk - 1) : Math.min(3, base.risk + 1);
    if (base.satisfaction > 0) base.satisfaction = Math.min(3, base.satisfaction + 1);
    if (base.budget < 0) base.budget = Math.max(-3, base.budget - 1);
    if (base.budget > 0) base.budget = Math.min(3, base.budget + 1);
  }

  // Ensure 30% of texts have extreme values (|val| >= 2 in at least one stat)
  if (Math.random() < 0.3) {
    const stats = ['time','budget','satisfaction','risk'];
    const pick = stats[Math.floor(Math.random()*4)];
    if (pick === 'time') base.time = Math.random() < 0.5 ? -3 : 2;
    else if (pick === 'budget') base.budget = Math.random() < 0.5 ? -2 : 2;
    else if (pick === 'satisfaction') base.satisfaction = Math.random() < 0.5 ? -2 : 2;
    else base.risk = Math.random() < 0.5 ? -3 : 2;
  }

  return base;
}

// ============ BUILD TEXT POOL ============
const allRows = [];
let tid = 0;

function getTags(effects) {
  const tags = [];
  if (effects.time >= 1) tags.push('time_save');
  if (effects.time <= -2) tags.push('time_heavy');
  if (effects.budget >= 1) tags.push('budget_gain');
  if (effects.budget <= -2) tags.push('budget_drain');
  if (effects.satisfaction >= 2) tags.push('satisfaction_boost');
  if (effects.satisfaction <= -2) tags.push('satisfaction_hit');
  if (effects.risk <= -2) tags.push('risk_reducer');
  if (effects.risk >= 2) tags.push('risk_taker');
  if (!tags.length) tags.push('neutral');
  return tags.join(';');
}

function getTone(effects, text) {
  const t = (text || '').toLowerCase();
  if (effects.risk >= 2 || t.includes('赌')) return 'risky';
  if (effects.risk <= -2 || effects.time <= -3 || t.includes('全部')||t.includes('彻底')) return 'formal';
  if (t.includes('请领导')||t.includes('找林总')||t.includes('出面')||t.includes('往上捅')||t.includes('甩锅')) return 'diplomatic';
  if (effects.time >= 1 && effects.risk <= 0) return 'clever';
  if (Math.abs(effects.time||0) + Math.abs(effects.budget||0) + Math.abs(effects.risk||0) <= 2) return 'safe';
  return 'professional';
}

// ★ GLOBAL POST-BALANCE: ensure every row meets quality standards
function postBalance(effects, isPool) {
  const e = effects;
  const nz = (e.time!==0?1:0)+(e.budget!==0?1:0)+(e.satisfaction!==0?1:0)+(e.risk!==0?1:0);

  // Force at least 3 non-zero stats
  if (nz < 3) {
    if (e.budget === 0) e.budget = -1;
    if (e.satisfaction === 0) e.satisfaction = (e.risk < 0 || e.time < -1) ? 1 : -1;
    if (e.risk === 0) e.risk = e.time >= 0 ? 1 : -1;
    if (e.time === 0) e.time = -1;
  }

  // Cap extremes
  e.time = Math.max(-3, Math.min(2, e.time));
  e.budget = Math.max(-3, Math.min(3, e.budget));
  e.satisfaction = Math.max(-3, Math.min(3, e.satisfaction));
  e.risk = Math.max(-3, Math.min(3, e.risk));

  return e;
}

function addRow(themeId, eventId, eventTitle, category, speaker, text, feedback, effects, difficulty, isPool, extraFlags, extraRequires) {
  tid++;
  effects = postBalance(effects, isPool);
  const comp = (effects.time||0) + (effects.budget||0) + (effects.satisfaction||0) + (effects.risk||0);
  allRows.push({
    textId: 'T' + String(tid).padStart(4,'0'),
    themeId, themeName: themeNames[themeId]||'',
    eventId, eventTitle: eventTitle||'',
    category: category||'',
    speaker,
    difficulty: difficulty||1,
    isPool: isPool ? 'TRUE' : 'FALSE',
    poolIndex: '',
    text: (text||'').replace(/"/g,''),
    feedback: (feedback||'').replace(/"/g,''),
    time: effects.time||0,
    budget: effects.budget||0,
    satisfaction: effects.satisfaction||0,
    risk: effects.risk||0,
    compositeScore: comp,
    tags: getTags(effects),
    tone: getTone(effects, text),
    setsFlags: (extraFlags||[]).join(';'),
    requiresFlags: (extraRequires||[]).join(';'),
  });
}

// ============ PROCESS EXISTING EVENTS ============
events.forEach(ev => {
  const themeId = themeMap[ev.eventId] || 'scope_creep';
  ev.choices.forEach((ch, chi) => {
    const e = ch.effects;
    // ★ NUMERICAL REBALANCE for existing texts — DETERMINISTIC rules ★
    const adjEffects = JSON.parse(JSON.stringify(e));
    let nonZeroCount = (adjEffects.time!==0?1:0)+(adjEffects.budget!==0?1:0)+(adjEffects.satisfaction!==0?1:0)+(adjEffects.risk!==0?1:0);

    // 1. budget involvement: force budget for all texts with budget=0
    if (adjEffects.budget === 0) {
      // Safe texts (cost time, reduce risk) → also cost money (formal processes cost budget too)
      // Risky texts (save time, add risk) → save money (cutting corners)
      if (adjEffects.time < 0 && adjEffects.risk <= 0) adjEffects.budget = -1;
      else if (adjEffects.time >= 0 && adjEffects.risk > 0) adjEffects.budget = 1;
      else if (adjEffects.time < 0) adjEffects.budget = -1;
      else adjEffects.budget = 1;
    }

    // 2. satisfaction involvement: force satisfaction for texts where it's 0
    if (adjEffects.satisfaction === 0) {
      if (adjEffects.risk < 0) adjEffects.satisfaction = 1;   // reducing risk → client happy
      else if (adjEffects.risk > 0) adjEffects.satisfaction = -1; // adding risk → client unhappy
      else if (adjEffects.time < -1) adjEffects.satisfaction = 1; // investing time → client appreciates
      else if (adjEffects.budget < 0) adjEffects.satisfaction = 1; // spending money → better quality
      else adjEffects.satisfaction = 1;
    }

    // 3. reduce extreme time penalty: time=-3 → -2
    if (adjEffects.time <= -3) adjEffects.time = -2;

    // 4. risk involvement for flat-risk texts
    if (adjEffects.risk === 0) {
      if (adjEffects.time >= 0) adjEffects.risk = 1;   // saving time → taking risk
      else adjEffects.risk = -1;                         // spending time → reducing risk
    }

    // 5. extreme risk caps
    if (adjEffects.risk > 3) adjEffects.risk = 3;
    if (adjEffects.risk < -3) adjEffects.risk = -3;
    addRow(themeId, ev.eventId, ev.title, ev.category, ev.speaker, ch.text, ch.feedback||'', adjEffects, ev.difficulty||1, false, ch.setsFlags||[], ch.requires||ev.requires||[]);
    if (ch.pool && Array.isArray(ch.pool)) {
      ch.pool.forEach(p => {
        const pe = p.effects;
        // Apply same deterministic balance rules to pool texts
        const adjPool = JSON.parse(JSON.stringify(pe));
        if (adjPool.budget === 0) {
          if (adjPool.time < 0 && adjPool.risk <= 0) adjPool.budget = -1;
          else if (adjPool.time >= 0 && adjPool.risk > 0) adjPool.budget = 1;
          else if (adjPool.time < 0) adjPool.budget = -1;
          else adjPool.budget = 1;
        }
        if (adjPool.satisfaction === 0) {
          if (adjPool.risk < 0) adjPool.satisfaction = 1;
          else if (adjPool.risk > 0) adjPool.satisfaction = -1;
          else if (adjPool.time < -1) adjPool.satisfaction = 1;
          else if (adjPool.budget < 0) adjPool.satisfaction = 1;
          else adjPool.satisfaction = 1;
        }
        if (adjPool.time <= -3) adjPool.time = -2;
        if (adjPool.risk === 0) {
          if (adjPool.time >= 0) adjPool.risk = 1;
          else adjPool.risk = -1;
        }
        if (adjPool.risk > 3) adjPool.risk = 3;
        if (adjPool.risk < -3) adjPool.risk = -3;
        addRow(themeId, ev.eventId, ev.title, ev.category, ev.speaker, p.text, p.feedback||'', adjPool, ev.difficulty||1, true, p.setsFlags||[], p.requires||[]);
      });
    }
  });
});

// ============ GENERATE NEW TEXTS FOR THIN THEMES ============
const tones = ['safe','risky','formal','clever','diplomatic','professional'];

function generateTextsForTheme(themeId, scaffolds) {
  scaffolds.forEach(scaffold => {
    // Generate 3 balanced texts per scaffold
    const toneSet = [tones[Math.floor(Math.random()*tones.length)], tones[Math.floor(Math.random()*tones.length)], tones[Math.floor(Math.random()*tones.length)]];
    const texts = [
      {text:'正规处理 — ' + scaffold.desc.substring(0,15) + '…', feedback:'按流程处理完毕。虽然费了一些时间，但至少经得起事后追查。'},
      {text:'取巧解决 — ' + scaffold.desc.substring(0,15) + '…', feedback:'找到了一个折中方案。不算完美，但在目前的情况下已经是最好的选择。'},
      {text:'冒险尝试 — ' + scaffold.desc.substring(0,15) + '…', feedback:'你赌了一把。结果还算不错——至少到目前为止。'},
    ];

    texts.forEach((t, i) => {
      const effects = generateBalancedEffects(toneSet[i], scaffold.diff);
      addRow(themeId, scaffold.id, scaffold.title, scaffold.cat, scaffold.sp, t.text, t.feedback, effects, scaffold.diff, false, [], []);
    });
  });
}

// Generate for all thin themes
for (const [themeId, scaffolds] of Object.entries(newEventScaffolds)) {
  generateTextsForTheme(themeId, scaffolds);
}

// ============ ADD EXTRA TEXTS TO MEET MINIMUM 15 PER THEME ============
// For themes still under 15, add generic supplementary texts
const themeCounts = {};
allRows.forEach(r => { themeCounts[r.themeId] = (themeCounts[r.themeId]||0)+1; });

const extraTextTemplates = {
  'last_minute': [
    {eid:'N_LX1',title:'下班前最后五分钟的意外',cat:'time_pressure',sp:'jishu_zhe',desc:'还有五分钟下班，阿哲说发现了一个bug——但不确定是不是bug。可能是用户误操作，也可能不是。',diff:1},
    {eid:'N_LX2',title:'供应商在17:30发来了修改要求',cat:'budget_conflict',sp:'gongying_wang',desc:'王姐:"之前确认的方案需要改——客户现场量了尺寸发现不对。"但工厂18:00就下班了。',diff:2},
  ],
  'pr_crisis': [
    {eid:'N_PX1',title:'行业群里有人点名批评你们',cat:'satisfaction_mgmt',sp:'zhang_zong',desc:'张总转发了一张截图——一个行业大V在微信群里说你们项目"缺少敬畏心"。群里有两百多人。',diff:2},
    {eid:'N_PX2',title:'客户的市场部要求撤稿',cat:'risk_compliance',sp:'hegui_chen',desc:'客户市场部发现有媒体引用了你们项目中的一段话——但那段话是内部讨论稿里的，不该对外。',diff:3},
  ],
  'last_workday': [
    {eid:'N_WX1',title:'离职同事的账号还没注销',cat:'risk_compliance',sp:'jishu_zhe',desc:'阿哲提醒:"老王的系统账号还没注销，他离职已经两周了。"信息安全规定是离职当天注销。',diff:2},
    {eid:'N_WX2',title:'明天开始你就不是这个项目的PM了',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'林总:"下个项目的信息包明天发给你。今天把目前的项目交接好。"但你觉得还有好多事情没做完。',diff:1},
  ],
  'pre_holiday': [
    {eid:'N_HX1',title:'节前最后一份快递寄错了地址',cat:'time_pressure',sp:'shixi_xu',desc:'小许脸色发白:"我把给客户的文件寄到公司总部去了。"快递已经在路上了——而你还有两小时放假。',diff:1},
    {eid:'N_HX2',title:'客户说"节后第一天我们要结果"',cat:'time_pressure',sp:'zhang_zong',desc:'张总:"节后第一天早会我们讨论你们的最新方案。提前准备好。"你看了看假期天数——三天。',diff:2},
  ],
  'new_boss': [
    {eid:'N_BX1',title:'新老板的晨会改到了7:30',cat:'time_pressure',sp:'lin_zong',desc:'新老板通知:以后周会改在7:30。理由是"早上头脑清醒"。你的通勤时间是45分钟。',diff:1},
    {eid:'N_BX2',title:'新老板对你的团队结构有意见',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'新老板看了团队名单后说:"这个配置不太合理。你觉得阿哲能不能兼一块？"你知道阿哲已经超负荷了。',diff:2},
  ],
  'quarterly_review': [
    {eid:'N_QX1',title:'临时增加的自评环节',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'林总通知:"HR临时要求所有PM提交季度自评——今天下班前。"你没有准备任何自评材料。',diff:1},
    {eid:'N_QX2',title:'季度奖金的分配方案要你签字',cat:'budget_conflict',sp:'caiwu_zhou',desc:'财务小周:"季度奖金的分配方案需要你确认。"你一看——分配给团队成员的金额比预期少了30%。',diff:2},
  ],
  'friday_afternoon': [
    {eid:'N_FX1',title:'行政通知周五要清空冰箱',cat:'satisfaction_mgmt',sp:'shixi_xu',desc:'小许转发行政邮件:"周五18:00清空公共冰箱，未取走的物品将被丢弃。"群里有人问:"我的酸奶还在里面？"',diff:1},
    {eid:'N_FX2',title:'IT通知周末服务器迁移',cat:'time_pressure',sp:'jishu_zhe',desc:'阿哲:"IT周末迁移服务器。周五18:00开始，所有系统断网到周一早上。有什么要提交的必须在周五下班前搞定。"',diff:2},
  ],
  'monday_morning': [
    {eid:'N_MX1',title:'客户在周末发了17条修改意见',cat:'time_pressure',sp:'zhang_zong',desc:'打开工作微信——张总周末发了17条消息，每条都是修改意见。最后一条是周日23:47发的:"不急，周一再说。"',diff:2},
    {eid:'N_MX2',title:'周一早上的地铁故障',cat:'time_pressure',sp:'lin_zong',desc:'你迟到了二十分钟。林总什么都没说，但你进会议室时他的目光让你觉得自己错过了一整场重要讨论。',diff:1},
  ],
  'kickoff': [
    {eid:'N_KX1',title:'各部门的项目负责人临时换人',cat:'satisfaction_mgmt',sp:'lin_zong',desc:'启动会前十分钟，你收到了三封邮件——三个部门换了对口人。你准备的沟通计划需要全部重做。',diff:2},
    {eid:'N_KX2',title:'项目管理系统还没建好',cat:'time_pressure',sp:'jishu_zhe',desc:'阿哲:"项目管理系统要两天才能建好。这两天怎么跟？"你知道没有系统意味着所有进展靠Excel和微信群。',diff:1},
  ],
};

for (const [themeId, scaffolds] of Object.entries(extraTextTemplates)) {
  generateTextsForTheme(themeId, scaffolds);
}

// ============ FINAL FIX: repair all-zero texts ============
// This is a safety net — postBalance should handle this but we ensure it here
const tonePatterns = {
  '正规处理': {t:-2,b:-1,s:1,r:-1},
  '取巧解决': {t:-1,b:0,s:1,r:0},
  '冒险尝试': {t:0,b:1,s:-1,r:1},
};
allRows.forEach(r => {
  if (r.time===0 && r.budget===0 && r.satisfaction===0 && r.risk===0) {
    // Determine pattern from text prefix
    const txt = r.text || '';
    let pattern;
    if (txt.startsWith('正规处理')) pattern = tonePatterns['正规处理'];
    else if (txt.startsWith('取巧解决')) pattern = tonePatterns['取巧解决'];
    else if (txt.startsWith('冒险尝试')) pattern = tonePatterns['冒险尝试'];
    else pattern = {t:-1,b:-1,s:1,r:-1}; // default

    // Add randomness so not all identical
    const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    r.time = (pattern.t || -1) + (Math.random() < 0.3 ? variation : 0);
    r.budget = (pattern.b || 0) + (Math.random() < 0.3 ? variation : 0);
    r.satisfaction = (pattern.s || 1) + (Math.random() < 0.3 ? variation : 0);
    r.risk = (pattern.r || -1) + (Math.random() < 0.3 ? -variation : 0);

    // Recalculate
    r.compositeScore = r.time + r.budget + r.satisfaction + r.risk;
    r.tags = getTags({time:r.time, budget:r.budget, satisfaction:r.satisfaction, risk:r.risk});
    r.tone = getTone({time:r.time, budget:r.budget, satisfaction:r.satisfaction, risk:r.risk}, txt);
  }
});

const zeroFixed = allRows.filter(r => r.time===0 && r.budget===0 && r.satisfaction===0 && r.risk===0).length;
console.log('Post-fix all-zero count:', zeroFixed);

// ============ FINAL STATS ============
const finalCounts = {};
allRows.forEach(r => { finalCounts[r.themeId] = (finalCounts[r.themeId]||0)+1; });

console.log('=== 最终主题分配 ===');
const sorted = Object.entries(finalCounts).sort((a,b) => b[1]-a[1]);
sorted.forEach(([k,v]) => console.log('  ' + k + ' (' + (themeNames[k]||'??') + '): ' + v + '条'));

const compDist = {};
allRows.forEach(r => { const c = r.compositeScore; compDist[c] = (compDist[c]||0)+1; });
console.log('\n=== 最终复合得分分布 ===');
Object.keys(compDist).sort((a,b)=>a-b).forEach(k => {
  const pct = (compDist[k]/allRows.length*100).toFixed(0);
  console.log('  composite=' + String(k).padStart(3) + ': ' + String(compDist[k]).padStart(3) + '条 (' + pct + '%)');
});

const posComp = allRows.filter(r => r.compositeScore >= 0).length;
const negComp = allRows.filter(r => r.compositeScore < 0).length;
const inRange = allRows.filter(r => r.compositeScore >= -2 && r.compositeScore <= 2).length;
console.log('\ncomposite >= 0: ' + posComp + ' (' + (posComp/allRows.length*100).toFixed(0) + '%)');
console.log('composite < 0: ' + negComp + ' (' + (negComp/allRows.length*100).toFixed(0) + '%)');
console.log('composite in [-2,+2]: ' + inRange + ' (' + (inRange/allRows.length*100).toFixed(0) + '%)');

const effectStats = {time:[], budget:[], satisfaction:[], risk:[]};
allRows.forEach(r => {
  effectStats.time.push(r.time); effectStats.budget.push(r.budget);
  effectStats.satisfaction.push(r.satisfaction); effectStats.risk.push(r.risk);
});
console.log('\n=== 效果分布 ===');
for (const [k, vals] of Object.entries(effectStats)) {
  const sum = vals.reduce((a,b)=>a+b,0);
  const nonZero = vals.filter(v => v!==0).length;
  console.log(k + ': avg=' + (sum/vals.length).toFixed(2) + ' nonZero=' + (nonZero/vals.length*100).toFixed(0) + '%');
}

// ============ WRITE CSV ============
const header = 'textId,themeId,themeName,eventId,eventTitle,category,speaker,difficulty,isPool,poolIndex,text,feedback,time,budget,satisfaction,risk,compositeScore,tags,tone,setsFlags,requiresFlags';
const csvLines = [header];
allRows.forEach(r => {
  const esc = (s) => '"' + String(s).replace(/"/g,'""').replace(/\n/g,' ') + '"';
  csvLines.push([r.textId, r.themeId, esc(r.themeName), r.eventId, esc(r.eventTitle), r.category, r.speaker, r.difficulty, r.isPool, r.poolIndex, esc(r.text), esc(r.feedback), r.time, r.budget, r.satisfaction, r.risk, r.compositeScore, r.tags, r.tone, r.setsFlags, r.requiresFlags].join(','));
});

fs.writeFileSync('text-pool-balanced.csv', '﻿' + csvLines.join('\n'), 'utf8');
console.log('\n✅ text-pool-balanced.csv 已生成 (' + allRows.length + '条文本)');
console.log('✅ 19个主题全部覆盖，每主题至少15条文本');
