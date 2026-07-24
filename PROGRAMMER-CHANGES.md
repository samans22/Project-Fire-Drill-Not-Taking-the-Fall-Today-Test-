# 程序修改说明 — 文本池扩充后的配套代码修改

> **写给程序员**：以下是策划已完成的工作，以及你需要配合修改的代码部分。
> 策划只修改了 `text-pool-balanced.csv`，未改动任何 `.js` / `.json` 文件。

---

## 一、策划已完成的工作

### 修改的唯一文件
- **`text-pool-balanced.csv`** — 从 515 行扩充至 732 行

### 扩充内容
| 指标 | 扩充前 | 扩充后 |
|------|--------|--------|
| 文本总行数 | 515 | **732** |
| 每主题事件数 | 1~14（16 个主题 <10） | **12~14**（全部 ≥12） |
| 跨主题共享事件 | 0 | **0** |
| 孤儿行 (N_ 前缀) | 189 | **0** |
| 新增事件 | — | **136** 个（ID: X001 ~ X136） |

### CSV 列结构（未变）
```
textId, themeId, themeName, eventId, eventTitle, category, speaker,
difficulty, isPool, poolIndex, text, feedback, time, budget,
satisfaction, risk, compositeScore, tags, tone, setsFlags, requiresFlags
```

---

## 二、需要程序做的修改

### 修改 1：修复 `tools/rebuild-from-csv.js` 的 compositeScore 公式

**文件**: `tools/rebuild-from-csv.js`  
**位置**: 第 98 行

**当前代码（错误）**:
```js
const compositeScore = (time + budget + satisfaction) - risk;
```

**应改为**:
```js
const compositeScore = (time + budget + satisfaction) + risk;
```

**原因**: 
- time (10→0): 越低越差
- budget (10→0): 越低越差
- satisfaction (10→0): 越低越差
- risk (0→10): 越高越差

四个维度都是"越差数字越大"，所以 compositeScore = 四项直接相加。
用减号会变成 risk 越高 composite 越低，与设计逻辑相反。

> CSV 中的 compositeScore 列已经是正确的值。改完公式后运行 rebuild 脚本，
> 生成的 text-pool.json 中 compositeScore 才会与 CSV 一致。

---

### 修改 2：运行 `rebuild-from-csv.js` 重建 JSON 数据

修改完上述公式后，运行：

```bash
node tools/rebuild-from-csv.js
```

这会自动更新：
- `js/data/text-pool.json` — 从 CSV 重建文本池
- `js/data/themes.json` — 更新各主题的 boosted 事件列表

**验证标准**：
- 输出显示 `Total texts: 732`
- 输出显示 `✅ Zero cross-theme eventIds in text-pool.json`
- 输出显示 `✅ All 19 themes have text-pool entries`
- 每个主题的 boosted 列表包含该主题的所有事件（含 X 前缀事件）

---

### 修改 3：为 `js/data/events.json` 添加 136 个 X 前缀事件条目

**为什么需要**：  
`Events.pickEvent()` 只能从 `events.json` 中选取事件。X001-X136 目前不存在于 events.json，
所以即使 text-pool.json 包含它们的文本，游戏也无法选中这些事件。

**事件数据结构**（每个 X 事件一个条目）：
```json
{
  "eventId": "X001",
  "projectTags": ["*"],
  "title": "项目范围界定不清",
  "text": "",
  "speaker": "zhang_zong",
  "category": "time_pressure",
  "choices": []
}
```

**字段说明**：
| 字段 | 来源 | 说明 |
|------|------|------|
| `eventId` | CSV 第 4 列 | X001 ~ X136 |
| `projectTags` | 固定值 | `["*"]` 表示所有项目类型都可触发 |
| `title` | CSV 第 5 列 | 事件标题（中文） |
| `text` | 固定值 | 可留空 `""` 或写一句简短描述——文本池会通过 `_injectTextPoolChoices()` 自动注入选项 |
| `speaker` | CSV 第 7 列 | 事件触发者 |
| `category` | CSV 第 6 列 | 事件分类：`time_pressure` / `risk_compliance` / `budget_conflict` / `satisfaction_mgmt` |
| `choices` | 固定值 | `[]` 空数组即可，文本池会自动注入 |

**完整的 136 个事件定义见附录 A**。

---

### 修改 4（可选优化）：处理 rebuild 脚本中的 themeId 过滤

`rebuild-from-csv.js` 第 44 行定义了 `realEventIds`：
```js
const realEventIds = new Set(events.map(e => e.eventId));
```

这个变量定义了但脚本中并未使用它做过滤。当前逻辑自动处理所有非 `N_` 前缀的事件，
所以 X 事件也能正常通过。**无需额外修改**，但如果你想让代码更清晰，
可以在 events.json 更新后让这个 Set 自然包含 X 事件。

---

## 三、验证清单

改完后请逐项确认：

- [ ] `rebuild-from-csv.js` compositeScore 公式改为 `+ risk`
- [ ] 运行 `node tools/rebuild-from-csv.js` 无报错
- [ ] `js/data/text-pool.json` 包含 732 条文本
- [ ] `js/data/themes.json` 中每个主题的 `boosted` 列表包含该主题所有事件
- [ ] `js/data/events.json` 包含 X001 ~ X136 共 136 个新事件条目
- [ ] 游戏中每个主题能正常触发多种事件（不再只有一个事件反复出现）
- [ ] 控制台无 JS 报错

---

---

# 附录 A：136 个 X 事件完整定义

> 以下数据可直接用于 events.json。按主题分组，方便核對。

## project_kickoff（项目启动会当天）— 12 个新事件

```json
{"eventId":"X024","projectTags":["*"],"title":"项目范围界定不清","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X025","projectTags":["*"],"title":"全员kickoff时间难统一","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X026","projectTags":["*"],"title":"客户对项目目标有不同理解","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X027","projectTags":["*"],"title":"技术评估还没完成就要排期","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X028","projectTags":["*"],"title":"启动会的关键人员临时缺席","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X029","projectTags":["*"],"title":"项目章程被质疑流程不合规","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X030","projectTags":["*"],"title":"资源分配方案遭到部门反对","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X031","projectTags":["*"],"title":"客户要求启动会前看到详细计划","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X032","projectTags":["*"],"title":"项目代号引发跨部门误会","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X033","projectTags":["*"],"title":"启动会上CEO突然提了新方向","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X034","projectTags":["*"],"title":"项目预算在启动前被冻结审查","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X035","projectTags":["*"],"title":"启动会材料被合规要求大改","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
```

## client_adds_requirements（客户突然加需求）— 3 个新事件

```json
{"eventId":"X083","projectTags":["*"],"title":"新需求涉及未评估的技术栈","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X084","projectTags":["*"],"title":"客户追加需求后的合同修订","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X085","projectTags":["*"],"title":"新增需求导致的预算重算","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
```

## leadership_review（领导查看中期版本）— 6 个新事件

```json
{"eventId":"X018","projectTags":["*"],"title":"领导对方案结构提出根本性质疑","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X019","projectTags":["*"],"title":"中期汇报中的数据不一致问题","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X020","projectTags":["*"],"title":"领导要求加入新部门的工作成果","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X021","projectTags":["*"],"title":"审查会上暴露的团队沟通断层","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X022","projectTags":["*"],"title":"领导要求压缩交付周期","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X023","projectTags":["*"],"title":"审查发现关键假设未经验证","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
```

## vendor_failure（供应商集体掉链子）— 0 个新事件（已有足够事件）

## last_minute_report（下班前突击汇报）— 11 个新事件

```json
{"eventId":"X036","projectTags":["*"],"title":"下班前的数据更新请求","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X037","projectTags":["*"],"title":"汇报PPT的格式突然要大改","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X038","projectTags":["*"],"title":"关键数据源在下班后关闭","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X039","projectTags":["*"],"title":"汇报对象临时增加了大领导","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X040","projectTags":["*"],"title":"打印店已经关门但需要纸质版","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X041","projectTags":["*"],"title":"下班前收到的竞品动态需要纳入汇报","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X042","projectTags":["*"],"title":"汇报前的预演暴露了逻辑漏洞","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X043","projectTags":["*"],"title":"领导要求在汇报中加入敏感数据","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X044","projectTags":["*"],"title":"汇报用的系统在下班时维护","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X045","projectTags":["*"],"title":"协作部门下班前才给反馈意见","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X046","projectTags":["*"],"title":"汇报结束后需要立即提供补充材料","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
```

## roadshow_eve（路演前24小时）— 3 个新事件

```json
{"eventId":"X080","projectTags":["*"],"title":"路演场地的网络带宽不达标","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X081","projectTags":["*"],"title":"演示设备的备用方案未测试","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X082","projectTags":["*"],"title":"路演前的媒体预览出现误读","text":"","speaker":"zhang_zong","category":"risk_compliance","choices":[]}
```

## annual_report_deadline（年报披露倒计时）— 3 个新事件

```json
{"eventId":"X001","projectTags":["*"],"title":"年报中的管理层讨论部分被退回重写","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X002","projectTags":["*"],"title":"审计师要求补充关联交易细节","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X003","projectTags":["*"],"title":"年报设计排版在截止日前出错","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
```

## event_checkin_day（活动签到当天）— 6 个新事件

```json
{"eventId":"X012","projectTags":["*"],"title":"临时增加的VIP需要特殊接待","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X013","projectTags":["*"],"title":"活动流程中的茶歇供应商迟到","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X014","projectTags":["*"],"title":"会场消防检查突然加严","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X015","projectTags":["*"],"title":"签到处的人流引导方案失效","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X016","projectTags":["*"],"title":"媒体采访区的背景板印错","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X017","projectTags":["*"],"title":"参会嘉宾的接送车辆安排冲突","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
```

## regulatory_inquiry（监管问询来函）— 0 个新事件（已有足够事件）

## post_event_turbulence（会后舆情发酵）— 11 个新事件

```json
{"eventId":"X069","projectTags":["*"],"title":"舆情监测系统报警后的应对","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X070","projectTags":["*"],"title":"媒体要求对活动中的争议做出回应","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X071","projectTags":["*"],"title":"内部员工在社交媒体上的不当发言","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X072","projectTags":["*"],"title":"活动后有匿名信举报流程违规","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X073","projectTags":["*"],"title":"合作方对活动效果表示不满","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X074","projectTags":["*"],"title":"活动现场照片被恶意解读传播","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X075","projectTags":["*"],"title":"活动数据被质疑造假","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X076","projectTags":["*"],"title":"领导要求对舆情进行书面回应","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X077","projectTags":["*"],"title":"活动后的复盘会议暴露组织问题","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X078","projectTags":["*"],"title":"活动赞助商因舆情要求退款","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X079","projectTags":["*"],"title":"行业协会发函询问活动合规性","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
```

## budget_cut（项目预算被砍30%）— 6 个新事件

```json
{"eventId":"X099","projectTags":["*"],"title":"被砍预算后的团队士气危机","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X100","projectTags":["*"],"title":"预算削减导致的关键岗位离职风险","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X101","projectTags":["*"],"title":"被迫使用低成本方案的质量风险","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X102","projectTags":["*"],"title":"预算砍了但交付标准没降","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X103","projectTags":["*"],"title":"砍预算后供应商拒绝继续合作","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X104","projectTags":["*"],"title":"预算缩减下的加班费争议","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
```

## system_launch_day（系统上线第一天）— 2 个新事件

```json
{"eventId":"X086","projectTags":["*"],"title":"上线后的数据库连接池耗尽","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X087","projectTags":["*"],"title":"运营团队对新系统操作不熟练","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
```

## last_working_day（最后一个工作日）— 11 个新事件

```json
{"eventId":"X047","projectTags":["*"],"title":"最后一个工作日的紧急客户投诉","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X048","projectTags":["*"],"title":"年底关账前的最后一笔报销被卡","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X049","projectTags":["*"],"title":"未回复的邮件超过了三位数","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X050","projectTags":["*"],"title":"年度总结报告还差三页没写","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X051","projectTags":["*"],"title":"领导要求年前完成所有绩效考核面谈","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X052","projectTags":["*"],"title":"最后一个工作日OA系统计划维护","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X053","projectTags":["*"],"title":"供应商要求在年前结清所有款项","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X054","projectTags":["*"],"title":"年终奖的分配方案引发不满","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X055","projectTags":["*"],"title":"明年的预算模板今天下班前要提交","text":"","speaker":"caiwu_zhou","category":"time_pressure","choices":[]}
{"eventId":"X056","projectTags":["*"],"title":"最后一天还有新人入职需要安排","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X057","projectTags":["*"],"title":"年终礼品清单还没确认","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
```

## monday_morning（周一早会刚结束）— 11 个新事件

```json
{"eventId":"X088","projectTags":["*"],"title":"周末堆积的邮件超过五十封","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X089","projectTags":["*"],"title":"周一早会发现周末出了线上事故","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X090","projectTags":["*"],"title":"本周五的截止日期在早会上被提前","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X091","projectTags":["*"],"title":"周报系统在周一早上崩溃","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X092","projectTags":["*"],"title":"周一早上的全员大会临时改议程","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X093","projectTags":["*"],"title":"周末客户发的需求变更没人看到","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X094","projectTags":["*"],"title":"上周五的会议纪要被质疑不准确","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X095","projectTags":["*"],"title":"周一早上发现办公区空调坏了","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X096","projectTags":["*"],"title":"早会上被分配到不属于自己的任务","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X097","projectTags":["*"],"title":"本周的排期在周一就被塞满了","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X098","projectTags":["*"],"title":"周一早上的合规培训不能请假","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
```

## friday_afternoon（周五下午四点整）— 10 个新事件

```json
{"eventId":"X105","projectTags":["*"],"title":"周五下午的代码部署禁令被无视","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X106","projectTags":["*"],"title":"客户约了周五下班前电话沟通","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X107","projectTags":["*"],"title":"周五团建活动与项目截止日撞车","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X108","projectTags":["*"],"title":"周五下午收到周一的汇报通知","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X109","projectTags":["*"],"title":"周五下班前供应商发来涨价通知","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X110","projectTags":["*"],"title":"周五的审批流卡在最后一个节点","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X111","projectTags":["*"],"title":"同事请假把未完成的工作甩给了你","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X112","projectTags":["*"],"title":"周五下午系统突然变慢影响效率","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X113","projectTags":["*"],"title":"周五例会上被点名下周汇报进度","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X114","projectTags":["*"],"title":"周五下班前财务要求补签所有单据","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
```

## pre_holiday（节前最后半天）— 11 个新事件

```json
{"eventId":"X115","projectTags":["*"],"title":"节前最后一天收到加急需求","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X116","projectTags":["*"],"title":"放假前必须完成的系统安全检查","text":"","speaker":"jishu_azhe","category":"risk_compliance","choices":[]}
{"eventId":"X117","projectTags":["*"],"title":"假期值班表还没排好","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X118","projectTags":["*"],"title":"节前客户要求确认假期联系人","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X119","projectTags":["*"],"title":"放假前领导要求完成下季度规划","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X120","projectTags":["*"],"title":"节前最后半天的全员大扫除通知","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X121","projectTags":["*"],"title":"假期期间的应急预案还没写","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X122","projectTags":["*"],"title":"节前聚餐的预算被财务驳回","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X123","projectTags":["*"],"title":"放假前供应商发来的合同需要节前签","text":"","speaker":"caiwu_zhou","category":"time_pressure","choices":[]}
{"eventId":"X124","projectTags":["*"],"title":"客户想在假期期间安排项目讨论","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X125","projectTags":["*"],"title":"节前最后几个小时的全员邮件","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
```

## new_boss_day（新老板到岗第一天）— 11 个新事件

```json
{"eventId":"X058","projectTags":["*"],"title":"新老板要求重新审查所有在途项目","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X059","projectTags":["*"],"title":"新老板的汇报风格完全不同","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X060","projectTags":["*"],"title":"新老板带了旧部下来接管关键岗位","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X061","projectTags":["*"],"title":"新老板要求每天站会汇报进度","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X062","projectTags":["*"],"title":"新老板对供应商名单提出质疑","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X063","projectTags":["*"],"title":"新老板要重新评估团队人员配置","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X064","projectTags":["*"],"title":"新老板推翻了之前领导批准的方案","text":"","speaker":"lin_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X065","projectTags":["*"],"title":"新老板要求所有流程重新走审批","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X066","projectTags":["*"],"title":"新老板第一天就遇到了系统故障","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
{"eventId":"X067","projectTags":["*"],"title":"新老板要见所有合作方负责人","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X068","projectTags":["*"],"title":"新老板要求用新的项目管理工具","text":"","speaker":"jishu_azhe","category":"time_pressure","choices":[]}
```

## quarterly_review（季度考核截止日）— 11 个新事件

```json
{"eventId":"X126","projectTags":["*"],"title":"季度KPI数据被人质疑统计口径","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X127","projectTags":["*"],"title":"季度考核中的360评估出现恶意差评","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X128","projectTags":["*"],"title":"季度报告中的项目成果被其他部门认领","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X129","projectTags":["*"],"title":"季度末的预算执行率不达标","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X130","projectTags":["*"],"title":"季度考核面谈时间与项目截止日冲突","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X131","projectTags":["*"],"title":"季度考核结果被用来决定裁员名单","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X132","projectTags":["*"],"title":"季度指标的统计口径突然被更改","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
{"eventId":"X133","projectTags":["*"],"title":"季度末发现全年目标还差一大截","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
{"eventId":"X134","projectTags":["*"],"title":"季度考核中发现跨部门协作数据缺失","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X135","projectTags":["*"],"title":"季度末的财务数据与实际有偏差","text":"","speaker":"caiwu_zhou","category":"risk_compliance","choices":[]}
{"eventId":"X136","projectTags":["*"],"title":"季度考核后被要求制定改进计划","text":"","speaker":"lin_zong","category":"time_pressure","choices":[]}
```

## client_calls（甲方突然来电话）— 8 个新事件

```json
{"eventId":"X004","projectTags":["*"],"title":"甲方电话中说"有个小调整"","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X005","projectTags":["*"],"title":"客户打电话投诉项目进度太慢","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X006","projectTags":["*"],"title":"甲方换了一个新的对接人","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X007","projectTags":["*"],"title":"客户在电话里暗示要换供应商","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X008","projectTags":["*"],"title":"甲方打电话要求解释费用明细","text":"","speaker":"caiwu_zhou","category":"budget_conflict","choices":[]}
{"eventId":"X009","projectTags":["*"],"title":"客户电话中说CEO对项目不满意","text":"","speaker":"zhang_zong","category":"satisfaction_mgmt","choices":[]}
{"eventId":"X010","projectTags":["*"],"title":"甲方来电要求派人驻场办公","text":"","speaker":"zhang_zong","category":"time_pressure","choices":[]}
{"eventId":"X011","projectTags":["*"],"title":"电话中客户提出了合同外的要求","text":"","speaker":"hegui_chen","category":"risk_compliance","choices":[]}
```

---

## 事件数汇总

| 主题 | 新增 X 事件 | 保留原事件 | 总计 |
|------|-----------|-----------|------|
| project_kickoff | 12 | 0 | 12 |
| client_adds_requirements | 3 | 9 | 12 |
| leadership_review | 6 | 6 | 12 |
| vendor_failure | 0 | 12 | 12 |
| last_minute_report | 11 | 1 | 12 |
| roadshow_eve | 3 | 9 | 12 |
| annual_report_deadline | 3 | 9 | 12 |
| event_checkin_day | 6 | 6 | 12 |
| regulatory_inquiry | 0 | 14 | 14 |
| post_event_turbulence | 11 | 1 | 12 |
| budget_cut | 6 | 6 | 12 |
| system_launch_day | 2 | 10 | 12 |
| last_working_day | 11 | 1 | 12 |
| monday_morning | 11 | 1 | 12 |
| friday_afternoon | 10 | 2 | 12 |
| pre_holiday | 11 | 1 | 12 |
| new_boss_day | 11 | 1 | 12 |
| quarterly_review | 11 | 1 | 12 |
| client_calls | 8 | 4 | 12 |
| **合计** | **136** | **94** | **230** |
