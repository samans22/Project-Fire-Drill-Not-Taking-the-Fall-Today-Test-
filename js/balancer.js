/**
 * balancer.js - 动态平衡引擎
 * 文本池选择、综合评分、动态难度调节
 */
const Balancer = {
  /** 最近 N 次选择的 composite 记录（用于震荡检测） */
  _recentComposites: [],
  _maxRecent: 5,

  /** 连续高/低收益计数器 */
  _streakHigh: 0,
  _streakLow: 0,

  // ========== 综合评分 ==========

  /**
   * 计算效果的综合收益评分
   * time/budget/satisfaction 增加 = 好，减少 = 坏
   * risk 增加 = 坏，减少 = 好
   */
  computeComposite(effects) {
    return (
      (effects.time || 0) +
      (effects.budget || 0) +
      (effects.satisfaction || 0) -
      (effects.risk || 0)
    );
  },

  // ========== 玩家健康指数 ==========

  /**
   * 计算玩家健康指数 (0 = 濒死, 1 = 全满)
   */
  getHealthIndex(stats) {
    const max = 10;
    return (
      stats.time / max +
      stats.budget / max +
      stats.satisfaction / max +
      (max - stats.risk) / max
    ) / 4;
  },

  /**
   * 获取经天数和震荡调整后的健康指数
   * Day 1-2: -0.15（新手保护，给更简单的选项）
   * Day 9-10: +0.10（略微增加难度）
   */
  getAdjustedHealthIndex(stats, day) {
    let index = this.getHealthIndex(stats);
    if (day <= 2) index -= 0.15;
    else if (day >= 9) index += 0.10;
    return Math.max(0, Math.min(1, index));
  },

  // ========== 效果提示文本 ==========

  /** 图标映射 */
  _icons: {
    time: '⏱',
    budget: '💰',
    satisfaction: '😊',
    risk: '⚠',
  },

  /**
   * 格式化效果为悬浮提示数值行
   * 例如: "⏱-2 😊-1 ⚠-2 | 净收益: -1"
   */
  formatEffectsHint(effects) {
    const parts = [];
    for (const [stat, icon] of Object.entries(this._icons)) {
      const val = effects[stat] || 0;
      if (val !== 0) {
        parts.push(icon + (val > 0 ? '+' : '') + val);
      }
    }
    if (parts.length === 0) return '无影响 | 净收益: 0';
    const composite = this.computeComposite(effects);
    const sign = composite > 0 ? '+' : '';
    return parts.join(' ') + ' | 净收益: ' + sign + composite;
  },

  // ========== 变体生成 ==========

  /**
   * 从原始 effects 自动生成 5 个变体
   * A: 温和版（效果减半向零靠拢）
   * B: 原版
   * C: 极端版（主效果放大，次要缩小）
   * D: 转移版（时间代价转为预算代价）
   * E: 救援版（正向修正，composite 至少为 0）
   */
  generateVariants(baseText, baseFeedback, baseEffects) {
    const variants = [];

    // 识别主要效果（绝对值最大的 stat）
    let mainStat = 'time';
    let maxAbs = 0;
    for (const [stat, val] of Object.entries(baseEffects)) {
      if (Math.abs(val) > maxAbs) {
        maxAbs = Math.abs(val);
        mainStat = stat;
      }
    }

    // --- Variant A: 温和版（所有效果向零减半）---
    const mildEffects = {};
    for (const [stat, val] of Object.entries(baseEffects)) {
      if (val > 0) {
        mildEffects[stat] = Math.max(1, Math.floor(val / 2));
      } else if (val < 0) {
        mildEffects[stat] = Math.ceil(val / 2);  // -1→0, -2→-1, -3→-1
      } else {
        mildEffects[stat] = 0;
      }
    }
    variants.push({
      text: baseText,
      effects: mildEffects,
      feedback: baseFeedback,
      composite: this.computeComposite(mildEffects),
    });

    // --- Variant B: 原版 ---
    const origEffects = { ...baseEffects };
    variants.push({
      text: baseText,
      effects: origEffects,
      feedback: baseFeedback,
      composite: this.computeComposite(origEffects),
    });

    // --- Variant C: 极端版（主效果放大，次要缩小）---
    const extremeEffects = {};
    for (const [stat, val] of Object.entries(baseEffects)) {
      if (stat === mainStat) {
        extremeEffects[stat] = val > 0
          ? Math.min(3, Math.ceil(val * 1.5))
          : Math.max(-3, Math.floor(val * 1.5));
      } else if (Math.abs(val) <= 1) {
        extremeEffects[stat] = 0;
      } else {
        extremeEffects[stat] = val;
      }
    }
    variants.push({
      text: baseText,
      effects: extremeEffects,
      feedback: baseFeedback,
      composite: this.computeComposite(extremeEffects),
    });

    // --- Variant D: 转移版（代价重分配，增加预算/满意度参与）---
    const shiftedEffects = {};
    for (const [stat, val] of Object.entries(baseEffects)) {
      shiftedEffects[stat] = val;
    }
    // 将主要 stat 的代价减半，转移到 budget 或 satisfaction
    const mainVal = shiftedEffects[mainStat] || 0;
    if (mainVal < 0) {
      const relief = Math.ceil(Math.abs(mainVal) / 2);
      shiftedEffects[mainStat] = mainVal + relief;
      // 优先转移到 budget，其次 satisfaction
      if ((shiftedEffects.budget || 0) === 0) {
        shiftedEffects.budget = -relief;
      } else {
        shiftedEffects.budget = (shiftedEffects.budget || 0) - Math.ceil(relief / 2);
        shiftedEffects.satisfaction = (shiftedEffects.satisfaction || 0) - Math.floor(relief / 2);
      }
    } else if ((shiftedEffects.budget || 0) === 0) {
      // 即使主效果非负，也确保 budget 参与
      shiftedEffects.budget = -1;
      shiftedEffects.satisfaction = (shiftedEffects.satisfaction || 0) + 1;
    }
    // 强制 budget 不为 0
    if (!shiftedEffects.budget || shiftedEffects.budget === 0) {
      shiftedEffects.budget = -1;
    }
    variants.push({
      text: baseText,
      effects: shiftedEffects,
      feedback: baseFeedback,
      composite: this.computeComposite(shiftedEffects),
    });

    // --- Variant E: 救援版（正向修正，composite >= 0）---
    const rescueEffects = {};
    for (const [stat, val] of Object.entries(baseEffects)) {
      if (val < 0) {
        rescueEffects[stat] = Math.ceil(val / 2);
      } else if (val > 0) {
        rescueEffects[stat] = val;
      } else {
        rescueEffects[stat] = 0;
      }
    }
    // 额外正向效果：优先满意度，其次分散到 budget
    rescueEffects.satisfaction = (rescueEffects.satisfaction || 0) + 1;
    if ((rescueEffects.budget || 0) === 0) {
      rescueEffects.budget = 1;
    }
    // 如果 composite 仍为负，再加风险降低
    if (this.computeComposite(rescueEffects) < 0) {
      rescueEffects.risk = (rescueEffects.risk || 0) - 1;
    }
    variants.push({
      text: baseText,
      effects: rescueEffects,
      feedback: baseFeedback,
      composite: this.computeComposite(rescueEffects),
    });

    return variants;
  },

  // ========== 动态选择 ==========

  /**
   * 从文本池中选择一个变体
   * @param {array} pool - 变体数组 [{text, effects, feedback, composite}, ...]
   * @param {object} stats - 玩家当前 stats
   * @param {number} day - 当前天数
   * @returns {object} 选中的变体
   */
  selectFromPool(pool, stats, day) {
    if (!pool || pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    // 确保每个变体都有 composite
    for (const v of pool) {
      if (v.composite === undefined) {
        v.composite = this.computeComposite(v.effects);
      }
    }

    // 按 composite 降序排序
    const sorted = [...pool].sort((a, b) => b.composite - a.composite);

    // 分为三档
    const n = sorted.length;
    const highCut = Math.max(1, Math.ceil(n * 0.4));
    const midCut = Math.max(highCut + 1, Math.ceil(n * 0.7));

    const highTier = sorted.slice(0, highCut);       // top 40%
    const midTier = sorted.slice(highCut, midCut);    // mid 30%
    const lowTier = sorted.slice(midCut);              // bottom 30%

    // 获取调整后的健康指数
    const health = this.getAdjustedHealthIndex(stats, day);

    // 根据健康指数决定各档概率
    let highProb, midProb, lowProb;

    if (health < 0.35) {
      // 危险区：偏向高收益
      highProb = 0.60; midProb = 0.30; lowProb = 0.10;
    } else if (health < 0.65) {
      // 平衡区：均匀分布
      highProb = 0.40; midProb = 0.35; lowProb = 0.25;
    } else {
      // 舒适区：偏向低收益（挑战）
      highProb = 0.20; midProb = 0.35; lowProb = 0.45;
    }

    // 震荡修正：连续 3 次高收益 → 强制降档
    if (this._streakHigh >= 3) {
      highProb = 0;
      midProb = 0.6;
      lowProb = 0.4;
    }
    // 震荡修正：连续 3 次低收益 → 强制升档
    if (this._streakLow >= 3) {
      highProb = 0.6;
      midProb = 0.4;
      lowProb = 0;
    }

    // 按概率选档
    const roll = Math.random();
    let picked;
    if (roll < highProb && highTier.length > 0) {
      picked = highTier[Math.floor(Math.random() * highTier.length)];
    } else if (roll < highProb + midProb && midTier.length > 0) {
      picked = midTier[Math.floor(Math.random() * midTier.length)];
    } else if (lowTier.length > 0) {
      picked = lowTier[Math.floor(Math.random() * lowTier.length)];
    } else {
      // fallback
      picked = sorted[0];
    }

    return picked;
  },

  // ========== 历史追踪 ==========

  /**
   * 记录一次选择（用于震荡检测）
   */
  recordSelection(composite) {
    this._recentComposites.push(composite);
    if (this._recentComposites.length > this._maxRecent) {
      this._recentComposites.shift();
    }

    // 更新连续计数器
    if (composite > 0) {
      this._streakHigh++;
      this._streakLow = 0;
    } else if (composite < 0) {
      this._streakLow++;
      this._streakHigh = 0;
    } else {
      // composite === 0: 重置两者
      this._streakHigh = 0;
      this._streakLow = 0;
    }
  },

  /** 获取最近的选择历史（调试用） */
  getRecentHistory() {
    return this._recentComposites.slice();
  },

  // ========== 事件初始化 ==========

  /**
   * 为事件池中的所有 choice 自动生成变体池
   * 已有 pool 的 choice 跳过（手写变体优先）
   * 在 Events.load() 后调用
   * @param {array} events - 完整事件数组
   */
  initEvents(events) {
    let generated = 0;
    for (const ev of events) {
      if (!ev.choices) continue;
      for (const ch of ev.choices) {
        // 已有手写 pool 则跳过
        if (ch.pool && ch.pool.length > 0) {
          // 为手写 pool 补全 composite
          for (const v of ch.pool) {
            if (v.composite === undefined) {
              v.composite = this.computeComposite(v.effects);
            }
          }
          continue;
        }
        // 自动生成变体
        ch.pool = this.generateVariants(
          ch.text,
          ch.feedback,
          ch.effects || {}
        );
        generated++;
      }
    }
    return generated;
  },

  /** 重置历史（新游戏开始时调用） */
  reset() {
    this._recentComposites = [];
    this._streakHigh = 0;
    this._streakLow = 0;
  },
};
