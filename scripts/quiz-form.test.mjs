// Run: node --test scripts/*.test.mjs
// The quiz form's contract with the command-center receiver (lib/quiz-lead.js) and its
// lender-intro card (lib/lender-handoff.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(readFileSync(new URL('../data/dpa-programs.json', import.meta.url), 'utf8'));

function selectOptions(name) {
  const m = html.match(new RegExp(`<select name="${name}"[^>]*>([\\s\\S]*?)</select>`));
  assert.ok(m, `select ${name} exists`);
  return [...m[1].matchAll(/<option value="([^"]*)"/g)].map((x) => x[1]);
}

test('preApproved sends yes / no / unsure and is required', () => {
  assert.deepEqual(selectOptions('preApproved'), ['', 'yes', 'no', 'unsure']);
  assert.match(html, /<select name="preApproved" required/);
});

test('targetArea options match the areas in the data file', () => {
  const opts = selectOptions('targetArea').filter(Boolean);
  assert.deepEqual(opts.sort(), Object.keys(data.areas).sort());
});

test('occupation options match the occupations in the data file', () => {
  const opts = selectOptions('occupation').filter(Boolean);
  assert.deepEqual(opts.sort(), Object.keys(data.occupations).sort());
});

test('hidden area and matched_programs fields are in the form', () => {
  assert.match(html, /<input type="hidden" name="area" id="noco-area"/);
  assert.match(html, /<input type="hidden" name="matched_programs"/);
});

test('no new field name looks like a consent field to the receiver', () => {
  // lib/quiz-lead.js treats any key matching this as an SMS-consent answer.
  const CONSENT_KEY = /(consent|opt[-_ ]?in|sms|agree|tcpa)/i;
  for (const k of ['preApproved', 'targetArea', 'occupation', 'area', 'matched_programs']) assert.ok(!CONSENT_KEY.test(k), k);
});

// Runs only where the command-center repo is checked out next to this one.
const CC = new URL('../../bold-collective-command-center/lib/lender-handoff.js', import.meta.url);
test('command center reads the preApproved values as intended', { skip: !(existsSync(CC) && /preApprovalStatus/.test(readFileSync(CC, 'utf8'))) && 'command-center checkout with lender-handoff not found' }, () => {
  const out = execFileSync(process.execPath, ['-e',
    `const { preApprovalStatus } = require(${JSON.stringify(CC.pathname)});` +
    `console.log(JSON.stringify(['yes','no','unsure'].map(preApprovalStatus)))`]).toString();
  assert.deepEqual(JSON.parse(out), ['yes', 'no', 'unknown']);
});
