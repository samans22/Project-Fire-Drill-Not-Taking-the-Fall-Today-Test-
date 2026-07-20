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

  // 添加群聊
  const speaker = gameData.characters.find(c => c.id === event.speaker);
  if (speaker) {
    UI.addChatMessage(speaker.name, record.choiceText);
  }

  // 自动存档
  autoSave();
  UI.flashSave();
  currentEvent = null;
}

// ---------- 全局回调：点击"继续处理"后触发 ----------
function onContinueClicked() {
  if (!gameState || gameState.phase !== 'playing') return;
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
}

// ---------- 开始新游戏 ----------
function startNewGame() {
  const project = gameData.projects[Math.floor(Math.random() * gameData.projects.length)];
  const theme = gameData.themes[Math.floor(Math.random() * gameData.themes.length)];

  gameState = Game.createInitialState(project);
  gameState.theme = theme;

  UI.hideStartScreen();
  UI.hideEnding();
  UI.updateHeader(gameState);
  UI.updateStats(gameState.stats, gameState.statsMax);

  // 随机群聊开场
  const openers = [
    ['系统', `项目包已分配：${project.name}`],
    ['系统', `今日主题：${theme}`],
    ['系统', `下班倒计时开始。祝你好运。`],
  ];
  openers.forEach(o => UI.addChatMessage(o[0], o[1]));

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
  UI.hideContinueButton();
  UI.updateFileEasterEgg();

  // 恢复群聊（最近的几条记录）
  const recent = gameState.choiceHistory.slice(-5);
  recent.forEach(r => {
    UI.addChatMessage('你', r.choiceText);
  });

  currentEvent = null;
  gameState.phase = 'playing';
  nextTurn();
}

// ---------- 下一回合 ----------
function nextTurn() {
  if (!gameState || gameState.phase !== 'playing') return;

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
    Game.advanceDay(gameState);
    UI.updateHeader(gameState);
    autoSave();

    // 再检查结局
    const ending2 = Game.checkEnding(gameState, gameData.endings);
    if (ending2) {
      endGame(ending2);
      return;
    }

    // 继续
    const event2 = Events.pickEvent(gameState);
    if (!event2) {
      // 确实没有事件了，强制结束
      const defaultEnding = gameData.endings.find(e => e.condition?.default) || gameData.endings[0];
      endGame(defaultEnding);
      return;
    }
    currentEvent = event2;
    UI.showEvent(currentEvent, gameData.characters);
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
