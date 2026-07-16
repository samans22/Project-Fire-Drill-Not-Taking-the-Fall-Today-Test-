/**
 * ui.js - UI 渲染模块
 * 负责所有 DOM 操作和界面更新
 */
const UI = {
  // ---------- DOM 引用缓存 ----------
  _cache: {},

  /** 初始化 DOM 引用 */
  init() {
    this._cache = {
      projectName:       document.getElementById('project-name'),
      projectSubtitle:   document.getElementById('project-subtitle'),
      themeText:         document.getElementById('theme-text'),
      dayNum:            document.getElementById('day-num'),
      statTime:          document.getElementById('stat-time'),
      statBudget:        document.getElementById('stat-budget'),
      statSatisfaction:  document.getElementById('stat-satisfaction'),
      statRisk:          document.getElementById('stat-risk'),
      timeFill:          document.getElementById('time-fill'),
      budgetFill:        document.getElementById('budget-fill'),
      satisfactionFill:  document.getElementById('satisfaction-fill'),
      riskFill:          document.getElementById('risk-fill'),
      eventCard:         document.getElementById('event-card'),
      eventTitle:        document.getElementById('event-title'),
      eventSpeaker:      document.getElementById('event-speaker'),
      eventSpeakerAvatar: document.getElementById('event-speaker-avatar'),
      eventText:         document.getElementById('event-text'),
      choicesContainer:  document.getElementById('choices-container'),
      feedbackArea:      document.getElementById('feedback-area'),
      feedbackText:      document.getElementById('feedback-text'),
      chatList:          document.getElementById('chat-list'),
      fileEasterEgg:     document.getElementById('file-easter-egg'),
      endingOverlay:     document.getElementById('ending-overlay'),
      endingTitle:       document.getElementById('ending-title'),
      endingText:        document.getElementById('ending-text'),
      endingTag:         document.getElementById('ending-tag'),
      endingSummary:     document.getElementById('ending-summary'),
      btnNewGame:        document.getElementById('btn-new-game'),
      btnContinue:       document.getElementById('btn-continue'),
      btnStartNew:       document.getElementById('btn-start-new'),
      btnStartContinue:  document.getElementById('btn-start-continue'),
      startOverlay:      document.getElementById('start-overlay'),
      saveIndicator:     document.getElementById('save-indicator'),
    };
  },

  // ---------- 渲染数值条 ----------
  updateStats(stats, statsMax) {
    const items = [
      { el: this._cache.statTime, fill: this._cache.timeFill, val: stats.time, max: statsMax.time },
      { el: this._cache.statBudget, fill: this._cache.budgetFill, val: stats.budget, max: statsMax.budget },
      { el: this._cache.statSatisfaction, fill: this._cache.satisfactionFill, val: stats.satisfaction, max: statsMax.satisfaction },
      { el: this._cache.statRisk, fill: this._cache.riskFill, val: stats.risk, max: statsMax.risk, reverse: true },
    ];

    for (const item of items) {
      const pct = Math.round((item.val / item.max) * 100);
      if (item.el) item.el.textContent = item.val;
      if (item.fill) {
        item.fill.style.width = pct + '%';
        const level = Game.getHealthLevel(item.val, item.max);
        item.fill.className = 'bar-fill ' + level + (item.reverse ? ' reverse' : '');
      }
    }
  },

  // ---------- 渲染事件卡片 ----------
  showEvent(event, characters) {
    const card = this._cache.eventCard;
    card.style.display = 'block';
    this._cache.feedbackArea.style.display = 'none';
    this._cache.eventTitle.textContent = event.title;

    const speaker = characters.find(c => c.id === event.speaker) || {};
    this._cache.eventSpeaker.textContent = speaker.name || '系统通知';
    this._cache.eventSpeakerAvatar.textContent = speaker.avatar || '📌';
    this._cache.eventText.textContent = event.text;

    // 渲染选项按钮
    const container = this._cache.choicesContainer;
    container.innerHTML = '';
    event.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = `${String.fromCharCode(65 + i)}. ${choice.text}`;
      btn.addEventListener('click', () => {
        if (typeof onChoiceSelected === 'function') {
          onChoiceSelected(i);
        }
      });
      container.appendChild(btn);
    });
  },

  // ---------- 显示反馈 ----------
  showFeedback(feedback, effects) {
    this._cache.feedbackArea.style.display = 'block';
    this._cache.feedbackText.textContent = feedback;

    // 禁用选项按钮
    const btns = this._cache.choicesContainer.querySelectorAll('.choice-btn');
    btns.forEach(b => b.disabled = true);

    // 显示效果标签
    const effectsStr = [];
    if (effects.time !== 0) effectsStr.push(`时间 ${effects.time > 0 ? '+' : ''}${effects.time}`);
    if (effects.budget !== 0) effectsStr.push(`预算 ${effects.budget > 0 ? '+' : ''}${effects.budget}`);
    if (effects.satisfaction !== 0) effectsStr.push(`满意度 ${effects.satisfaction > 0 ? '+' : ''}${effects.satisfaction}`);
    if (effects.risk !== 0) effectsStr.push(`风险 ${effects.risk > 0 ? '+' : ''}${effects.risk}`);

    // 短暂延迟后可以继续
  },

  // ---------- 添加群聊消息 ----------
  addChatMessage(speaker, text) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="chat-speaker">${speaker}:</span> ${text}`;
    this._cache.chatList.appendChild(msg);
    this._cache.chatList.scrollTop = this._cache.chatList.scrollHeight;
  },

  // ---------- 更新彩蛋文件名 ----------
  updateFileEasterEgg() {
    const eggs = [
      '最终版.pptx',
      '最终版_修改后.pptx',
      '最终版_真的不改了.pptx',
      '最终版_领导已看_客户未看.pptx',
      '最终版_改了颜色.pptx',
      '最终版_CEO已阅.pptx',
      '最终版_最终.pptx',
      '最终版_死也不改了.pptx',
    ];
    const egg = eggs[Math.floor(Math.random() * eggs.length)];
    this._cache.fileEasterEgg.textContent = '📎 ' + egg;
  },

  // ---------- 开始界面 ----------
  showStartScreen(hasSavedGame) {
    this._cache.startOverlay.style.display = 'flex';
    this._cache.btnStartContinue.style.display = hasSavedGame ? 'inline-block' : 'none';
  },

  hideStartScreen() {
    this._cache.startOverlay.style.display = 'none';
  },

  // ---------- 结局界面 ----------
  showEnding(ending, state) {
    this._cache.endingOverlay.style.display = 'flex';
    this._cache.endingTitle.textContent = ending.title;
    this._cache.endingText.textContent = ending.text;
    this._cache.endingTag.textContent = ending.tag || '';

    // 生成统计摘要
    const h = state.choiceHistory;
    const summary = [
      `📅 历时 ${state.day} 天`,
      `📋 处理事件 ${h.length} 件`,
      `⏱️ 剩余时间 ${state.stats.time}`,
      `💰 剩余预算 ${state.stats.budget}`,
      `😊 满意度 ${state.stats.satisfaction}`,
      `⚠️ 风险值 ${state.stats.risk}`,
    ].join('  ·  ');
    this._cache.endingSummary.textContent = summary;
  },

  hideEnding() {
    this._cache.endingOverlay.style.display = 'none';
  },

  // ---------- 更新顶部信息 ----------
  updateHeader(state) {
    this._cache.projectName.textContent = state.project.name;
    this._cache.projectSubtitle.textContent = state.project.subtitle;
    this._cache.themeText.textContent = state.theme || '普通的一天';
    this._cache.dayNum.textContent = state.day;
  },

  // ---------- 保存提示闪烁 ----------
  flashSave() {
    const el = this._cache.saveIndicator;
    el.classList.add('saved');
    setTimeout(() => el.classList.remove('saved'), 1500);
  },

  // ---------- 显示继续游戏按钮 ----------
  showContinueButton(callback) {
    if (this._cache.btnContinue) {
      this._cache.btnContinue.style.display = 'inline-block';
      this._cache.btnContinue.onclick = callback;
    }
  },

  hideContinueButton() {
    if (this._cache.btnContinue) {
      this._cache.btnContinue.style.display = 'none';
    }
  }
};
