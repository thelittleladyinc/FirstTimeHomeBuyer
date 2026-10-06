'use strict';
// Run: node --test tests/
// What was retired stays retired: the prebuilt React quiz (quiz/, redirected to the
// homepage quiz on 2026-09-24 and deleted on 2026-10-05), the former co-agent (#25)
// and the former lender (#26). Netlify publishes the repo root, so every text file
// here is a published page. The retired strings are assembled from pieces so this
// file does not itself match a plain text search for them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SELF = path.relative(ROOT, __filename);
const TEXT = /\.(html|js|mjs|css|json|md|txt|xml|toml|ya?ml)$/i;
const RETIRED = {
  'co-agent name': new RegExp(['ken', 'dra'].join(''), 'i'),
  'co-agent surname': new RegExp(['baj', 'car'].join(''), 'i'),
  'co-agent phone': new RegExp('(?<!\\d)' + ['\\(?970\\)?', '571', '0525'].join('[-. ]*')),
  'lender surname': new RegExp(['gil', 'more'].join(''), 'i'),
  'lender NMLS': new RegExp('(?<!\\d)' + ['205', '3641'].join('') + '(?!\\d)'),
  'lender phone (any 720-605 line)': new RegExp('(?<!\\d)' + ['\\(?720\\)?', '605', '\\d{4}'].join('[-. ]*')),
};

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (TEXT.test(e.name)) yield path.relative(ROOT, full);
  }
}

test('the dead React quiz is gone and its old URLs still 301 to the homepage quiz', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'quiz')), 'quiz/ must not come back: its lead capture had no backend');
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  for (const from of ['/quiz', '/quiz/\\*']) {
    assert.match(toml, new RegExp(`\\[\\[redirects\\]\\]\\s*from = "${from}"\\s*to = "/#quiz"\\s*status = 301\\s*force = true`), `redirect for ${from}`);
  }
});

test('the former co-agent and the former lender appear in no published file', () => {
  const hits = [];
  for (const rel of walk(ROOT)) {
    if (rel === SELF) continue;
    fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').forEach((line, i) => {
      for (const [what, re] of Object.entries(RETIRED)) if (re.test(line)) hits.push(`${rel}:${i + 1} (${what})`);
    });
  }
  assert.deepEqual(hits, [], `Retired name or number still present:\n${hits.join('\n')}`);
});

test('the patterns catch each spelling and leave Christine, places and the 555 placeholder alone', () => {
  const any = (s) => Object.values(RETIRED).some((re) => re.test(s));
  for (const s of [['Ken', 'dra'].join(''), ['BAJ', 'CAR'].join(''), ['(970) 571', '0525'].join('-'), ['970.571', '0525'].join('.'),
    ['Gil', 'more'].join(''), `NMLS #${['205', '3641'].join('')}`, ['720-605', '4757'].join('-'), ['(720) 605', '4757'].join('-'), ['720605', '4757'].join('')]) assert.ok(any(s), s);
  for (const s of ['Christine Gwinnup', '303-709-4262', '(970) 555-0123', 'Weston, CO', 'Gilcrest', '1720605123456']) assert.ok(!any(s), s);
});
