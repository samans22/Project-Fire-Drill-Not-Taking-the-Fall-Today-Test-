/**
 * events.js - 事件加载、筛选、随机抽取
 * 负责根据当前状态从事件池中选取合适的事件
 */
const Events = {
  _pool: [],
  _chainMap: {},     // flag → 后续事件列表
  _themeMap: {},     // themeId → theme 对象（用于加权和覆写）
  _textPoolData: null, // 文本池数据（按 themeId 索引）

  /** 加载事件 JSON */
  async load() {
    try {
      const res = await fetch('js/data/events.json');
      this._pool = await res.json();
      this._buildChainMap();
      return this._pool.length;
    } catch (e) {
      console.error('事件数据加载失败:', e);
      return 0;
    }
  },

  /** 加载文本池 JSON（供 balancer.js 使用） */
  async loadTextPool() {
    try {
      const res = await fetch('js/data/text-pool.json');
      this._textPoolData = await res.json();
      return this._textPoolData._total || 0;
    } catch (e) {
      console.error('文本池加载失败:', e);
      this._textPoolData = null;
      return 0;
    }
  },

  /** 获取当前主题的文本池数据 */
  getTextPoolData() {
    return this._textPoolData;
  },

  /** 加载主题数据（用于加权抽取和文本覆写） */
  loadThemes(themes) {
    this._themeMap = {};
    for (const t of themes) {
      if (t.id) this._themeMap[t.id] = t;
    }
  },

  /** 按ID查找事件（用于多阶段 nextEvent 解析） */
  getEventById(eventId) {
    return this._pool.find(ev => ev.eventId === eventId) || null;
  },

  /** 构建连锁事件映射表 */
  _buildChainMap() {
    this._chainMap = {};
    for (const ev of this._pool) {
      if (ev.requires) {
        for (const req of ev.requires) {
          if (!this._chainMap[req]) this._chainMap[req] = [];
          this._chainMap[req].push(ev);
        }
      }
    }
  },

  /**
   * 获取可用于当前状态的事件列表
   * @param {object} state - 当前游戏状态
   * @returns {array} 可用事件
   */
  getAvailable(state) {
    const candidates = [];

    for (const ev of this._pool) {
      // 本轮已用过
      if (state.usedEvents.includes(ev.eventId)) continue;

      // 多阶段后续事件：只能通过 nextEvent 访问，不进入随机池
      if (ev.isChainOnly) continue;

      // 项目标签匹配：* 匹配所有，否则至少一个 tag 匹配
      if (!ev.projectTags.includes('*')) {
        const projectTags = state.project.tags || [];
        const hasMatch = ev.projectTags.some(t => projectTags.includes(t));
        if (!hasMatch) continue;
      }

      // 前置条件
      if (ev.requires) {
        const allMet = ev.requires.every(r => state.flags.includes(r));
        if (!allMet) continue;
      }

      // 难度过滤：只出 <= 当前难度层级的事件
      if (ev.difficulty && ev.difficulty > state.difficultyTier) continue;

      // 主题独家事件：只有当前主题匹配时才可用
      if (ev.themeExclusive && ev.themeExclusive !== state.themeId) continue;

      candidates.push(ev);
    }

    return candidates;
  },

  /**
   * 获取当前主题对象
   * @param {object} state
   * @returns {object|null} 主题对象
   */
  _getTheme(state) {
    if (!state.themeId) return null;
    return this._themeMap[state.themeId] || null;
  },

  /**
   * 应用主题文本覆写
   * 如果当前主题对该事件有自定义文本，覆写 title/text
   * @param {object} event - 事件对象
   * @param {object} theme - 主题对象
   * @returns {object} 覆写后的事件对象（浅拷贝）
   */
  _applyTextOverrides(event, theme) {
    if (!theme || !theme.textOverrides) return event;
    const overrides = theme.textOverrides[event.eventId];
    if (!overrides) return event;

    // 浅拷贝事件，覆写指定字段
    const modified = Object.assign({}, event);
    if (overrides.title) modified.title = overrides.title;
    if (overrides.text) modified.text = overrides.text;
    // 也可以覆写单个选项的 feedback
    if (overrides.choices) {
      modified.choices = event.choices.map((ch, i) => {
        if (overrides.choices[i]) {
          return Object.assign({}, ch, overrides.choices[i]);
        }
        return ch;
      });
    }
    return modified;
  },

  /**
   * 优先抽取连锁事件，其次按主题加权抽取普通事件
   * @param {object} state
   * @returns {object|null} 事件对象（已应用文本覆写）
   */
  pickEvent(state) {
    // 优先：检查是否有可用的连锁事件
    const chainEvents = this._getChainEvents(state);
    if (chainEvents.length > 0) {
      const picked = chainEvents[Math.floor(Math.random() * chainEvents.length)];
      const theme = this._getTheme(state);
      return this._applyTextOverrides(picked, theme);
    }

    // 其次：普通可用事件
    const available = this.getAvailable(state);
    if (available.length === 0) return null;

    // 主题加权抽取
    const theme = this._getTheme(state);
    const picked = this._themeWeightedPick(available, theme);

    // 应用文本覆写
    if (theme) {
      return this._applyTextOverrides(picked, theme);
    }
    return picked;
  },

  /**
   * 主题加权随机抽取
   * 70% 概率从主题 boosted 事件中抽取，30% 从通用池抽取
   * @param {array} available - 所有可用事件
   * @param {object|null} theme - 当前主题对象
   * @returns {object} 事件对象
   */
  _themeWeightedPick(available, theme) {
    // 无主题或主题无事件池 → 纯加权随机
    if (!theme || !theme.eventPool || !theme.eventPool.boosted) {
      return this._weightedRandom(available);
    }

    const boostedIds = theme.eventPool.boosted || [];
    const boostWeight = theme.eventPool.boostWeight || 3;

    // 分离 boosted 和 general 池
    const boostedPool = available.filter(ev => boostedIds.includes(ev.eventId));
    const generalPool = available.filter(ev => !boostedIds.includes(ev.eventId));

    // boosted 为空 → 全部从 general 抽取
    if (boostedPool.length === 0) {
      return this._weightedRandom(generalPool.length > 0 ? generalPool : available);
    }

    // general 为空 → 全部从 boosted 抽取
    if (generalPool.length === 0) {
      return this._weightedRandom(boostedPool);
    }

    // 70% 概率从 boosted 池抽取，30% 从 general 池抽取
    const roll = Math.random();
    if (roll < 0.7) {
      return this._weightedRandom(boostedPool, boostWeight);
    } else {
      return this._weightedRandom(generalPool);
    }
  },

  /**
   * 按权重加权随机抽取
   * @param {array} pool - 候选事件列表
   * @param {number} extraWeight - 额外权重倍数（用于 boosted 事件）
   * @returns {object} 事件对象
   */
  _weightedRandom(pool, extraWeight) {
    const weighted = [];
    for (const ev of pool) {
      const baseWeight = ev.followUpWeight || 1;
      const weight = extraWeight ? baseWeight * extraWeight : baseWeight;
      for (let i = 0; i < weight; i++) weighted.push(ev);
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  },

  /** 获取连锁事件 */
  _getChainEvents(state) {
    const result = [];
    for (const flag of state.flags) {
      const chain = this._chainMap[flag];
      if (chain) {
        for (const ev of chain) {
          if (!state.usedEvents.includes(ev.eventId)) {
            result.push(ev);
          }
        }
      }
    }
    return result;
  },

  /** 按分类统计事件数量 */
  countByCategory() {
    const map = {};
    for (const ev of this._pool) {
      map[ev.category] = (map[ev.category] || 0) + 1;
    }
    return map;
  }
};
