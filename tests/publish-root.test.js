'use strict';
// Run: node --test tests/
// Netlify publishes the repository root, so every file here can be fetched
// from owninnoco.com unless netlify.toml says otherwise. Internal files (the
// project notes, tests, scripts, docs, CI settings and netlify.toml itself)
// must answer 404; the pages and everything they load must stay reachable.
// The rules are matched the way Netlify matches them: an exact path, or a
// prefix ending in /* for everything under it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');

const rules = [...toml.matchAll(/^\[\[redirects\]\]\n((?:[ \t]*\w+[ \t]*=[^\n]*\n?)+)/gm)].map((m) => {
  const rule = {};
  for (const line of m[1].split('\n')) {
    const kv = /^\s*(\w+)\s*=\s*(.+?)\s*$/.exec(line);
    if (kv) rule[kv[1]] = JSON.parse(kv[2]);
  }
  return rule;
});
const hidden = rules.filter((r) => r.status === 404);
const matches = (from, url) => (from.endsWith('/*') ? url.startsWith(from.slice(0, -1)) : url === from);
const hiddenBy = (url) => hidden.find((r) => matches(r.from, url));

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(full);
    else yield '/' + path.relative(ROOT, full).split(path.sep).join('/');
  }
}
const INTERNAL_DIRS = ['/tests/', '/scripts/', '/docs/', '/.github/'];
const isInternal = (url) => /^\/[^/]+\.md$/i.test(url) || url === '/netlify.toml' || INTERNAL_DIRS.some((d) => url.startsWith(d));
const all = [...files(ROOT)];

test('the netlify.toml rules were read (so the checks below cannot pass by finding none)', () => {
  assert.ok(rules.length >= 2, 'the /quiz redirects are there');
  assert.ok(hidden.length >= 5, 'the 404 rules are there');
  for (const r of hidden) {
    assert.equal(r.force, true, `${r.from}: force = true, or the existing file would still be served`);
    assert.equal(r.to, '/404.html', `${r.from}: shows the 404 page`);
  }
  const page = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex">/);
});

test('every internal file answers 404', () => {
  const internal = all.filter(isInternal);
  for (const must of ['/README.md', '/CLAUDE.md', '/netlify.toml', '/tests/retired.test.js', '/scripts/dpa-programs.mjs', '/docs/scripts/SCRIPTS_PRINT_45SEC_2026-06-01.md', '/.github/workflows/tests.yml']) {
    assert.ok(internal.includes(must), `${must} is classed as internal`);
  }
  const open = internal.filter((url) => !hiddenBy(url));
  assert.deepEqual(open, [], `internal files still published:\n${open.join('\n')}`);
});

test('no public file is hidden: the pages, /assets/, /data/, robots.txt, sitemap.xml, llms.txt', () => {
  const pub = all.filter((url) => !isInternal(url));
  for (const must of ['/index.html', '/blog/index.html', '/privacy-policy.html', '/disclaimer.html', '/404.html', '/assets/tracking.js', '/assets/quiz-capture.js', '/data/dpa-programs.json', '/robots.txt', '/sitemap.xml', '/llms.txt']) {
    assert.ok(pub.includes(must), `${must} is public`);
  }
  const blocked = pub.filter((url) => hiddenBy(url));
  assert.deepEqual(blocked, [], `public files a 404 rule would hide:\n${blocked.join('\n')}`);
});

test('nothing a page loads or links to on this site is hidden', () => {
  const refs = new Set(['/', '/blog/', '/privacy-policy', '/disclaimer', '/sitemap.xml', '/robots.txt', '/llms.txt']);
  for (const url of all.filter((u) => u.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(ROOT, url), 'utf8');
    for (const m of html.matchAll(/(?:src|href)=["'](\/[^"'#?]*)/g)) refs.add(m[1]);
    for (const m of html.matchAll(/fetch\(\s*['"](\/[^'"#?]*)/g)) refs.add(m[1]);
    for (const m of html.matchAll(/https:\/\/(?:www\.)?owninnoco\.com(\/[^"'#?\s<]*)/g)) refs.add(m[1]);
  }
  assert.ok(refs.has('/data/dpa-programs.json'), 'the quiz program list is among the references');
  const blocked = [...refs].filter((url) => hiddenBy(url));
  assert.deepEqual(blocked, [], `a page uses a hidden path:\n${blocked.join('\n')}`);
});
