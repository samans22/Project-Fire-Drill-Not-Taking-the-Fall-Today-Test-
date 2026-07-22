/**
 * fix-text-pool.js — P2 Phase 1 数据修复脚本
 * P1.1: 统一 theme ID（14个key重命名）
 * P1.2: 孤儿 eventId 分配（N_ 前缀 + 空 eventId → 真实事件ID）
 * P1.3: 文本去重（删除 T0003, T0014）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');

const tp = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'text-pool.json'), 'utf-8'));
const themes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'themes.json'), 'utf-8'));
const events = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf-8'));

const realEventIds = new Set(events.map(e => e.eventId));
let changes = { renames: 0, eventIdFixes: 0, deletions: 0 };

// ========== P1.1: Theme ID 重命名映射 ==========
const KEY_RENAME = {
  'annual_report':    'annual_report_deadline',
  'client_call':      'client_calls',
  'event_day':        'event_checkin_day',
  'internal_review':  'leadership_review',
  'kickoff':          'project_kickoff',
  'last_minute':      'last_minute_report',
  'last_workday':     'last_working_day',
  'new_boss':         'new_boss_day',
  'pr_crisis':        'post_event_turbulence',
  'regulatory':       'regulatory_inquiry',
  'roadshow':         'roadshow_eve',
  'scope_creep':      'client_adds_requirements',
  'supplier_chain':   'vendor_failure',
  'system_launch':    'system_launch_day',
};

const newByTheme = {};

for (const [oldKey, texts] of Object.entries(tp.byTheme)) {
  const newKey = KEY_RENAME[oldKey] || oldKey;
  if (newKey !== oldKey) {
    console.log('P1.1 RENAME: ' + oldKey + ' -> ' + newKey + ' (' + texts.length + ' texts)');
  }

  for (const t of texts) {
    if (t.themeId !== newKey) {
      t.themeId = newKey;
      changes.renames++;
    }
  }

  newByTheme[newKey] = texts;
}

tp.byTheme = newByTheme;

// ========== P1.2: 孤儿 eventId 分配 ==========
const ALLOCATION = {
  monday_morning:       { prefix: 'N_M', targets: ['E003','E004','E011','E013','E022'] },
  last_minute_report:   { prefix: 'N_L', targets: ['E004','E012','E013','E014','E023','E045'] },
  friday_afternoon:     { prefix: 'N_F', targets: ['E004','E011','E012','E014','E023','E045'] },
  post_event_turbulence:{ prefix: 'N_P', targets: ['E015','E020','E021','E022','E044'] },
  pre_holiday:          { prefix: 'N_H', targets: ['E004','E011','E012','E014','E045'] },
  new_boss_day:         { prefix: 'N_B', targets: ['E003','E004','E013','E022','E031'] },
  quarterly_review:     { prefix: 'N_Q', targets: ['E009','E012','E015','E021','E028','E044'] },
  last_working_day:     { prefix: 'N_W', targets: ['E004','E012','E014','E023','E045'] },
  project_kickoff:      { prefix: 'N_K', targets: ['E003','E004','E011','E013','E022'] },
};

for (const [themeId, info] of Object.entries(ALLOCATION)) {
  const pool = tp.byTheme[themeId];
  if (!pool) {
    console.log('WARNING: theme ' + themeId + ' not found in text-pool, skipping P1.2');
    continue;
  }

  const targets = info.targets;

  // Collect N_ prefix orphans
  const nOrphans = pool.filter(function(t) { return /^N_[A-Z]\d+$/.test(t.eventId); });
  // Collect empty eventId orphans
  const emptyOrphans = pool.filter(function(t) { return !t.eventId || t.eventId.trim() === ''; });
  const totalOrphans = nOrphans.length + emptyOrphans.length;

  console.log('P1.2: ' + themeId + ' has ' + totalOrphans + ' orphans (' + nOrphans.length + ' N_-prefix + ' + emptyOrphans.length + ' empty) -> ' + targets.length + ' events: ' + targets.join(','));

  // Assign N_ prefix orphans by their number index
  for (var ni = 0; ni < nOrphans.length; ni++) {
    var t = nOrphans[ni];
    var match = t.eventId.match(/\d+/);
    if (!match) continue;
    var idx = parseInt(match[0]) - 1;
    var targetIdx = idx % targets.length;
    t.eventId = targets[targetIdx];
    changes.eventIdFixes++;
  }

  // Assign empty eventId orphans: round-robin, continuing from N_ count
  for (var ei = 0; ei < emptyOrphans.length; ei++) {
    var idx2 = nOrphans.length + ei;
    var targetIdx2 = idx2 % targets.length;
    emptyOrphans[ei].eventId = targets[targetIdx2];
    changes.eventIdFixes++;
  }
}

// ========== P1.3: 文本去重 ==========
var DUPLICATE_IDS = { 'T0003': true, 'T0014': true };

for (var themeKey in tp.byTheme) {
  var before = tp.byTheme[themeKey].length;
  tp.byTheme[themeKey] = tp.byTheme[themeKey].filter(function(t) {
    if (DUPLICATE_IDS[t.textId]) {
      console.log('P1.3 DELETE: ' + t.textId + ' (duplicate) from ' + themeKey);
      changes.deletions++;
      return false;
    }
    return true;
  });
}

// ========== Update _total ==========
var newTotal = 0;
for (var tk in tp.byTheme) {
  newTotal += tp.byTheme[tk].length;
}
tp._total = newTotal;

// ========== Write fixed file ==========
var outPath = path.join(DATA_DIR, 'text-pool.json');
fs.writeFileSync(outPath, JSON.stringify(tp, null, 2), 'utf-8');
console.log('\n=== text-pool.json written ===');
console.log('_total: ' + tp._total + ' (was 515)');
console.log('Theme renames: ' + changes.renames);
console.log('EventId fixes: ' + changes.eventIdFixes);
console.log('Deletions: ' + changes.deletions);

// ========== Quick validation ==========
var poolIds = Object.keys(tp.byTheme).sort();
var themeIds = themes.map(function(t) { return t.id; }).sort();
var missing = themeIds.filter(function(id) { return !poolIds.includes(id); });
var extra = poolIds.filter(function(id) { return !themeIds.includes(id); });

console.log('\n--- Quick Validation ---');
if (missing.length === 0) console.log('PASS: All ' + themeIds.length + ' theme IDs present');
else console.log('FAIL: Missing themes: ' + missing.join(', '));
if (extra.length === 0) console.log('PASS: No extra theme IDs');
else console.log('FAIL: Extra themes: ' + extra.join(', '));

var orphanCount = 0;
for (var ttk in tp.byTheme) {
  for (var ti = 0; ti < tp.byTheme[ttk].length; ti++) {
    var tt = tp.byTheme[ttk][ti];
    var ids = (tt.eventId || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (ids.length === 0 || ids.every(function(id) { return !realEventIds.has(id); })) {
      orphanCount++;
      if (orphanCount <= 5) console.log('  ORPHAN: ' + tt.textId + ' eventId=[' + tt.eventId + '] in ' + ttk);
    }
  }
}
if (orphanCount === 0) console.log('PASS: 0 orphan eventIds');
else console.log('FAIL: ' + orphanCount + ' orphan eventIds remaining');

// Per-theme text counts
console.log('\n--- Per-Theme Text Counts ---');
for (var pk in tp.byTheme) {
  console.log('  ' + pk + ': ' + tp.byTheme[pk].length + ' texts');
}

console.log('\nDone.');
