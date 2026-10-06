'use strict';
// Run: node --test tests/
// Google's tag library (gtag.js) must load once per page, with both the
// Analytics (GA4) and the Ads ids configured on that one load. Loading it twice
// (once per id) downloads the library twice and runs two copies of gtag().
// Comments are stripped first, so only code that actually runs is counted.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ANALYTICS = 'G-76NN5P55H2';
const ADS = 'AW-16452139344';
const PAGES = [
  'index.html',
  'blog/index.html',
  'blog/june-2026-noco-first-time-buyers/index.html',
  'privacy-policy.html',
  'disclaimer.html',
];

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(full);
    else if (/\.html$/i.test(e.name)) yield path.relative(ROOT, full).split(path.sep).join('/');
  }
}
function code(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
}
const LOADER = /<script\b[^>]*\bsrc=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=([^"'&]+)[^"']*["'][^>]*>/g;
const idx = (src, re) => src.search(re); // re is never global, so there is no lastIndex state to leak between pages

// Every page that loads the library, found by scanning the repo, so a page added
// later is held to the same rule. The five known pages must be among them.
const loaders = [...htmlFiles(ROOT)].filter((rel) => code(rel).includes('googletagmanager.com/gtag/js'));

test('the five known pages load the Google tag (so this test cannot pass by finding nothing)', () => {
  for (const rel of PAGES) assert.ok(loaders.includes(rel), `${rel} should load the Google tag`);
});

for (const rel of loaders) {
  test(`${rel}: one gtag/js loader, one gtag() definition, one gtag('js'), and both ids configured`, () => {
    const src = code(rel);

    const tags = [...src.matchAll(LOADER)];
    assert.equal(tags.length, 1, `${rel} loads gtag/js ${tags.length} times; it must be exactly once`);
    assert.equal(tags[0][1], ANALYTICS, 'the one loader uses the Analytics id');
    assert.match(tags[0][0], /\basync\b/, 'the loader stays async');

    assert.equal((src.match(/\bfunction gtag\s*\(/g) || []).length, 1, 'one definition of gtag()');
    assert.equal((src.match(/\bgtag\(\s*['"]js['"]/g) || []).length, 1, "one gtag('js', ...) call");

    const configs = [...src.matchAll(/\bgtag\(\s*['"]config['"]\s*,\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    assert.equal(configs.filter((c) => c === ANALYTICS).length, 1, `${ANALYTICS} configured once`);
    assert.equal(configs.filter((c) => c === ADS).length, 1, `${ADS} configured once`);

    // The library is declared first, then gtag() is defined, then 'js', then the configs.
    const at = [idx(src, new RegExp(LOADER.source)), idx(src, /\bfunction gtag\s*\(/), idx(src, /\bgtag\(\s*['"]js['"]/),
      idx(src, new RegExp(`gtag\\(\\s*['"]config['"]\\s*,\\s*['"]${ANALYTICS}['"]`)),
      idx(src, new RegExp(`gtag\\(\\s*['"]config['"]\\s*,\\s*['"]${ADS}['"]`))];
    assert.ok(at.every((n) => n >= 0), 'every piece is present');
    assert.deepEqual([...at].sort((a, b) => a - b), at, 'order: loader, function gtag, js, config Analytics, config Ads');
  });
}

test('the Ads id is never used as a second loader on any page', () => {
  for (const rel of loaders) assert.ok(!code(rel).includes(`gtag/js?id=${ADS}`), rel);
});
