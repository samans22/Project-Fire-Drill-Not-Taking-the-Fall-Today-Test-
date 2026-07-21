/**
 * build-single.js - 构建单文件版本 play.html
 * 将所有 CSS 和 JSON 数据内嵌到 HTML 中，JS 合并为一个脚本
 */
const fs = require('fs');
const path = require('path');

const BASE = __dirname;

// 读取文件
const css = fs.readFileSync(path.join(BASE, 'css', 'style.css'), 'utf-8');
const storage = fs.readFileSync(path.join(BASE, 'js', 'storage.js'), 'utf-8');
const game = fs.readFileSync(path.join(BASE, 'js', 'game.js'), 'utf-8');
const eventsJs = fs.readFileSync(path.join(BASE, 'js', 'events.js'), 'utf-8');
const chatJs = fs.readFileSync(path.join(BASE, 'js', 'chat.js'), 'utf-8');
const ui = fs.readFileSync(path.join(BASE, 'js', 'ui.js'), 'utf-8');
let mainJs = fs.readFileSync(path.join(BASE, 'js', 'main.js'), 'utf-8');

// 读取 JSON 数据
const projects = fs.readFileSync(path.join(BASE, 'js', 'data', 'projects.json'), 'utf-8');
const characters = fs.readFileSync(path.join(BASE, 'js', 'data', 'characters.json'), 'utf-8');
const themes = fs.readFileSync(path.join(BASE, 'js', 'data', 'themes.json'), 'utf-8');
const endings = fs.readFileSync(path.join(BASE, 'js', 'data', 'endings.json'), 'utf-8');
const eventsData = fs.readFileSync(path.join(BASE, 'js', 'data', 'events.json'), 'utf-8');

// 修改 main.js: 将 fetch 调用替换为内嵌数据
// 替换 loadAllData 函数，直接使用内嵌的 JSON
const inlineDataLoader = `
// ---------- 加载所有数据（内嵌版本）----------
async function loadAllData() {
  const projects = ${projects.trim()};
  const characters = ${characters.trim()};
  const themes = ${themes.trim()};
  const endings = ${endings.trim()};

  gameData = { projects, characters, themes, endings };

  // 内嵌事件数据
  Events._pool = ${eventsData.trim()};
  Events._buildChainMap();
}
`;

// 替换原来的 loadAllData 函数
mainJs = mainJs.replace(
  /\/\/ ---------- 加载所有数据 ----------\nasync function loadAllData\(\) \{[\s\S]*?\n\}/,
  inlineDataLoader.trim()
);

// 移除 Events.load() 调用（数据已内嵌）
mainJs = mainJs.replace(/await Events\.load\(\);?\n?/, '');
// 但 init 中 await loadAllData() 之后应该就是 init 绑定
// 实际上 main.js 中 Events.load() 是在 loadAllData 函数里被调用的，我们已经替换掉了

// 组合 HTML
const singleHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>万象协同项目管理系统 v2.4.1</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏢</text></svg>">
  <style>
${css}
  </style>
</head>
<body>

  <!-- ========== 顶部状态栏 ========== -->
  <header class="header">
    <div class="header-left">
      <span class="header-logo">🏢 万象协同 · 项目管理系统</span>
      <span class="header-divider">|</span>
      <span class="header-project" id="project-name">加载中...</span>
      <span id="project-subtitle" style="font-size:11px;color:#64748b;"></span>
    </div>
    <div class="header-right">
      <span class="header-theme" id="theme-text">--</span>
      <span class="header-day">第 <strong id="day-num">1</strong> 天</span>
      <span class="save-indicator" id="save-indicator">● 已保存</span>
    </div>
  </header>

  <!-- ========== 主布局 ========== -->
  <div class="main-layout">

    <!-- 左侧面板：项目列表 -->
    <aside class="sidebar">
      <div class="sidebar-section-title">📁 我的项目</div>
      <div class="project-item active">
        <div class="proj-name" id="sidebar-project-name">ESG 年报冲刺</div>
        <div class="proj-desc">年底前完成报告披露</div>
      </div>
      <div class="project-item">
        <div class="proj-name">资本市场沟通</div>
        <div class="proj-desc">Q4 投资者关系维护</div>
      </div>
      <div class="project-item">
        <div class="proj-name">年度行业峰会</div>
        <div class="proj-desc">3月大型线下活动</div>
      </div>

      <div style="margin-top:16px;"></div>
      <div class="sidebar-section-title">📋 今日待办</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:2;">
        ☐ 处理突发事件<br>
        ☐ 维护客户关系<br>
        ☐ 控制项目预算<br>
        ☐ 控制合规风险<br>
        ☐ 平安下班回家
      </div>
    </aside>

    <!-- 中间：事件卡片 -->
    <main class="content">
      <div class="event-card" id="event-card">
        <div class="event-card-header">
          <div class="event-speaker-avatar" id="event-speaker-avatar">📌</div>
          <div class="event-speaker-info">
            <div class="event-speaker-name" id="event-speaker">--</div>
            <div class="event-speaker-title-text">消息来源</div>
          </div>
        </div>
        <div class="event-title" id="event-title">--</div>
        <div class="event-text" id="event-text">--</div>
        <div class="choices-container" id="choices-container"></div>
        <div class="feedback-area" id="feedback-area">
          <div class="feedback-label">✓ 已处理</div>
          <div id="feedback-text"></div>
          <button class="feedback-continue-btn" id="feedback-continue-btn">继续处理 &gt;</button>
        </div>
      </div>
    </main>

    <!-- 右侧面板：健康度 + 群聊 -->
    <aside class="right-panel">
      <!-- 项目健康度 -->
      <div class="health-panel">
        <div class="health-title">📊 项目健康度</div>
        <div class="stat-row">
          <span class="stat-label">⏱️ 时间</span>
          <div class="stat-bar-bg"><div class="bar-fill green" id="time-fill" style="width:100%"></div></div>
          <span class="stat-value" id="stat-time">10</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">💰 预算</span>
          <div class="stat-bar-bg"><div class="bar-fill green" id="budget-fill" style="width:100%"></div></div>
          <span class="stat-value" id="stat-budget">10</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">😊 满意度</span>
          <div class="stat-bar-bg"><div class="bar-fill green" id="satisfaction-fill" style="width:100%"></div></div>
          <span class="stat-value" id="stat-satisfaction">10</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">⚠️ 风险</span>
          <div class="stat-bar-bg"><div class="bar-fill green reverse" id="risk-fill" style="width:0%"></div></div>
          <span class="stat-value" id="stat-risk">0</span>
        </div>
      </div>

      <!-- 群聊消息 -->
      <div class="chat-panel">
        <div class="chat-title">💬 项目工作群 <span style="font-weight:400;color:#94a3b8;">(48)</span></div>
        <div class="chat-list" id="chat-list">
          <div class="chat-msg"><span class="chat-speaker">系统:</span> 欢迎回来。项目看板已就绪。</div>
        </div>
      </div>

      <!-- 彩蛋 -->
      <div class="file-easter-egg" id="file-easter-egg">📎 最终版.pptx</div>
    </aside>
  </div>

  <!-- ========== 底部状态栏 ========== -->
  <footer class="footer">
    <div class="footer-left">
      <span><span class="status-dot green"></span> 数据同步中</span>
      <span>版本 V17 已保存</span>
    </div>
    <div class="footer-right">
      <span id="clock">--:--</span>
      <span>距下班: <strong id="countdown">--</strong></span>
      <button class="btn btn-secondary" id="btn-continue" style="display:none;font-size:11px;padding:3px 10px;">继续游戏</button>
    </div>
  </footer>

  <!-- ========== 开始界面 ========== -->
  <div class="overlay" id="start-overlay">
    <div class="overlay-card">
      <h1>🏢 项目救火办</h1>
      <p style="font-size:20px;font-weight:700;color:var(--accent);margin-bottom:4px;">今日不背锅</p>
      <p class="subtitle">
        伪装成项目管理后台的职场生存游戏。<br>
        处理突发事件，在下班前维持项目「全绿」。
      </p>
      <button class="btn btn-primary" id="btn-start-new">🆕 开始新项目</button>
      <button class="btn btn-secondary" id="btn-start-continue" style="display:none;">📂 继续上次项目</button>
      <p style="font-size:10px;color:var(--text-muted);margin-top:16px;">
        单局 3–5 分钟 · 支持随时刷新继续 · 所有数据保存在本地
      </p>
    </div>
  </div>

  <!-- ========== 结局界面 ========== -->
  <div class="overlay" id="ending-overlay" style="display:none;">
    <div class="overlay-card">
      <div class="ending-tag" id="ending-tag"></div>
      <h1 id="ending-title">--</h1>
      <p style="font-size:14px;line-height:1.7;color:var(--text-secondary);margin:16px 0;" id="ending-text"></p>
      <div class="ending-summary" id="ending-summary"></div>
      <button class="btn btn-primary" id="btn-new-game">🔄 开始新项目</button>
      <p style="font-size:10px;color:var(--text-muted);margin-top:12px;">
        截图分享你的「年度项目履历」给朋友！
      </p>
    </div>
  </div>

  <!-- ========== 内嵌脚本 ========== -->
  <script>
// ============ storage.js ============
${storage}

// ============ game.js ============
${game}

// ============ events.js ============
${eventsJs}

// ============ chat.js ============
${chatJs}

// ============ ui.js ============
${ui}

// ============ main.js (with inline data) ============
${mainJs}
  </script>

  <!-- 时钟 & 倒计时 -->
  <script>
    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent =
        now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

      // 距离18:00下班倒计时
      const offWork = new Date(now);
      offWork.setHours(18, 0, 0, 0);
      if (now > offWork) offWork.setDate(offWork.getDate() + 1);
      const diff = Math.max(0, Math.floor((offWork - now) / 60000));
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      document.getElementById('countdown').textContent =
        (h > 0 ? h + 'h ' : '') + m + 'min';
    }
    updateClock();
    setInterval(updateClock, 30000);
  </script>
</body>
</html>`;

// 写入 play.html
const outPath = path.join(BASE, 'play.html');
fs.writeFileSync(outPath, singleHtml, 'utf-8');
console.log(`✅ play.html 已生成 (${(Buffer.byteLength(singleHtml, 'utf-8') / 1024).toFixed(1)} KB)`);
