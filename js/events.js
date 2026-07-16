/**
 * events.js - 事件加载、筛选、随机抽取
 * 负责根据当前状态从事件池中选取合适的事件
 */
const Events = {
  _pool: [],
  _chainMap: {},   // flag → 后续事件列表

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

      candidates.push(ev);
    }

    return candidates;
  },

  /**
   * 优先抽取连锁事件，否则随机抽取普通事件
   * @param {object} state
   * @returns {object|null} 事件对象
   */
  pickEvent(state) {
    // 优先：检查是否有可用的连锁事件
    const chainEvents = this._getChainEvents(state);
    if (chainEvents.length > 0) {
      return chainEvents[Math.floor(Math.random() * chainEvents.length)];
    }

    // 其次：普通可用事件
    const available = this.getAvailable(state);
    if (available.length === 0) return null;

    // 按 followUpWeight 加权随机
    const weighted = [];
    for (const ev of available) {
      const weight = ev.followUpWeight || 1;
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
