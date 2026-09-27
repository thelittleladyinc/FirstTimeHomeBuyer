#!/usr/bin/env node
// Maintenance helper for data/dpa-programs.json (no dependencies, Node 18+).
//
//   node scripts/dpa-programs.mjs check                 validate the file; list programs due for re-verification
//   node scripts/dpa-programs.mjs verified <id> [...]   after re-checking a program's official sources,
//                                                       set its last_verified (and the file's last_reviewed) to today
//   node scripts/dpa-programs.mjs verified --all        same, for every program (only after checking them all)
//
// `check` exits 1 on a structural problem so it can gate a commit.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'dpa-programs.json');
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OFFICIAL = /^https:\/\/([a-z0-9-]+\.)*(chfainfo\.com|chaconline\.org|hud\.gov|va\.gov|usda\.gov|larimer\.gov|greeleygov\.com|fcgov\.com|colorado\.gov|weld\.gov|denvergov\.org|lovelandhousing\.org|greeleyhabitat\.org|fortcollinshabitat\.org|lovelandhabitat\.org)\//;
const today = () => new Date().toISOString().slice(0, 10);

export function validate(data) {
  const errors = [];
  if (!data || !Array.isArray(data.programs)) return ['programs[] is missing'];
  const ids = new Set();
  const areaKeys = new Set(Object.keys(data.areas || {}));
  const occKeys = new Set(Object.keys(data.occupations || {}));
  for (const p of data.programs) {
    const at = `program "${p.id || '?'}"`;
    for (const k of ['id', 'name', 'administrator', 'type', 'who_its_for', 'url', 'last_verified']) {
      if (!p[k] || typeof p[k] !== 'string') errors.push(`${at}: ${k} is required`);
    }
    if (ids.has(p.id)) errors.push(`${at}: duplicate id`);
    ids.add(p.id);
    if (p.last_verified && !ISO.test(p.last_verified)) errors.push(`${at}: last_verified must be YYYY-MM-DD`);
    if (!Array.isArray(p.key_rules) || !p.key_rules.length) errors.push(`${at}: key_rules[] is required`);
    if (!Array.isArray(p.sources) || !p.sources.length) errors.push(`${at}: sources[] is required`);
    for (const u of [p.url, ...(p.sources || []), p.income_limit && p.income_limit.source].filter(Boolean)) {
      if (!OFFICIAL.test(u)) errors.push(`${at}: ${u} is not on an official administrator domain (edit OFFICIAL in this script if a new official domain is needed)`);
    }
    if (p.income_limit && p.income_limit.as_of && !ISO.test(p.income_limit.as_of)) errors.push(`${at}: income_limit.as_of must be YYYY-MM-DD`);
    const m = p.match || {};
    for (const a of m.areas || []) if (!areaKeys.has(a)) errors.push(`${at}: unknown area "${a}"`);
    for (const a of m.exclude_areas || []) if (!areaKeys.has(a)) errors.push(`${at}: unknown area "${a}"`);
    for (const o of m.occupations || []) if (!occKeys.has(o)) errors.push(`${at}: unknown occupation "${o}"`);
  }
  return errors;
}

export function stale(data, now = today(), days = data.review_every_days || 31) {
  const cutoff = Date.parse(now) - days * 86400e3;
  return data.programs.filter((p) => Date.parse(p.last_verified) < cutoff);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  if (cmd === 'check' || !cmd) {
    const errors = validate(data);
    errors.forEach((e) => console.error('ERROR ' + e));
    const due = stale(data);
    console.log(`${data.programs.length} programs, last reviewed ${data.last_reviewed}.`);
    if (due.length) {
      console.log(`${due.length} due for re-verification (older than ${data.review_every_days || 31} days):`);
      for (const p of due) console.log(`  - ${p.id} (last verified ${p.last_verified})\n      ${p.sources.join('\n      ')}`);
    } else console.log('All programs verified within the review window.');
    process.exit(errors.length ? 1 : 0);
  }
  if (cmd === 'verified') {
    const all = rest.includes('--all');
    const ids = new Set(rest.filter((x) => x !== '--all'));
    if (!all && !ids.size) { console.error('Name the program ids you re-checked, or --all.'); process.exit(2); }
    const known = new Set(data.programs.map((p) => p.id));
    const unknown = [...ids].filter((id) => !known.has(id));
    if (unknown.length) { console.error('Unknown id(s): ' + unknown.join(', ')); process.exit(2); }
    const d = today();
    for (const p of data.programs) if (all || ids.has(p.id)) p.last_verified = d;
    data.last_reviewed = d;
    const errors = validate(data);
    if (errors.length) { errors.forEach((e) => console.error('ERROR ' + e)); process.exit(1); }
    writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
    console.log(`Marked ${all ? 'all programs' : [...ids].join(', ')} verified on ${d}.`);
    return;
  }
  console.error('Usage: node scripts/dpa-programs.mjs check | verified <id...> | verified --all');
  process.exit(2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main(process.argv.slice(2));
