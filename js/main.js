/**
 * main.js - 游戏主入口 & 游戏循环控制
 * 负责初始化、回合流转、存档和全局回调
 */
let gameState = null;
let gameData = { projects: [], characters: [], themes: [], endings: [] };

// ---------- 全局回调：选项被点击时触发 ----------
function onChoiceSelected(choiceIndex) {
  if (!gameState || gameState.phase !== 'playing') return;

  const event = currentEvent;
  if (!event) return;

  // 将解析后的变体注入 event（供 executeChoice 读取）
  const choice = event.choices[choiceIndex];
  if (choice && choice._resolved) {
    event.choices[choiceIndex] = Object.assign({}, choice, choice._resolved);
  }

  // 执行选择
  const record = Game.executeChoice(gameState, event, choiceIndex);
  if (!record) return;

  // 记录 composite 用于动态难度
  const composite = Balancer.computeComposite(record.effects);
  Balancer.recordSelection(composite);

  // 显示反馈
  UI.showFeedback(record.feedback, record.effects);
  UI.updateStats(gameState.stats, gameState.statsMax);
  UI.updateQuota(gameState.eventsToday, gameState.eventsPerDay);

  // 添加群聊
  const speaker = gameData.characters.find(c => c.id === event.speaker);
  if (speaker) {
    UI.addChatMessage(speaker.name, record.choiceText);
  }

  // 群聊：NPC 对事件选择的反应
  const reactions = ChatMessages.getEventReaction(event.eventId);
  reactions.forEach(m => UI.addChatMessage(m.speaker, m.text));

  // 群聊：状态预警
  const warnings = ChatMessages.getStatWarnings(gameState.stats, gameState.statsMax);
  warnings.forEach(m => UI.addChatMessage(m.speaker, m.text));

  // 多阶段：记录下一阶段事件ID
  gameState.pendingNextEventId = record.nextEventId || null;

  // 自动存档
  autoSave();
  UI.flashSave();
  currentEvent = null;
}

// ---------- 全局回调：点击"继续处理"后触发 ----------
function onContinueClicked() {
  if (!gameState || gameState.phase !== 'playing') return;

  // 多阶段事件：如果有待显示的下一阶段，直接展示
  if (gameState.pendingNextEventId) {
    const nextId = gameState.pendingNextEventId;
    gameState.pendingNextEventId = null;
    const nextEvent = Events.getEventById(nextId);
    if (nextEvent) {
      const theme = Events._getTheme(gameState);
      const modified = Events._applyTextOverrides(nextEvent, theme);
      currentEvent = _injectTextPoolChoices(modified);
      UI.showEvent(currentEvent, gameData.characters, gameState);
      autoSave();
      return;
    }
  }

  // 群聊：事件之间的随机氛围消息
  const betweenMsgs = ChatMessages.getBetweenEvent();
  betweenMsgs.forEach(m => UI.addChatMessage(m.speaker, m.text));

  nextTurn();
}

let currentEvent = null;

// ---------- 加载所有数据 ----------
async function loadAllData() {
  const loadJSON = async (path) => {
    const res = await fetch(path);
    return res.json();
  };

  const [projects, characters, themes, endings] = await Promise.all([
    loadJSON('js/data/projects.json'),
    loadJSON('js/data/characters.json'),
    loadJSON('js/data/themes.json'),
    loadJSON('js/data/endings.json'),
  ]);

  gameData = { projects, characters, themes, endings };
  await Events.load();
  await Events.loadTextPool();
  Events.loadThemes(themes);
}

// ---------- 文本池注入：用主题文本池替换事件的固定选项 ----------
function _injectTextPoolChoices(event) {
  if (!event || event.isChainOnly) return event;

  // 查找匹配的文本池候选
  const candidates = Balancer.getTextsForEvent(event.eventId);
  if (candidates.length < 3) {
    // 文本池不够3条 → 保留原有选项，但增强 tooltip 显示效果数值
    const enhanced = Object.assign({}, event);
    enhanced.choices = event.choices.map(ch => {
      const effectsHint = Balancer.formatEffectsHint(ch.effects || {});
      const newHint = ch.hint
        ? effectsHint + '\n' + ch.hint
        : effectsHint;
      return Object.assign({}, ch, { hint: newHint });
    });
    return enhanced;
  }

  // 动态选择3条文本
  const selected = Balancer.selectTexts(
    candidates, gameState.stats, gameState.day, 3, gameState.statsMax
  );
  if (!selected || selected.length < 3) return event;

  // 转换为 choice 格式
  const newChoices = selected.map(t => ({
    text: t.text,
    effects: t.effects,
    feedback: t.feedback,
    setsFlags: t.setsFlags || undefined,
    hint: Balancer.formatEffectsHint(t.effects),
    composite: t.compositeScore,
    _fromPool: true,
  }));

  // 浅拷贝事件，替换 choices
  return Object.assign({}, event, { choices: newChoices });
}

// ---------- 开始新游戏 ----------
function startNewGame() {
  const project = gameData.projects[Math.floor(Math.random() * gameData.projects.length)];
  const themeObj = gameData.themes[Math.floor(Math.random() * gameData.themes.length)];

  // 兼容旧格式（纯字符串）和新格式（对象带 modifier）
  const themeText = typeof themeObj === 'string' ? themeObj : themeObj.text;
  const themeMod = (typeof themeObj === 'object' && themeObj.modifier) ? themeObj.modifier : null;

  gameState = Game.createInitialState(project);
  gameState.theme = themeText;
  gameState.themeId = (typeof themeObj === 'object' && themeObj.id) ? themeObj.id : null;

  // 应用主题修正（如\"预算被砍30%\"开局-2预算）
  if (themeMod) {
    Game.applyEffects(gameState, themeMod);
  }

  Balancer.reset();
  Balancer.setTheme(gameState.themeId, Events.getTextPoolData());

  UI.hideStartScreen();
  UI.hideEnding();
  UI.updateHeader(gameState);
  UI.updateStats(gameState.stats, gameState.statsMax);
  UI.updateQuota(gameState.eventsToday, gameState.eventsPerDay);

  // 开场群聊消息
  UI.addChatMessage('系统', `项目包已分配：${project.name}`);
  UI.addChatMessage('系统', `今日主题：${themeText}`);
  const dayAmbient = ChatMessages.getDayAmbient(gameState.day);
  dayAmbient.forEach(m => UI.addChatMessage(m.speaker, m.text));
  UI.addChatMessage('系统', '下班倒计时开始。祝你好运。');

  UI.updateFileEasterEgg();
  UI.hideContinueButton();
  currentEvent = null;
  gameState.phase = 'playing';

  autoSave();
  nextTurn();
}

// ---------- 继续游戏 ----------
function continueGame() {
  const saved = Storage.load();
  if (!saved) {
    startNewGame();
    return;
  }

  gameState = saved;

  // 恢复 Balancer 主题和文本池
  Balancer.reset();
  if (gameState.themeId) {
    Balancer.setTheme(gameState.themeId, Events.getTextPoolData());
  }

  UI.hideStartScreen();
  UI.hideEnding();
  UI.updateHeader(gameState);
  UI.updateStats(gameState.stats, gameState.statsMax);
  UI.updateQuota(gameState.eventsToday, gameState.eventsPerDay);
  UI.hideContinueButton();
  UI.updateFileEasterEgg();

  // 恢复群聊（最近的几条记录）
  const recent = gameState.choiceHistory.slice(-5);
  recent.forEach(r => {
    UI.addChatMessage('你', r.choiceText);
  });

  currentEvent = null;
  gameState.phase = 'playing';

  // 如果存档处于多阶段事件中途，恢复下一阶段
  if (gameState.pendingNextEventId) {
    const nextId = gameState.pendingNextEventId;
    gameState.pendingNextEventId = null;
    const nextEvent = Events.getEventById(nextId);
    if (nextEvent) {
      const theme = Events._getTheme(gameState);
      const modified = Events._applyTextOverrides(nextEvent, theme);
      currentEvent = _injectTextPoolChoices(modified);
      UI.showEvent(currentEvent, gameData.characters, gameState);
      return;
    }
  }

  nextTurn();
}

// ---------- 下一回合 ----------
function nextTurn() {
  if (!gameState || gameState.phase !== 'playing') return;

  // 每日配额检查：今日事件数已达上限 → 推进天数
  if (gameState.eventsToday >= gameState.eventsPerDay) {
    advanceDayAndContinue();
    return;
  }

  // 检查结局
  const ending = Game.checkEnding(gameState, gameData.endings);
  if (ending) {
    endGame(ending);
    return;
  }

  // 抽取事件
  let event = Events.pickEvent(gameState);
  if (!event) {
    // 没有可用事件：推进天数
    advanceDayAndContinue();
    return;
  }

  // 注入文本池选项
  event = _injectTextPoolChoices(event);

  currentEvent = event;
  UI.showEvent(currentEvent, gameData.characters, gameState);
}

// ---------- 推进天数并继续 ----------
function advanceDayAndContinue() {
  Game.advanceDay(gameState);

  // 群聊：昨日结束消息
  const dayEndMsgs = ChatMessages.getDayEnd();
  dayEndMsgs.forEach(m => UI.addChatMessage(m.speaker, m.text));

  UI.updateHeader(gameState);
  UI.updateStats(gameState.stats, gameState.statsMax);
  UI.updateQuota(gameState.eventsToday, gameState.eventsPerDay);

  // 群聊：新一天开始消息
  const dayStartMsgs = ChatMessages.getDayStart();
  dayStartMsgs.forEach(m => UI.addChatMessage(m.speaker, m.text));

  // 群聊：每日氛围消息
  const ambientMsgs = ChatMessages.getDayAmbient(gameState.day);
  ambientMsgs.forEach(m => UI.addChatMessage(m.speaker, m.text));

  autoSave();

  // 检查结局
  const ending = Game.checkEnding(gameState, gameData.endings);
  if (ending) {
    endGame(ending);
    return;
  }

  // 尝试抽取事件
  let event = Events.pickEvent(gameState);
  if (!event) {
    // 确实没有事件了，强制结束
    const defaultEnding = gameData.endings.find(e => e.condition?.default) || gameData.endings[0];
    endGame(defaultEnding);
    return;
  }

  // 注入文本池选项
  event = _injectTextPoolChoices(event);

  currentEvent = event;
  UI.showEvent(currentEvent, gameData.characters, gameState);
}

// ---------- 游戏结束 ----------
function endGame(ending) {
  gameState.phase = 'ended';
  UI.showEnding(ending, gameState);
  UI.hideContinueButton();
  Storage.clear();
  UI.flashSave();
}

// ---------- 自动存档 ----------
function autoSave() {
  if (!gameState || gameState.phase !== 'playing') return;
  Storage.save(gameState);
}

// ---------- 初始化 ----------
async function init() {
  UI.init();

  // 加载数据
  await loadAllData();

  const hasSaved = Storage.hasSavedGame();
  UI.showStartScreen(hasSaved);

  // 按钮事件绑定
  UI._cache.btnStartNew.addEventListener('click', startNewGame);
  UI._cache.btnStartContinue.addEventListener('click', continueGame);
  UI._cache.btnNewGame.addEventListener('click', startNewGame);

  // 如果有存档，绑定继续按钮
  if (hasSaved) {
    UI._cache.btnContinue.addEventListener('click', continueGame);
    UI.showContinueButton(continueGame);
  }

  console.log('🏢 项目救火办：今日不背锅 - 已就绪');
  console.log(`  事件池: ${Events._pool.length} 条`);
}

// ---------- 启动 ----------
document.addEventListener('DOMContentLoaded', init);
