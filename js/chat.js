/**
 * chat.js - NPC 群聊消息系统
 * 在关键节点注入 NPC 氛围消息，让群聊从被动记录器变为主动叙事通道
 */
const ChatMessages = {
  /** 消息池 */
  _pools: {
    dayStart: [
      { speaker: 'caiwu_zhou', text: '今天的OA系统正常，前天的报销已经批了。' },
      { speaker: 'jishu_zhe', text: '早上部署了新版本，如果有人看到报错截图发我。' },
      { speaker: 'hegui_chen', text: '本周合规自查表请各位今天下班前填写。' },
      { speaker: 'shixi_xu', text: '早上好！今天的会议室我预定了3号。' },
      { speaker: 'gongying_wang', text: '物料已经发货了，单号在群里，大家查收。' },
      { speaker: 'shenmi_qun', text: '【群公告】本周五前请确认最终交付清单。' },
      { speaker: 'lin_zong', text: '昨天的日报我看了，今天抓紧推进。' },
      { speaker: 'zhang_zong', text: '早上发的版本我看了，方向对，继续。' },
    ],

    dayEnd: [
      { speaker: 'caiwu_zhou', text: '今天没有需要紧急处理的报销单。' },
      { speaker: 'jishu_zhe', text: '服务器日志正常，今天可以准时下班。' },
      { speaker: 'shixi_xu', text: '今天学会了用VLOOKUP！谢谢大家！' },
      { speaker: 'hegui_chen', text: '今天提交的材料都合规，辛苦了。' },
    ],

    statWarning: {
      time: [
        { speaker: 'lin_zong', text: '时间节点我看了一下，进度需要加把劲。' },
        { speaker: 'zhang_zong', text: '交付日期没有问题吧？我这边有人在问了。' },
        { speaker: 'lin_zong', text: '时间不多了，大家优先级调整一下。' },
      ],
      budget: [
        { speaker: 'caiwu_zhou', text: '预算预警：目前的支出进度比计划快了。' },
        { speaker: 'caiwu_zhou', text: '看了一下账，这个月的预算有点吃紧。' },
      ],
      satisfaction: [
        { speaker: 'zhang_zong', text: '最近几次沟通，我觉得有些地方可以改进。' },
        { speaker: 'shenmi_qun', text: '@所有人 客户满意度问卷请认真填写。' },
      ],
      risk: [
        { speaker: 'hegui_chen', text: '风险提示：最近监管口径有变化，大家注意。' },
        { speaker: 'hegui_chen', text: '上次抽查的结果出来了，有几个点需要整改。' },
        { speaker: 'gongying_wang', text: '听说隔壁项目出了合规问题，你们注意点。' },
      ],
    },

    statBlessing: {
      time: [
        { speaker: 'lin_zong', text: '进度我看可以，继续保持。' },
      ],
      budget: [
        { speaker: 'caiwu_zhou', text: '预算控制得很好，年度考核有加分。' },
      ],
      satisfaction: [
        { speaker: 'zhang_zong', text: '最近的服务很满意，我向领导推荐了你们。' },
      ],
      risk: [
        { speaker: 'hegui_chen', text: '目前没有合规问题，继续保持这个标准。' },
      ],
    },

    dayAmbient: {
      '1-3': [
        { speaker: 'shixi_xu', text: '大家好我是新来的实习生小许！请多关照~' },
        { speaker: 'jishu_zhe', text: '开发环境已经搭好了，有需要找我。' },
      ],
      '4-6': [
        { speaker: 'jishu_zhe', text: 'OA系统最近有点慢，我周末看看能不能优化。' },
        { speaker: 'caiwu_zhou', text: '中期预算review的表格我发群里了。' },
      ],
      '7-9': [
        { speaker: 'lin_zong', text: '这个项目的截止日期不能再推迟了。' },
        { speaker: 'hegui_chen', text: '终期合规审查下周开始，请提前准备。' },
      ],
      '10': [
        { speaker: 'lin_zong', text: '今天是最后一天，不管结果如何，辛苦了。' },
        { speaker: 'zhang_zong', text: '这个项目做完我请大家吃饭。' },
      ],
    },

    eventReaction: {
      'E007': [
        { speaker: 'shixi_xu', text: '对不起！下次我一定仔细检查！' },
        { speaker: 'lin_zong', text: '邮件发出去之前多看一眼，不要急。' },
      ],
      'E009': [
        { speaker: 'hegui_chen', text: '谢谢配合修改，合规无小事。' },
      ],
      'E011': [
        { speaker: 'shenmi_qun', text: '【群消息】有人在吗？' },
      ],
      'E018': [
        { speaker: 'jishu_zhe', text: '我就说那个技术债迟早要还的……' },
      ],
      'E026': [
        { speaker: 'shixi_xu', text: '天哪我是不是填反了……我马上改！' },
      ],
    },
  },

  /** 获取每日开始消息（1-2条随机） */
  getDayStart() {
    const count = 1 + Math.floor(Math.random() * 2);
    return this._pickRandom(this._pools.dayStart, count);
  },

  /** 获取每日结束消息（1条随机） */
  getDayEnd() {
    return this._pickRandom(this._pools.dayEnd, 1);
  },

  /** 获取基于当日天数的氛围消息 */
  getDayAmbient(day) {
    let range = '1-3';
    if (day <= 3) range = '1-3';
    else if (day <= 6) range = '4-6';
    else if (day <= 9) range = '7-9';
    else range = '10';
    return this._pickRandom(this._pools.dayAmbient[range] || [], 1);
  },

  /** 获取状态预警消息 */
  getStatWarnings(stats, statsMax) {
    const msgs = [];
    if (stats.time / statsMax.time < 0.4) {
      msgs.push(...this._pickRandom(this._pools.statWarning.time, 1));
    }
    if (stats.budget / statsMax.budget < 0.4) {
      msgs.push(...this._pickRandom(this._pools.statWarning.budget, 1));
    }
    if (stats.satisfaction / statsMax.satisfaction < 0.4) {
      msgs.push(...this._pickRandom(this._pools.statWarning.satisfaction, 1));
    }
    if (stats.risk / statsMax.risk >= 0.6) {
      msgs.push(...this._pickRandom(this._pools.statWarning.risk, 1));
    }
    return msgs;
  },

  /** 获取随机"事件之间"的氛围消息（40%概率） */
  getBetweenEvent() {
    if (Math.random() > 0.4) return [];
    return this._pickRandom(this._pools.dayStart, 1);
  },

  /** 获取对特定事件被触发的反应消息 */
  getEventReaction(eventId) {
    const reactions = this._pools.eventReaction[eventId];
    if (!reactions) return [];
    return this._pickRandom(reactions, 1);
  },

  /** 从池中随机选取 count 条不重复消息 */
  _pickRandom(pool, count) {
    if (!pool || pool.length === 0) return [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, pool.length));
  },
};
