/**
 * validate-data.js — 数据完整性校验脚本
 * 检查所有数据文件的完整性和一致性
 * 用法: node tools/validate-data.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

function validate() {
  const tp = load('text-pool.json');
  const themes = load('themes.json');
  const events = load('events.json');
  const realEventIds = new Set(events.map(e => e.eventId));

  const results = { pass: [], fail: [], warn: [] };

  // Check 1: Theme ID alignment — text-pool.json vs themes.json
  const poolIds = new Set(Object.keys(tp.byTheme));
  for (const t of themes) {
    if (!poolIds.has(t.id)) results.fail.push('MISSING_POOL: theme "' + t.id + '" has no text pool');
  }
  for (const id of poolIds) {
    if (!themes.find(t => t.id === id)) results.fail.push('ORPHAN_POOL: text pool "' + id + '" has no theme');
  }
  if (results.fail.filter(f => f.startsWith('MISSING_POOL') || f.startsWith('ORPHAN_POOL')).length === 0) {
    results.pass.push('Theme ID alignment: ' + themes.length + '/' + themes.length + ' match');
  }

  // Check 2: Orphan eventIds
  let orphans = 0;
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      const ids = (t.eventId || '').split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0 || ids.every(id => !realEventIds.has(id))) {
        orphans++;
        if (orphans <= 5) results.fail.push('ORPHAN_EVENT: ' + t.textId + ' eventId="' + t.eventId + '" in ' + themeId);
      }
    }
  }
  if (orphans === 0) {
    results.pass.push('Orphan eventIds: 0');
  } else {
    results.fail.push('Orphan eventIds: ' + orphans + ' remaining');
  }

  // Check 3: Duplicates
  const seen = new Map();
  let dups = 0;
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      const key = themeId + '|' + t.text + '|' + JSON.stringify(t.effects) + '|' + t.eventId;
      if (seen.has(key)) {
        dups++;
        results.fail.push('DUPLICATE: ' + seen.get(key) + ' <-> ' + t.textId + ' in ' + themeId);
      } else {
        seen.set(key, t.textId);
      }
    }
  }
  if (dups === 0) {
    results.pass.push('Duplicates: 0');
  }

  // Check 4: Min texts per theme (≥ 17, or 0 if theme has no CSV events / no boosted pool)
  let thinThemes = 0;
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    const theme = themes.find(t => t.id === themeId);
    const hasBoosted = theme && theme.eventPool && theme.eventPool.boosted && theme.eventPool.boosted.length > 0;
    if (texts.length === 0 && !hasBoosted) {
      // Theme has no CSV events — should have 0 texts (all redistributed)
      continue;
    }
    if (texts.length < 17 && hasBoosted) {
      thinThemes++;
      results.fail.push('THIN_THEME: ' + themeId + ' has only ' + texts.length + ' texts (need ≥ 17)');
    }
  }
  if (thinThemes === 0) {
    results.pass.push('Min texts/theme: all ≥ 17 (or 0 for no-CSV-event themes)');
  }

  // Check 5: Coverage per boosted event (≥ 3 texts per boosted event)
  let lowCoverage = 0;
  for (const theme of themes) {
    const pool = tp.byTheme[theme.id];
    if (!pool) continue;
    const boosted = theme.eventPool?.boosted || [];
    for (const evId of boosted) {
      const count = pool.filter(t => {
        const ids = (t.eventId || '').split(',').map(s => s.trim());
        return ids.includes(evId);
      }).length;
      if (count < 3) {
        lowCoverage++;
        results.warn.push('LOW_COVERAGE: ' + theme.id + ' boosted event ' + evId + ' has ' + count + ' texts (need ≥ 3)');
      }
    }
  }
  if (lowCoverage === 0) {
    results.pass.push('Boosted event coverage: all ≥ 3 texts');
  }

  // Check 6: Effect value range [-5, +5]
  let rangeViolations = 0;
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      for (const [stat, val] of Object.entries(t.effects)) {
        if (val < -5 || val > 5) {
          rangeViolations++;
          results.fail.push('EFFECT_RANGE: ' + t.textId + ' ' + stat + '=' + val + ' (outside [-5,+5])');
        }
      }
    }
  }
  if (rangeViolations === 0) {
    results.pass.push('Effect range: all within [-5, +5]');
  }

  // Check 7: Composite consistency
  let compositeErrors = 0;
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      const e = t.effects;
      const calc = (e.time || 0) + (e.budget || 0) + (e.satisfaction || 0) - (e.risk || 0);
      if (calc !== t.compositeScore) {
        compositeErrors++;
        results.fail.push('COMPOSITE_MISMATCH: ' + t.textId + ' stored=' + t.compositeScore + ' calculated=' + calc);
      }
    }
  }
  if (compositeErrors === 0) {
    results.pass.push('Composite scores: all consistent');
  }

  // Check 8: Required fields
  const REQUIRED = ['textId', 'themeId', 'eventId', 'text', 'feedback', 'effects', 'compositeScore'];
  let missingFields = 0;
  for (const [themeId, texts] of Object.entries(tp.byTheme)) {
    for (const t of texts) {
      for (const field of REQUIRED) {
        if (t[field] === undefined || t[field] === null) {
          missingFields++;
          results.fail.push('MISSING_FIELD: ' + t.textId + ' missing "' + field + '"');
        }
      }
    }
  }
  if (missingFields === 0) {
    results.pass.push('Required fields: all present');
  }

  // Check 9: themes.json boosted events exist in events.json
  let badBoosted = 0;
  for (const theme of themes) {
    const boosted = theme.eventPool?.boosted || [];
    for (const evId of boosted) {
      if (!realEventIds.has(evId)) {
        badBoosted++;
        results.fail.push('BAD_BOOSTED: ' + theme.id + ' boosted "' + evId + '" not in events.json');
      }
    }
  }
  if (badBoosted === 0) {
    results.pass.push('Boosted event IDs: all valid');
  }

  // Check 10: _total matches actual count
  let actualTotal = 0;
  for (const texts of Object.values(tp.byTheme)) {
    actualTotal += texts.length;
  }
  if (tp._total === actualTotal) {
    results.pass.push('_total field: ' + tp._total + ' matches actual count');
  } else {
    results.fail.push('TOTAL_MISMATCH: _total=' + tp._total + ' actual=' + actualTotal);
  }

  // ========== Report ==========
  console.log('========================================');
  console.log('  Data Validation Report');
  console.log('========================================');
  console.log('');

  console.log('--- PASS (' + results.pass.length + ') ---');
  results.pass.forEach(p => console.log('  ✅ ' + p));

  if (results.warn.length > 0) {
    console.log('');
    console.log('--- WARN (' + results.warn.length + ') ---');
    results.warn.forEach(w => console.log('  ⚠️  ' + w));
  }

  if (results.fail.length > 0) {
    console.log('');
    console.log('--- FAIL (' + results.fail.length + ') ---');
    results.fail.forEach(f => console.log('  ❌ ' + f));
  }

  console.log('');
  console.log('Result: ' + results.pass.length + ' passed, ' + results.warn.length + ' warnings, ' + results.fail.length + ' failures');

  const exitCode = results.fail.length > 0 ? 1 : 0;
  if (exitCode === 0) {
    console.log('✅ ALL CHECKS PASSED');
  } else {
    console.log('❌ SOME CHECKS FAILED');
  }
  process.exit(exitCode);
}

validate();
