/**
 * game.js - 核心游戏状态与逻辑
 * 管理四项数值、标记、游戏进程、结局判定
 */
const Game = {
  // ---------- 初始状态 ----------
  createInitialState(project) {
    return {
      project: project,                    // 当前项目包对象
      theme: null,                         // 当日主题（字符串）
      day: 1,                              // 当前天数
      maxDays: 10,                         // 最大天数
      stats: {
        time: 10,                          // 时间（0=延期）
        budget: 10,                        // 预算（负=审查）
        satisfaction: 10,                  // 客户满意度（0=换人）
        risk: 0                            // 风险值（上限10=翻车）
      },
      statsMax: { time: 10, budget: 10, satisfaction: 10, risk: 10 },
      flags: [],                           // 全局状态标记
      eventHistory: [],                    // 已触发的事件ID列表
      choiceHistory: [],                   // 选择记录
      usedEvents: [],                      // 本轮已用事件ID（防止重复）
      eventsToday: 0,                      // 今日已处理事件数
      eventsPerDay: 3,                     // 每日事件配额
      difficultyTier: 1,                   // 当前难度层级（1-4）
      pendingNextEventId: null,            // 多阶段事件：待显示的下一阶段事件ID
      phase: 'playing',                    // 'playing' | 'ended'
    };
  },

  // ---------- 统计值修改 ----------
  applyEffects(state, effects) {
    const s = state.stats;
    s.time        = Math.max(0, Math.min(state.statsMax.time, s.time + (effects.time || 0)));
    s.budget      = Math.max(0, Math.min(state.statsMax.budget, s.budget + (effects.budget || 0)));
    s.satisfaction = Math.max(0, Math.min(state.statsMax.satisfaction, s.satisfaction + (effects.satisfaction || 0)));
    s.risk        = Math.max(0, Math.min(state.statsMax.risk, s.risk + (effects.risk || 0)));
  },

  // ---------- 设置标记 ----------
  setFlags(state, flags) {
    if (!flags) return;
    flags.forEach(f => {
      if (!state.flags.includes(f)) state.flags.push(f);
    });
  },

  // ---------- 执行选择 ----------
  executeChoice(state, event, choiceIndex) {
    const choice = event.choices[choiceIndex];
    if (!choice) return null;

    // P3: 使用预解析的效果（概率 + 隐藏已合并），回退到原始 effects
    let effects = choice._resolvedEffects
      ? { ...choice._resolvedEffects }
      : { ...choice.effects };

    // P3: 应用随机事件修饰
    if (event._modifier) {
      effects = Balancer.applyModifierToEffects(effects, event._modifier);
    }

    this.applyEffects(state, effects);
    this.setFlags(state, choice.setsFlags);

    // P3: 概率失败时使用 failureFeedback
    let feedback = choice.feedback;
    const probResult = choice._resolvedEffects?._probResult || null;
    if (probResult === 'failure' && choice.failureFeedback) {
      feedback = choice.failureFeedback;
    }

    const record = {
      eventId: event.eventId,
      eventTitle: event.title,
      choiceIndex,
      choiceText: choice.text,
      feedback: feedback,
      effects: effects,
      nextEventId: choice.nextEvent || null,
      newStats: { ...state.stats }
    };
    state.choiceHistory.push(record);
    state.usedEvents.push(event.eventId);
    state.eventsToday++;

    return record;
  },

  // ---------- 检查结局条件 ----------
  checkEnding(state, endings) {
    const s = state.stats;

    // 致命条件：时间归零
    if (s.time <= 0) {
      return endings.find(e => e.id === 'project_delayed') || endings.find(e => e.condition?.default);
    }
    // 致命条件：满意度归零
    if (s.satisfaction <= 0) {
      return endings.find(e => e.id === 'client_lost') || endings.find(e => e.condition?.default);
    }
    // 致命条件：风险爆表
    if (s.risk >= state.statsMax.risk) {
      return endings.find(e => e.id === 'compliance_blocked') || endings.find(e => e.condition?.default);
    }

    // 通关条件：达到最大天数
    if (state.day >= state.maxDays) {
      return this.pickBestEnding(state, endings);
    }

    return null; // 游戏继续
  },

  /** 根据状态匹配最佳结局 */
  pickBestEnding(state, endings) {
    const s = state.stats;
    let bestScore = -1;
    let bestEnding = null;
    const defaults = endings.filter(e => e.condition?.default);

    for (const ending of endings) {
      if (ending.condition?.default) continue;
      const c = ending.condition || {};
      let score = 0;
      let match = true;

      if (c.time_min !== undefined && s.time < c.time_min) match = false;
      if (c.time_max !== undefined && s.time > c.time_max) match = false;
      if (c.budget_min !== undefined && s.budget < c.budget_min) match = false;
      if (c.budget_max !== undefined && s.budget > c.budget_max) match = false;
      if (c.satisfaction_min !== undefined && s.satisfaction < c.satisfaction_min) match = false;
      if (c.satisfaction_max !== undefined && s.satisfaction > c.satisfaction_max) match = false;
      if (c.risk_min !== undefined && s.risk < c.risk_min) match = false;
      if (c.risk_max !== undefined && s.risk > c.risk_max) match = false;

      if (c.flags_include) {
        for (const f of c.flags_include) {
          if (!state.flags.includes(f)) match = false;
        }
      }
      if (c.flags_exclude) {
        for (const f of c.flags_exclude) {
          if (state.flags.includes(f)) match = false;
        }
      }

      if (match) {
        score = s.time + s.budget + s.satisfaction - s.risk;
        if (score > bestScore) {
          bestScore = score;
          bestEnding = ending;
        }
      }
    }

    return bestEnding || defaults[0] || null;
  },

  // ---------- 推进天数 ----------
  advanceDay(state) {
    state.day++;
    state.eventsToday = 0;
    // 根据天数更新难度层级
    if (state.day <= 3) state.difficultyTier = 1;
    else if (state.day <= 6) state.difficultyTier = 2;
    else if (state.day <= 9) state.difficultyTier = 3;
    else state.difficultyTier = 4;
  },

  // ---------- 获取健康度颜色等级 ----------
  getHealthLevel(value, max) {
    const ratio = value / max;
    if (ratio >= 0.7) return 'green';
    if (ratio >= 0.4) return 'yellow';
    return 'red';
  }
};
