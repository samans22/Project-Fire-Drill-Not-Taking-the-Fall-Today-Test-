/**
 * rebuild-from-csv.js — v0.9.1.2 从 CSV 重建 text-pool.json
 * 严格遵循 CSV 中的 themeId ↔ eventId 映射
 * N_ 前缀和空 eventId 分配至对应主题的 boosted events
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

// Build theme → boosted events map (using themes.json IDs)
const themeBoosted = {};
for (const t of themes) {
  themeBoosted[t.id] = t.eventPool?.boosted || [];
}

// Proper CSV parser (handles quoted fields with embedded commas)
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

// Parse all texts from CSV
const allTexts = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (cols.length < 16) continue;

  const csvThemeId = cols[1];
  const newThemeId = KEY_MAP[csvThemeId] || csvThemeId;
  const csvEventId = cols[3];
  const textId = cols[0];
  const text = cols[10];
  const feedback = cols[11];
  const time = parseInt(cols[12]) || 0;
  const budget = parseInt(cols[13]) || 0;
  const satisfaction = parseInt(cols[14]) || 0;
  const risk = parseInt(cols[15]) || 0;
  // Fixed formula: risk increase reduces composite
  const compositeScore = (time + budget + satisfaction) - risk;
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

// Group by new themeId, separate real eventIds from orphans
const byTheme = {};
for (const t of allTexts) {
  if (!byTheme[t.newThemeId]) byTheme[t.newThemeId] = { real: [], orphans: [] };
  if (t.csvEventId && !t.csvEventId.startsWith('N_') && t.csvEventId.trim() !== '') {
    byTheme[t.newThemeId].real.push(t);
  } else {
    byTheme[t.newThemeId].orphans.push(t);
  }
}

// Assign orphans to boosted events
const realEventIds = new Set(events.map(e => e.eventId));
let assignedOrphans = 0;
let unassignedOrphans = 0;

for (const [themeId, groups] of Object.entries(byTheme)) {
  const boosted = themeBoosted[themeId] || [];
  const orphans = groups.orphans;

  if (orphans.length === 0) continue;

  if (boosted.length === 0) {
    unassignedOrphans += orphans.length;
    continue;
  }

  // Group N_ orphans by prefix (e.g., N_K01, N_K02 → prefix N_K)
  const nGroups = {};
  const emptyOrphans = [];
  for (const o of orphans) {
    if (o.csvEventId && o.csvEventId.startsWith('N_')) {
      const prefix = o.csvEventId.replace(/\d+$/, ''); // N_K from N_K01
      if (!nGroups[prefix]) nGroups[prefix] = [];
      nGroups[prefix].push(o);
    } else {
      emptyOrphans.push(o);
    }
  }

  // Assign each N_ group to one boosted event
  const nPrefixes = Object.keys(nGroups).sort();
  for (let gi = 0; gi < nPrefixes.length; gi++) {
    const targetEvent = boosted[gi % boosted.length];
    for (const o of nGroups[nPrefixes[gi]]) {
      o.csvEventId = targetEvent;
      assignedOrphans++;
    }
  }

  // Assign empty orphans round-robin across boosted events
  for (let ei = 0; ei < emptyOrphans.length; ei++) {
    emptyOrphans[ei].csvEventId = boosted[ei % boosted.length];
    assignedOrphans++;
  }
}

// Build final text-pool.json structure
const outputByTheme = {};
let total = 0;

for (const [themeId, groups] of Object.entries(byTheme)) {
  const allThemeTexts = [...groups.real, ...groups.orphans];
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

// ========== Summary ==========
console.log('========================================');
console.log('  v0.9.1.2 text-pool.json Rebuild');
console.log('========================================');
console.log('Total texts: ' + total);
console.log('Orphans assigned to boosted events: ' + assignedOrphans);
if (unassignedOrphans > 0) console.log('Orphans unassigned (no boosted): ' + unassignedOrphans);
console.log('');

// Validate theme ID alignment
const poolIds = Object.keys(outputByTheme).sort();
const themeIds = themes.map(t => t.id).sort();
const missing = themeIds.filter(id => !poolIds.includes(id));
const extra = poolIds.filter(id => !themeIds.includes(id));
if (missing.length === 0) console.log('PASS: All ' + themeIds.length + ' theme IDs present');
else console.log('FAIL: Missing themes: ' + missing.join(', '));
if (extra.length === 0) console.log('PASS: No extra theme IDs');
else console.log('WARN: Extra themes: ' + extra.join(', '));

// Check for remaining orphans
let remainingOrphans = 0;
for (const [themeId, texts] of Object.entries(outputByTheme)) {
  for (const t of texts) {
    const ids = (t.eventId || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0 || ids.every(id => !realEventIds.has(id))) {
      remainingOrphans++;
      if (remainingOrphans <= 5) console.log('  ORPHAN: ' + t.textId + ' eventId=[' + t.eventId + '] in ' + themeId);
    }
  }
}
if (remainingOrphans === 0) console.log('PASS: 0 orphan eventIds');
else console.log('FAIL: ' + remainingOrphans + ' orphan eventIds remaining');

// Check no cross-theme eventId contamination
console.log('');
console.log('--- Cross-theme eventId check ---');
const eventThemeMap = {}; // eventId → [themes that have it]
for (const [themeId, texts] of Object.entries(outputByTheme)) {
  for (const t of texts) {
    if (!t.eventId || t.eventId.trim() === '') continue;
    if (!eventThemeMap[t.eventId]) eventThemeMap[t.eventId] = new Set();
    eventThemeMap[t.eventId].add(themeId);
  }
}
let crossTheme = 0;
for (const [evId, themes] of Object.entries(eventThemeMap)) {
  if (themes.size > 1) {
    crossTheme++;
    console.log('  CROSS: ' + evId + ' in themes: ' + [...themes].join(', '));
  }
}
if (crossTheme === 0) console.log('PASS: Each eventId appears in exactly 1 theme');
else console.log('INFO: ' + crossTheme + ' eventIds appear in multiple themes (may be intentional)');

// Per-theme counts
console.log('');
console.log('--- Per-Theme Text Counts ---');
for (const [theme, texts] of Object.entries(outputByTheme).sort()) {
  const eventIds = [...new Set(texts.map(t => t.eventId))].filter(Boolean).sort();
  const orphans = texts.filter(t => {
    const ids = (t.eventId || '').split(',').map(s => s.trim()).filter(Boolean);
    return ids.length === 0 || ids.every(id => !realEventIds.has(id));
  }).length;
  console.log('  ' + theme + ': ' + texts.length + ' texts, ' + eventIds.length + ' events' + (orphans > 0 ? ' (' + orphans + ' orphans!)' : ''));
}

console.log('');
console.log('Done.');
