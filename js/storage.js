/**
 * storage.js - localStorage 存档管理
 * 负责游戏进度的保存、读取和删除
 */
const Storage = {
  SAVE_KEY: 'fire_drill_save',

  /** 保存游戏状态 */
  save(state) {
    try {
      const data = JSON.stringify(state);
      localStorage.setItem(this.SAVE_KEY, data);
      return true;
    } catch (e) {
      console.warn('存档失败:', e.message);
      return false;
    }
  },

  /** 读取游戏状态，无存档返回 null */
  load() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('读档失败:', e.message);
      return null;
    }
  },

  /** 删除存档 */
  clear() {
    localStorage.removeItem(this.SAVE_KEY);
  },

  /** 是否存在存档 */
  hasSavedGame() {
    return localStorage.getItem(this.SAVE_KEY) !== null;
  }
};
