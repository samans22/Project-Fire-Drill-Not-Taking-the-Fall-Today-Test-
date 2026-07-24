/**
 * balancer.js - 动态平衡引擎 v2.0
 * 文本池选择、综合评分、动态难度调节、震荡上升曲线
 *
 * 核心公式:
 *   compositeScore = time + budget + satisfaction - risk
 *   时间/预算/满意度上升=有利(+), 风险上升=不利(-)
 */
const Balancer = {
  /** 当前激活的主题文本池 */
  _activePool: [],
  /** 最近 N 次选择的 composite 记录（用于震荡检测） */
  _recentComposites: [],
  _maxRecent: 5,
  /** 连续高/低收益计数器 */
  _streakHigh: 0,
  _streakLow: 0,

  // ========== 主题激活 ==========

  /**
   * 设置当前激活的主题文本池
   * @param {string} themeId - 主题ID
   * @param {object|null} textPoolData - 完整的 text-pool.json 数据
   */
  setTheme(themeId, textPoolData) {
    this._themeId = themeId;
    if (textPoolData && textPoolData.byTheme) {
      // 精确匹配
      if (textPoolData.byTheme[themeId]) {
        this._activePool = textPoolData.byTheme[themeId];
      } else {
        // P2: 模糊匹配回退 — 尝试找包含相同关键词的 theme key
        const candidates = Object.keys(textPoolData.byTheme).filter(key => {
          const short = key.replace(/_/g, '');
          const target = themeId.replace(/_/g, '');
          return short.includes(target) || target.includes(short);
        });
        if (candidates.length === 1) {
          this._activePool = textPoolData.byTheme[candidates[0]];
          console.warn('Balancer: fuzzy-matched theme "' + themeId + '" → "' + candidates[0] + '" (' + this._activePool.length + ' texts)');
        } else if (candidates.length > 1) {
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

  // ========== 综合评分 ==========

  /**
   * 计算效果的综合收益评分
   * time + budget + satisfaction + risk
   * 四个维度直接相加（与 CSV ground truth 一致）
   * 正值 = 整体有利，负值 = 整体不利
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
  getHealthIndex(stats, statsMax) {
    const max = statsMax || { time: 10, budget: 10, satisfaction: 10, risk: 10 };
    return (
      stats.time / max.time +
      stats.budget / max.budget +
      stats.satisfaction / max.satisfaction +
      (max.risk - stats.risk) / max.risk
    ) / 4;
  },

  /**
   * 获取经天数调整后的健康指数
   * Day 1-2: -0.15（新手保护）
   * Day 9-10: +0.10（略微增加难度）
   */
  getAdjustedHealthIndex(stats, day, statsMax) {
    let index = this.getHealthIndex(stats, statsMax);
    if (day <= 2) index -= 0.15;
    else if (day >= 9) index += 0.10;
    return Math.max(0, Math.min(1, index));
  },

  // ========== 状态压力计算 ==========

  /**
   * 计算四维压力向量 [0,1]
   * 1 = 极度紧缺/危险
   */
  calcPressure(stats, statsMax) {
    const max = statsMax || { time: 10, budget: 10, satisfaction: 10, risk: 10 };
    return {
      time:         1 - (stats.time / max.time),
      budget:       1 - (stats.budget / max.budget),
      satisfaction: 1 - (stats.satisfaction / max.satisfaction),
      risk:         stats.risk / max.risk,
    };
  },

  // ========== 文本适配度计算 ==========

  /**
   * 计算文本对当前状态的适配度
   * 玩家缺什么，文本提供什么 → 高适配度
   * risk 取反：降风险(负值)是好事，对高压力玩家价值更高
   */
  calcFitness(text, pressure) {
    return (
      pressure.time         * (text.effects.time || 0) +
      pressure.budget       * (text.effects.budget || 0) +
      pressure.satisfaction * (text.effects.satisfaction || 0) +
      pressure.risk         * (-(text.effects.risk || 0))
    );
  },

  // ========== 健康度 → 目标 composite 映射 ==========

  /**
   * 根据玩家整体健康度，决定应选入多少"有利"/"不利"文本
   * 健康度越低 → 给更有利的文本（高composite = 冒险省资源）
   * 健康度越高 → 给更多挑战文本（低composite = 正规流程消耗资源）
   */
  mapHealthToTarget(health) {
    if (health < 0.25) return 2;   // 濒死 → 给有利选项
    if (health < 0.40) return 1;
    if (health < 0.60) return 0;   // 健康 → 均衡选项
    if (health < 0.80) return -1;
    return -2;                       // 太好 → 给挑战选项
  },

  // ========== 动态文本选择 ==========

  /**
   * 从候选文本池中动态选择 N 条文本
   * 核心：根据玩家状态 → 计算适配度 → 按难度目标筛选 → 随机选取
   *
   * @param {array} candidates - 候选文本数组
   * @param {object} stats - 玩家当前 stats
   * @param {number} day - 当前天数
   * @param {number} count - 需要选择的文本数（默认3）
   * @param {object} statsMax - 最大统计值（可选）
   * @returns {array} 选中的文本数组
   */
  selectTexts(candidates, stats, day, count, statsMax) {
    count = count || 3;
    if (!candidates || candidates.length === 0) return [];
    if (candidates.length <= count) {
      // 候选不足，全部返回（打乱顺序）
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      return shuffled;
    }

    const pressure = this.calcPressure(stats, statsMax);

    // Step 1: 计算健康度 → 确定 composite 目标
    const health = this.getAdjustedHealthIndex(stats, day, statsMax);
    const compositeTarget = this.mapHealthToTarget(health);

    // Step 2: 加天数修正
    // Day 1-3: 轻微倾向负composite（正规流程，建立基础）
    // Day 4-7: 均衡为主
    // Day 8-10: 监测玩家状态，动态调整
    let dayTarget = compositeTarget;
    if (day <= 3) {
      dayTarget = Math.min(compositeTarget + 1, 2); // 早期宽松
    } else if (day >= 8 && health < 0.35) {
      dayTarget = Math.max(compositeTarget, 1); // 后期濒死 → 必须救
    }

    // Step 3: 震荡修正 — 连续3次高/低收益后强制转向
    if (this._streakHigh >= 3) {
      dayTarget = Math.min(dayTarget, -1); // 强制给低收益
    }
    if (this._streakLow >= 3) {
      dayTarget = Math.max(dayTarget, 1); // 强制给高收益
    }

    // Step 4: 计算每条文本的适配度
    const scored = candidates.map(t => ({
      text: t,
      fitness: this.calcFitness(t, pressure),
    }));

    // Step 5: 按 compositeTarget 过滤 + 按 fitness 降序
    let pool = scored.filter(s =>
      Math.abs(s.text.compositeScore - dayTarget) <= 2
    );
    if (pool.length < count) {
      // 过滤后不够，放宽条件
      pool = scored;
    }

    // 按适配度降序排序
    pool.sort((a, b) => b.fitness - a.fitness);

    // Step 6: 从前 2×count 条中随机选 count 条（保证变化性）
    const topN = pool.slice(0, Math.min(count * 2, pool.length));
    this._shuffle(topN);
    const selected = topN.slice(0, count);

    // 返回文本对象
    return selected.map(s => s.text);
  },

  /** Fisher-Yates 洗牌 */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
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
   * 例如: "⏱-2  😊-1  ⚠-2  |  净收益: -1"
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
    return parts.join('  ') + '  |  净收益: ' + sign + composite;
  },

  /**
   * 生成 data-effects 属性值（用于 CSS tooltip）
   * 紧凑格式，一行显示所有effect变化
   */
  getEffectsData(effects) {
    const parts = [];
    for (const [stat, icon] of Object.entries(this._icons)) {
      const val = effects[stat] || 0;
      if (val !== 0) {
        parts.push(icon + (val > 0 ? '+' : '') + val);
      }
    }
    return parts.join('  ') || '无影响';
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
      this._streakHigh = 0;
      this._streakLow = 0;
    }
  },

  /** 获取最近的选择历史（调试用） */
  getRecentHistory() {
    return this._recentComposites.slice();
  },

  // ========== 文本池查找 ==========

  /**
   * 从激活的主题池中查找匹配事件ID的文本
   * @param {string} eventId - 事件ID
   * @returns {array} 匹配的文本数组
   */
  getTextsForEvent(eventId) {
    if (!this._activePool || this._activePool.length === 0) return [];
    return this._activePool.filter(t => {
      // 匹配 eventId（可能包含逗号分隔的多个ID）
      if (!t.eventId) return false;
      const ids = t.eventId.split(',').map(s => s.trim());
      return ids.includes(eventId);
    });
  },

  /**
   * 从旧格式 choice.pool 中动态选择 1 条文本（兼容层）
   * 供 ui.js 旧 pool 处理路径使用
   * @param {array} pool - choice.pool 数组
   * @param {object} stats - 玩家当前 stats
   * @param {number} day - 当前天数
   * @returns {object|null} 选中的文本对象，或 null
   */
  selectFromPool(pool, stats, day) {
    if (!pool || pool.length === 0) return null;
    const results = this.selectTexts(pool, stats, day, 1);
    return results.length > 0 ? results[0] : pool[0];
  },

  /** 重置历史（新游戏开始时调用） */
  reset() {
    this._recentComposites = [];
    this._streakHigh = 0;
    this._streakLow = 0;
    this._activePool = [];
  },
};

// ========== P2: 开发者调试面板 ==========
// 在浏览器 console 中使用: __debugBalancer.status()
window.__debugBalancer = {
  status() {
    console.log('Theme:', Balancer._themeId);
    console.log('Active pool size:', Balancer._activePool.length);
    console.log('Recent composites:', Balancer.getRecentHistory());
    console.log('Streak high/low:', Balancer._streakHigh, Balancer._streakLow);
    if (Balancer._activePool.length > 0) {
      const eventIds = [...new Set(Balancer._activePool.map(t => t.eventId))].filter(Boolean).sort();
      console.log('Covered eventIds (' + eventIds.length + '):', eventIds.join(', '));
    }
  },
  eventCoverage(eventId) {
    const texts = Balancer.getTextsForEvent(eventId);
    console.log('Event ' + eventId + ': ' + texts.length + ' texts in active pool');
    texts.forEach(t => {
      const c = t.compositeScore;
      const sign = c > 0 ? '+' : '';
      console.log('  [' + sign + c + '] ' + t.textId + ': ' + t.text.substring(0, 50) + '...');
    });
  },
  listOrphans() {
    const events = Events._pool;
    const realIds = new Set(events.map(e => e.eventId));
    let count = 0;
    for (const t of Balancer._activePool) {
      const ids = (t.eventId || '').split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0 || ids.every(id => !realIds.has(id))) {
        console.log('ORPHAN: ' + t.textId + ' → "' + t.eventId + '"');
        count++;
      }
    }
    console.log('Total orphans in active pool: ' + count);
  },
};
