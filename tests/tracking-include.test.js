'use strict';
// Run: node --test tests/
// One tracking include for every page: assets/tracking.js loads Google's tag
// library (gtag.js) once with both the Analytics (GA4) and the Ads ids
// configured on that one load, and the Meta pixel. Pages load it with one
// <script src="/assets/tracking.js"></script> in <head> and carry no tracking
// code or ids of their own, so an id is changed in one place. HTML comments are
// stripped first, so only code that actually runs is counted.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ANALYTICS = 'G-76NN5P55H2';
const ADS = 'AW-16452139344';
const META_PIXEL = '785995940287531';
const INCLUDE_SRC = '/assets/tracking.js';
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
const INCLUDE_TAG = /<script\b[^>]*\bsrc=["']\/assets\/tracking\.js["'][^>]*>\s*<\/script>/g;
const include = fs.readFileSync(path.join(ROOT, 'assets', 'tracking.js'), 'utf8');

test('the five known pages load the tracking include once, in <head>, not async or deferred', () => {
  for (const rel of PAGES) {
    const src = code(rel);
    const tags = [...src.matchAll(INCLUDE_TAG)];
    assert.equal(tags.length, 1, `${rel} loads ${INCLUDE_SRC} ${tags.length} times; it must be exactly once`);
    assert.ok(tags[0].index < src.indexOf('</head>'), `${rel}: the include is inside <head>`);
    assert.doesNotMatch(tags[0][0], /\b(async|defer)\b/, `${rel}: gtag() and fbq() must exist before the page's own handlers run`);
  }
});

test('no page carries its own tracking code or ids (only the include does)', () => {
  const pasted = [
    /googletagmanager\.com\/gtag\/js/, /\bfunction gtag\s*\(/, /\bgtag\(\s*['"](?:js|config)['"]/,
    /connect\.facebook\.net\/[^"']*fbevents\.js/, /\bfbq\(\s*['"]init['"]/,
    new RegExp(ANALYTICS), new RegExp(ADS), new RegExp(META_PIXEL),
  ];
  for (const rel of htmlFiles(ROOT)) {
    const src = code(rel);
    for (const re of pasted) assert.doesNotMatch(src, re, `${rel} still pastes tracking code (${re}); use ${INCLUDE_SRC}`);
    assert.ok([...src.matchAll(INCLUDE_TAG)].length <= 1, `${rel} loads the include more than once`);
  }
});

test('the include: one gtag/js loader for the Analytics id, both ids configured once, the right Meta pixel', () => {
  assert.equal((include.match(/googletagmanager\.com\/gtag\/js\?id=/g) || []).length, 1, 'one gtag/js loader');
  assert.match(include, new RegExp(`var GA4 = '${ANALYTICS}';`));
  assert.match(include, new RegExp(`var ADS = '${ADS}';`));
  assert.match(include, new RegExp(`var META_PIXEL = '${META_PIXEL}';`));
  assert.ok(!include.includes(`gtag/js?id=${ADS}`), 'the Ads id is never a second loader');
  assert.ok(!include.includes('1292637128972060'), 'never the hacked pixel');
  assert.match(include, /w\.fbq\('init', META_PIXEL\);/, 'init with no user-data argument (no Advanced Matching)');
});

// Runs the include against a fake page: what it loads and what it queues.
function runInclude() {
  const appended = [];
  const inserted = [];
  const anchor = { parentNode: { insertBefore: (el) => inserted.push(el) } };
  const document = {
    head: { appendChild: (el) => appended.push(el) },
    createElement: (tag) => ({ tag }),
    getElementsByTagName: () => [anchor],
  };
  const window = {};
  vm.runInNewContext(include, { window, document });
  return { window, appended, inserted };
}

test('the include, run on a page: gtag.js once with both ids, gtag() and fbq() ready, one PageView', () => {
  const { window, appended, inserted } = runInclude();
  assert.equal(appended.length, 1, 'one script appended for Google');
  assert.equal(appended[0].tag, 'script');
  assert.equal(appended[0].src, `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS}`);
  assert.equal(appended[0].async, true);
  assert.equal(typeof window.gtag, 'function', 'window.gtag is defined for the page handlers');
  // Array.from: the arrays were made inside the vm, so copy them into this realm.
  const calls = Array.from(window.dataLayer, (args) => Array.from(args));
  assert.equal(calls.length, 3);
  assert.equal(calls[0][0], 'js');
  assert.deepEqual(calls.slice(1), [['config', ANALYTICS], ['config', ADS]]);
  // gtag.js reads Arguments objects from dataLayer, not arrays.
  assert.equal(Object.prototype.toString.call(window.dataLayer[1]), '[object Arguments]');

  assert.equal(inserted.length, 1, 'one script inserted for Meta');
  assert.equal(inserted[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.equal(inserted[0].async, true);
  assert.equal(typeof window.fbq, 'function', 'window.fbq is defined for the page handlers');
  assert.deepEqual(Array.from(window.fbq.queue, (args) => Array.from(args)), [['init', META_PIXEL], ['track', 'PageView']]);
});
