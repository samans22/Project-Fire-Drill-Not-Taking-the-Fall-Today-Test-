/**
 * rebuild-from-csv.js — v0.9.1.3 从 CSV 重建 text-pool.json + themes.json
 *
 * 核心原则 (v0.9.1.3):
 *   1. CSV 是 ground truth — themeId↔eventId 映射严格从 CSV 提取
 *   2. 每个 eventId 只属于一个 theme（按其 CSV 中 real 文本所属的 theme）
 *   3. N_ 孤儿仅分配给本 theme 的 CSV events（不跨主题）
 *   4. themes.json boosted 列表从 CSV 数据派生
 *   5. 零跨主题污染保证
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');

// Load data
const csv = fs.readFileSync(path.join(__dirname, '..', 'text-pool-balanced.csv'), 'utf-8');
const themes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'themes.json'), 'utf-8'));
const events = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf-8'));

// Old CSV themeId → new themes.json id
const KEY_MAP = {
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
  'monday_morning':   'monday_morning',
  'budget_cut':       'budget_cut',
  'friday_afternoon': 'friday_afternoon',
  'pre_holiday':      'pre_holiday',
  'quarterly_review': 'quarterly_review',
};

const realEventIds = new Set(events.map(e => e.eventId));

// ========== Proper CSV parser ==========
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

const lines = csv.trim().split('\n');

// ========== Step 1: Parse all texts from CSV ==========
const allTexts = [];
const seenTextIds = new Set(); // for dedup (T0003, T0014)

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (cols.length < 16) continue;

  const textId = cols[0];

  // Skip duplicates (T0003 = dup of T0001, T0014 = dup of T0013)
  if (textId === 'T0003' || textId === 'T0014') continue;

  const csvThemeId = cols[1];
  const newThemeId = KEY_MAP[csvThemeId] || csvThemeId;
  const csvEventId = cols[3];
  const text = cols[10];
  const feedback = cols[11];
  const time = parseInt(cols[12]) || 0;
  const budget = parseInt(cols[13]) || 0;
  const satisfaction = parseInt(cols[14]) || 0;
  const risk = parseInt(cols[15]) || 0;
  const compositeScore = (time + budget + satisfaction) + risk;
  const tags = cols[17] || '';
  const tone = cols[18] || '';
  const setsFlags = cols[19] || '';
  const requiresFlags = cols[20] || '';

  allTexts.push({
    textId, csvThemeId, newThemeId, csvEventId, text, feedback,
    time, budget, satisfaction, risk, compositeScore,
    tags, tone, setsFlags, requiresFlags,
  });
}

// ========== Step 2: Extract CSV_EVENT_MAP — the ground truth ==========
// For each newThemeId, which real eventIds appear in CSV?
const CSV_EVENT_MAP = {};  // newThemeId → Set of real eventIds
for (const t of allTexts) {
  if (!CSV_EVENT_MAP[t.newThemeId]) CSV_EVENT_MAP[t.newThemeId] = new Set();
  if (t.csvEventId && !t.csvEventId.startsWith('N_') && t.csvEventId.trim() !== '') {
    CSV_EVENT_MAP[t.newThemeId].add(t.csvEventId);
  }
}

// Convert Sets to sorted arrays
const CSV_THEME_EVENTS = {};
for (const [themeId, eventSet] of Object.entries(CSV_EVENT_MAP)) {
  CSV_THEME_EVENTS[themeId] = [...eventSet].sort();
}

console.log('=== CSV Theme→Event Mapping (Ground Truth) ===');
for (const [themeId, evIds] of Object.entries(CSV_THEME_EVENTS).sort()) {
  console.log('  ' + themeId + ': [' + evIds.join(', ') + '] (' + evIds.length + ' events)');
}

// Verify: each eventId should appear in at most ONE theme's CSV
const eventToTheme = {};
let csvCrossTheme = 0;
for (const [themeId, evIds] of Object.entries(CSV_THEME_EVENTS)) {
  for (const evId of evIds) {
    if (eventToTheme[evId] && eventToTheme[evId] !== themeId) {
      console.log('  ❌ CSV CROSS: ' + evId + ' in both ' + eventToTheme[evId] + ' AND ' + themeId);
      csvCrossTheme++;
    }
    eventToTheme[evId] = themeId;
  }
}
if (csvCrossTheme === 0) {
  console.log('✅ CSV: Each eventId belongs to exactly 1 theme');
}

// ========== Step 3: Group texts by theme ==========
const byTheme = {};
for (const t of allTexts) {
  if (!byTheme[t.newThemeId]) byTheme[t.newThemeId] = { real: [], nOrphans: [], emptyOrphans: [] };

  if (t.csvEventId && !t.csvEventId.startsWith('N_') && t.csvEventId.trim() !== '') {
    // Real eventId → real pool
    byTheme[t.newThemeId].real.push(t);
  } else if (t.csvEventId && t.csvEventId.startsWith('N_')) {
    // N_ prefix → orphan
    byTheme[t.newThemeId].nOrphans.push(t);
  } else {
    // Empty eventId → orphan
    byTheme[t.newThemeId].emptyOrphans.push(t);
  }
}

// ========== Step 4: Assign orphans ==========
// Strategy:
//   1. For themes WITH CSV events: assign N_ groups to CSV events, empty orphans round-robin
//   2. For themes WITHOUT CSV events: collect all orphans, redistribute to themes that need
//      more coverage (events with < 3 texts)
let assignedOrphans = 0;
let unassignedOrphans = 0;
let redistributedOrphans = 0;

// First pass: collect orphans from themes with no CSV events
const redistributableN = [];  // { prefix, texts }
const redistributableEmpty = [];

for (const [themeId, groups] of Object.entries(byTheme)) {
  const csvEvents = CSV_THEME_EVENTS[themeId] || [];
  if (csvEvents.length === 0) {
    // v0.9.1.3: Theme has no CSV events → collect orphans for redistribution
    // Group N_ orphans by prefix
    const nGroups = {};
    for (const o of groups.nOrphans) {
      const prefix = o.csvEventId.replace(/\d+$/, '');
      if (!nGroups[prefix]) nGroups[prefix] = [];
      nGroups[prefix].push(o);
    }
    for (const [prefix, texts] of Object.entries(nGroups)) {
      redistributableN.push({ prefix, texts, fromTheme: themeId });
    }
    for (const o of groups.emptyOrphans) {
      redistributableEmpty.push(o);
    }
    // Clear from original theme (they'll be moved)
    groups.nOrphans = [];
    groups.emptyOrphans = [];
    continue;
  }
}

// Second pass: assign orphans within themes that have CSV events
for (const [themeId, groups] of Object.entries(byTheme)) {
  const csvEvents = CSV_THEME_EVENTS[themeId] || [];
  if (csvEvents.length === 0) continue;

  const nOrphans = groups.nOrphans;
  const emptyOrphans = groups.emptyOrphans;

  // Group N_ orphans by prefix
  const nGroups = {};
  for (const o of nOrphans) {
    const prefix = o.csvEventId.replace(/\d+$/, '');
    if (!nGroups[prefix]) nGroups[prefix] = [];
    nGroups[prefix].push(o);
  }

  // Assign each N_ group to one CSV event (round-robin across THIS theme's events)
  const nPrefixes = Object.keys(nGroups).sort();
  for (let gi = 0; gi < nPrefixes.length; gi++) {
    const targetEvent = csvEvents[gi % csvEvents.length];
    for (const o of nGroups[nPrefixes[gi]]) {
      o.csvEventId = targetEvent;
      assignedOrphans++;
    }
  }

  // Assign empty orphans round-robin across CSV events
  for (let ei = 0; ei < emptyOrphans.length; ei++) {
    emptyOrphans[ei].csvEventId = csvEvents[ei % csvEvents.length];
    assignedOrphans++;
  }
}

// Third pass: redistribute collected orphans to themes that need more coverage
// Find events with < 3 text-pool texts (across all themes)
if (redistributableN.length > 0 || redistributableEmpty.length > 0) {
  // Build map of { themeId, eventId } pairs that have < 3 real texts
  const lowCoverageEvents = [];
  for (const [themeId, groups] of Object.entries(byTheme)) {
    const csvEvents = CSV_THEME_EVENTS[themeId] || [];
    if (csvEvents.length === 0) continue;
    // Count texts per event in this theme
    for (const evId of csvEvents) {
      const realCount = groups.real.filter(t => {
        const ids = (t.csvEventId || '').split(',').map(s => s.trim());
        return ids.includes(evId);
      }).length;
      // Also count already-assigned N_ and empty orphans
      const nCount = groups.nOrphans.filter(t => {
        const ids = (t.csvEventId || '').split(',').map(s => s.trim());
        return ids.includes(evId);
      }).length;
      const eCount = groups.emptyOrphans.filter(t => {
        const ids = (t.csvEventId || '').split(',').map(s => s.trim());
        return ids.includes(evId);
      }).length;
      const total = realCount + nCount + eCount;
      if (total < 3) {
        lowCoverageEvents.push({ themeId, eventId: evId, count: total, needed: 3 - total });
      }
    }
  }

  // Sort by need (most needed first)
  lowCoverageEvents.sort((a, b) => b.needed - a.needed);

  // Distribute N_ groups (each group = 3 texts) to most-needed events
  let ri = 0;
  for (const ng of redistributableN) {
    if (ri >= lowCoverageEvents.length) {
      // No more events to assign to → keep as N_ prefix (will be flagged as orphans)
      unassignedOrphans += ng.texts.length;
      continue;
    }
    const target = lowCoverageEvents[ri % lowCoverageEvents.length];
    // Move these texts to the target theme
    for (const o of ng.texts) {
      o.newThemeId = target.themeId;
      o.csvEventId = target.eventId;
      redistributedOrphans++;
    }
    // Add to target theme's groups
    if (!byTheme[target.themeId]) {
      byTheme[target.themeId] = { real: [], nOrphans: [], emptyOrphans: [] };
    }
    byTheme[target.themeId].nOrphans.push(...ng.texts);
    ri++;
  }

  // Distribute empty orphans individually
  for (let ei = 0; ei < redistributableEmpty.length; ei++) {
    if (lowCoverageEvents.length === 0) {
      unassignedOrphans++;
      continue;
    }
    const target = lowCoverageEvents[ei % lowCoverageEvents.length];
    redistributableEmpty[ei].newThemeId = target.themeId;
    redistributableEmpty[ei].csvEventId = target.eventId;
    redistributedOrphans++;
    if (!byTheme[target.themeId]) {
      byTheme[target.themeId] = { real: [], nOrphans: [], emptyOrphans: [] };
    }
    byTheme[target.themeId].emptyOrphans.push(redistributableEmpty[ei]);
  }
}

// ========== Step 5: Build text-pool.json ==========
const outputByTheme = {};
let total = 0;

for (const themeId of Object.keys(KEY_MAP).map(k => KEY_MAP[k])) {
  const groups = byTheme[themeId];
  if (!groups) {
    // Theme with no CSV texts at all → empty pool
    outputByTheme[themeId] = [];
    continue;
  }

  const allThemeTexts = [...groups.real, ...groups.nOrphans, ...groups.emptyOrphans];
  const texts = allThemeTexts.map(t => {
    const entry = {
      textId: t.textId,
      themeId: themeId,
      eventId: t.csvEventId,
      text: t.text,
      feedback: t.feedback,
      effects: { time: t.time, budget: t.budget, satisfaction: t.satisfaction, risk: t.risk },
      compositeScore: t.compositeScore,
    };
    if (t.tags) entry.tags = t.tags;
    if (t.tone) entry.tone = t.tone;
    if (t.setsFlags) entry.setsFlags = t.setsFlags;
    if (t.requiresFlags) entry.requiresFlags = t.requiresFlags;
    return entry;
  });
  outputByTheme[themeId] = texts;
  total += texts.length;
}

const output = { _total: total, byTheme: outputByTheme };
fs.writeFileSync(path.join(DATA_DIR, 'text-pool.json'), JSON.stringify(output, null, 2), 'utf-8');

// ========== Step 6: Update themes.json boosted lists ==========
// Each theme boosts its CSV events (events that have text-pool coverage)
for (const theme of themes) {
  const csvEvents = CSV_THEME_EVENTS[theme.id] || [];
  if (csvEvents.length > 0) {
    theme.eventPool.boosted = csvEvents;
    theme.eventPool.boostWeight = 3;
  } else {
    // Theme has no CSV events → empty boosted list
    // The game will use general pool for this theme
    theme.eventPool.boosted = [];
    theme.eventPool.boostWeight = 3;
  }
}

fs.writeFileSync(path.join(DATA_DIR, 'themes.json'), JSON.stringify(themes, null, 2), 'utf-8');

// ========== Step 7: Update events.json themeExclusive ==========
// v0.9.1.4: 根据 CSV ground truth 设置 themeExclusive
const csvEventThemeMap = {};
for (const [themeId, evIds] of Object.entries(CSV_THEME_EVENTS)) {
  for (const evId of evIds) {
    csvEventThemeMap[evId] = themeId;
  }
}

let exclusiveAdded = 0;
let exclusiveCorrected = 0;
for (const ev of events) {
  const csvTheme = csvEventThemeMap[ev.eventId];
  if (csvTheme) {
    if (!ev.themeExclusive) {
      ev.themeExclusive = csvTheme;
      exclusiveAdded++;
    } else if (ev.themeExclusive !== csvTheme) {
      console.log('  ⚠ CORRECTED: ' + ev.eventId + ' themeExclusive ' + ev.themeExclusive + ' → ' + csvTheme);
      ev.themeExclusive = csvTheme;
      exclusiveCorrected++;
    }
  }
}

fs.writeFileSync(path.join(DATA_DIR, 'events.json'), JSON.stringify(events, null, 2), 'utf-8');
console.log('');
console.log('events.json themeExclusive: ' + exclusiveAdded + ' added, ' + exclusiveCorrected + ' corrected');

// ========== Step 8: Validation ==========
console.log('');
console.log('========================================');
console.log('  v0.9.1.3 Rebuild Summary');
console.log('========================================');
console.log('Total texts: ' + total);
console.log('Orphans assigned to own theme CSV events: ' + assignedOrphans);
console.log('Orphans redistributed to low-coverage themes: ' + redistributedOrphans);
console.log('Orphans unassigned (no target available): ' + unassignedOrphans);

// Validate: no cross-theme eventIds in text-pool
const eventThemeMap = {};
for (const [themeId, texts] of Object.entries(outputByTheme)) {
  for (const t of texts) {
    if (!t.eventId || t.eventId.trim() === '' || t.eventId.startsWith('N_')) continue;
    if (!eventThemeMap[t.eventId]) eventThemeMap[t.eventId] = new Set();
    eventThemeMap[t.eventId].add(themeId);
  }
}
let crossTheme = 0;
for (const [evId, themes] of Object.entries(eventThemeMap)) {
  if (themes.size > 1) {
    crossTheme++;
    console.log('  ❌ CROSS: ' + evId + ' in [' + [...themes].join(', ') + ']');
  }
}
if (crossTheme === 0) {
  console.log('✅ Zero cross-theme eventIds in text-pool.json');
} else {
  console.log('❌ ' + crossTheme + ' cross-theme eventIds remaining');
}

// Validate: themes.json boosted events have text-pool coverage
console.log('');
console.log('--- Theme Boosted Coverage ---');
let totalBoosted = 0;
let coveredBoosted = 0;
for (const theme of themes) {
  const pool = outputByTheme[theme.id] || [];
  const boosted = theme.eventPool?.boosted || [];
  totalBoosted += boosted.length;
  for (const evId of boosted) {
    const count = pool.filter(t => {
      const ids = (t.eventId || '').split(',').map(s => s.trim());
      return ids.includes(evId);
    }).length;
    if (count >= 3) {
      coveredBoosted++;
    } else {
      console.log('  ⚠ ' + theme.id + ' boosted ' + evId + ': only ' + count + ' texts');
    }
  }
}
console.log('Boosted event coverage: ' + coveredBoosted + '/' + totalBoosted + ' have ≥3 texts');

// Validate: all themeIds present
const poolIds = Object.keys(outputByTheme).sort();
const themeIds = themes.map(t => t.id).sort();
const missing = themeIds.filter(id => !poolIds.includes(id));
if (missing.length === 0) {
  console.log('✅ All ' + themeIds.length + ' themes have text-pool entries');
} else {
  console.log('❌ Missing theme pools: ' + missing.join(', '));
}

// Validate: themeId field within each text matches pool key
let themeIdMismatch = 0;
for (const [themeId, texts] of Object.entries(outputByTheme)) {
  for (const t of texts) {
    if (t.themeId !== themeId) {
      themeIdMismatch++;
      if (themeIdMismatch <= 5) {
        console.log('  ❌ MISMATCH: ' + t.textId + ' themeId=' + t.themeId + ' in pool ' + themeId);
      }
    }
  }
}
if (themeIdMismatch === 0) {
  console.log('✅ All texts have themeId matching their pool key');
}

// Per-theme summary
console.log('');
console.log('--- Per-Theme Summary ---');
for (const theme of themes.sort((a, b) => a.id.localeCompare(b.id))) {
  const pool = outputByTheme[theme.id] || [];
  const eventIds = [...new Set(pool.map(t => t.eventId))].filter(Boolean).sort();
  const boosted = theme.eventPool?.boosted || [];
  console.log('  ' + theme.id + ': ' + pool.length + ' texts, ' + eventIds.length + ' events, ' + boosted.length + ' boosted');
}

console.log('');
console.log('Done. text-pool.json + themes.json rebuilt.');
