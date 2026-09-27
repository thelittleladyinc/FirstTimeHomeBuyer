'use strict';
// Run: node --test tests/
// assets/quiz-capture.js (funnel events + partial-quiz beacon) and the quiz
// markup in index.html. No network: sendBeacon, fbq and gtag are fakes.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const qc = require('../assets/quiz-capture.js');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const privacy = fs.readFileSync(path.join(ROOT, 'privacy-policy.html'), 'utf8');
const script = fs.readFileSync(path.join(ROOT, 'assets', 'quiz-capture.js'), 'utf8');

// ---------------------------------------------------------------- fake DOM
function fakeForm(initial = {}) {
  const listeners = {};
  const elements = {};
  for (const k of ['firstName', 'lastName', 'email', 'phone', 'timeline', 'ownHome', 'veteran', 'credit', 'downPayment', 'preApproved', 'hp_website', 'consent']) {
    elements[k] = { name: k, value: initial[k] || '' };
  }
  elements.consent.value = 'yes'; // a checkbox's value is fixed; it must never be read
  return {
    elements,
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    fire(type, name, value) {
      if (name && value !== undefined) elements[name].value = value;
      for (const fn of listeners[type] || []) fn({ type, target: name ? elements[name] : null });
    },
  };
}
function fakeWorld({ search = '?utm_source=facebook&utm_campaign=rto&fbclid=abc', beacon = true } = {}) {
  const events = [];
  const beacons = [];
  const timers = [];
  const winListeners = {};
  const docListeners = {};
  const win = {
    location: { search, pathname: '/', hash: '#quiz' },
    URLSearchParams,
    navigator: { sendBeacon: beacon ? (url, body) => { beacons.push({ url, body: Object.fromEntries(body) }); return true; } : undefined },
    fbq: (...a) => events.push(['fbq', ...a]),
    gtag: (...a) => events.push(['gtag', ...a]),
    addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
    setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimeout: (t) => { if (t) t.cleared = true; },
  };
  const doc = { visibilityState: 'visible', addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); } };
  return {
    win, doc, events, beacons, timers,
    pagehide() { for (const fn of winListeners.pagehide || []) fn(); },
    hide() { doc.visibilityState = 'hidden'; for (const fn of docListeners.visibilitychange || []) fn(); },
    runIdle() { const t = timers.filter((x) => !x.cleared).pop(); if (t) { t.cleared = true; t.fn(); } },
  };
}
const setup = (opts) => {
  const w = fakeWorld(opts);
  const form = fakeForm();
  const h = qc.init({ win: w.win, doc: w.doc, form, setTimeout: w.win.setTimeout, clearTimeout: w.win.clearTimeout });
  return { w, form, h };
};
const names = (events) => events.map((e) => (e[0] === 'fbq' ? `fbq:${e[2]}` : `gtag:${e[2]}`));

// ---------------------------------------------------------------- helpers
test('valid email / phone formats', () => {
  assert.equal(qc.validEmail('ana@example.com'), true);
  assert.equal(qc.validEmail('ana@example'), false);
  assert.equal(qc.validEmail('ana'), false);
  assert.equal(qc.validPhone('(970) 555-0123'), true);
  assert.equal(qc.validPhone('+1 970 555 0123'), true);
  assert.equal(qc.validPhone('555-0123'), false);
  assert.equal(qc.validPhone('(070) 555-0123'), false);
});

test('buildPartial: nothing without a valid contact; only touched answers; never consent; UTM kept', () => {
  assert.equal(qc.buildPartial({ firstName: 'Ana', email: 'ana@' }, {}, {}), null);
  const p = qc.buildPartial(
    { firstName: 'Ana', email: 'ana@example.com', phone: '12', timeline: 'ASAP', credit: 'Excellent (720+)', consent: 'yes' },
    { timeline: true },
    { utm: qc.utmFrom('?utm_source=facebook&gclid=x'), page: '/#quiz' },
  );
  assert.deepEqual(p, { firstName: 'Ana', email: 'ana@example.com', timeline: 'ASAP', utm_source: 'facebook', page: '/#quiz' });
});

// ---------------------------------------------------------------- funnel events
test('ViewContent on quiz start, QuizStarted once a valid contact is typed, NotPreApproved on "Not yet"', () => {
  const { w, form } = setup();
  form.fire('focusin', 'firstName');
  assert.deepEqual(names(w.events), ['fbq:ViewContent', 'gtag:quiz_start']);
  form.fire('input', 'email', 'ana@exam');
  assert.equal(names(w.events).length, 2, 'no QuizStarted for an invalid email');
  form.fire('input', 'email', 'ana@example.com');
  assert.deepEqual(names(w.events).slice(2), ['fbq:QuizStarted', 'gtag:quiz_contact_entered']);
  form.fire('change', 'preApproved', 'Working on it');
  assert.equal(names(w.events).length, 4);
  form.fire('change', 'preApproved', 'Not yet');
  form.fire('change', 'preApproved', 'Not yet');
  assert.deepEqual(names(w.events).slice(4), ['fbq:NotPreApproved', 'gtag:not_pre_approved'], 'fires once');
  // Each event fires once however much the visitor types.
  form.fire('input', 'phone', '9705550123');
  form.fire('focusin', 'lastName');
  assert.equal(w.events.length, 6);
  assert.equal(w.events.filter((e) => e[2] === 'Lead').length, 0, 'Lead only on a confirmed full submit (index.html)');
});

test('no personal data in any pixel / gtag parameter', () => {
  const { w, form } = setup();
  form.fire('input', 'firstName', 'Ana');
  form.fire('input', 'lastName', 'Ruiz');
  form.fire('input', 'email', 'ana@example.com');
  form.fire('input', 'phone', '970-555-0123');
  form.fire('change', 'preApproved', 'Not yet');
  const flat = JSON.stringify(w.events);
  for (const pii of ['Ana', 'Ruiz', 'example.com', '555', '0123', 'Not yet']) assert.ok(!flat.includes(pii), `event params leak ${pii}`);
  for (const key of ['"em"', '"ph"', '"fn"', '"ln"', '"email"', '"phone"']) assert.ok(!flat.includes(key), `event params carry ${key}`);
});

// ---------------------------------------------------------------- partial capture
test('idle 60 s after a valid email -> one beacon with what was typed; identical data not resent', () => {
  const { w, form } = setup();
  form.fire('input', 'firstName', 'Ana');
  assert.equal(w.timers.filter((t) => !t.cleared).length, 0, 'no timer before a valid contact');
  form.fire('input', 'email', 'ana@example.com');
  form.fire('change', 'timeline', 'ASAP');
  const live = w.timers.filter((t) => !t.cleared);
  assert.equal(live.length, 1);
  assert.equal(live[0].ms, 60000);
  w.runIdle();
  assert.equal(w.beacons.length, 1);
  assert.equal(w.beacons[0].url, qc.PARTIAL_URL);
  assert.deepEqual(w.beacons[0].body, { firstName: 'Ana', email: 'ana@example.com', timeline: 'ASAP', utm_source: 'facebook', utm_campaign: 'rto', page: '/#quiz', trigger: 'idle' });
  assert.equal(w.beacons[0].body.consent, undefined, 'consent is never sent with a partial');
  w.pagehide();
  assert.equal(w.beacons.length, 1, 'nothing new -> no second beacon');
  form.fire('input', 'phone', '970-555-0123');
  w.hide();
  assert.equal(w.beacons.length, 2);
  assert.equal(w.beacons[1].body.phone, '970-555-0123');
  assert.equal(w.beacons[1].body.trigger, 'hidden');
});

test('leaving without a valid contact sends nothing', () => {
  const { w, form } = setup();
  form.fire('input', 'firstName', 'Ana');
  form.fire('input', 'email', 'ana@');
  w.pagehide();
  w.hide();
  assert.equal(w.beacons.length, 0);
});

test('after submit: no beacon, idle timer cancelled', () => {
  const { w, form } = setup();
  form.fire('input', 'email', 'ana@example.com');
  form.fire('submit');
  assert.ok(w.timers.every((t) => t.cleared));
  w.pagehide();
  w.hide();
  assert.equal(w.beacons.length, 0);
});

test('honeypot value is passed through (the receiver drops it)', () => {
  const { w, form } = setup();
  form.elements.hp_website.value = 'http://spam';
  form.fire('input', 'email', 'bot@example.com');
  w.pagehide();
  assert.equal(w.beacons[0].body.hp_website, 'http://spam');
});

// ---------------------------------------------------------------- markup
test('SMS consent box is UNTICKED by default with the required wording', () => {
  const box = /<input[^>]*id="noco-consent"[^>]*>/.exec(html)[0];
  assert.ok(!/\bchecked\b/.test(box), 'consent checkbox must not be pre-checked');
  assert.match(box, /name="consent" value="yes"/);
  assert.ok(html.includes('Yes, text me about homes and programs. Msg &amp; data rates may apply. Reply STOP to opt out. Consent is not required to get your results.'));
  assert.ok(!/\brequired\b/.test(box), 'consent is optional');
});

test('form posts to the Command Center; save notice by the email field; pre-approved question; honeypot', () => {
  assert.match(html, /<form id="noco-quiz" method="POST" action="https:\/\/bold-collective-command-center\.onrender\.com\/api\/quiz-lead"/);
  assert.ok(html.includes("We save your answers as you go so you don't lose your progress."));
  assert.match(html, /<select name="preApproved"[\s\S]*?<option value="Not yet">/);
  assert.match(html, /name="hp_website" tabindex="-1"/);
  assert.match(html, /<script src="\/assets\/quiz-capture\.js" defer><\/script>/);
  assert.ok(qc.PARTIAL_URL.endsWith('/api/quiz-lead/partial'));
});

test('pixels: the right Meta pixel, no Advanced Matching, no hacked pixel', () => {
  const all = html + script;
  assert.ok(!all.includes('1292637128972060'));
  assert.match(html, /fbq\('init', '785995940287531'\);/, 'init with no user-data argument');
  assert.ok(!/fbq\('init',[^)]*,/.test(html), 'no Advanced Matching parameters');
  assert.ok(!/\b(em|ph|fn|ln|external_id)\s*:/.test(script), 'no matching keys in event code');
  // Lead fires only once the receiver confirms { ok: true }.
  assert.match(html, /data\.ok !== true\) return;[\s\S]*fbq\('track', 'Lead'/);
});

test('privacy policy explains saving as you go, the unticked text consent and the phone lookup', () => {
  assert.ok(privacy.includes('We save your answers as you go.'));
  assert.ok(privacy.includes('Consent is not required to get your results.'));
  assert.ok(privacy.includes('unchecked until you check it'));
  assert.ok(privacy.includes('never for automated or marketing texts'));
  assert.ok(!privacy.includes('By leaving that box checked'));
});
