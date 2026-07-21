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

  // 执行选择
  const record = Game.executeChoice(gameState, event, choiceIndex);
  if (!record) return;

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
      currentEvent = modified;
      UI.showEvent(currentEvent, gameData.characters);
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
  Events.loadThemes(themes);
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
      currentEvent = modified;
      UI.showEvent(currentEvent, gameData.characters);
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
  const event = Events.pickEvent(gameState);
  if (!event) {
    // 没有可用事件：推进天数
    advanceDayAndContinue();
    return;
  }

  currentEvent = event;
  UI.showEvent(currentEvent, gameData.characters);
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
  const event = Events.pickEvent(gameState);
  if (!event) {
    // 确实没有事件了，强制结束
    const defaultEnding = gameData.endings.find(e => e.condition?.default) || gameData.endings[0];
    endGame(defaultEnding);
    return;
  }
  currentEvent = event;
  UI.showEvent(currentEvent, gameData.characters);
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
