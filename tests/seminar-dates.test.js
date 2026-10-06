'use strict';
// Run: node --test tests/
// assets/seminar-dates.js (hides seminar dates that have passed) and the
// seminar list in index.html. No network, and no test reads the real clock:
// "today" is always a fixed value, so this never goes stale.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sd = require('../assets/seminar-dates.js');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The seminar box holds only a <p> and a <ul>, so its first </div> closes it.
function seminarBox() {
  const m = /<div id="seminar-dates"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  assert.ok(m, 'index.html must keep the seminar box with id="seminar-dates"');
  return m[1];
}
function seminarItems() {
  return [...seminarBox().matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => ({
    attrs: m[1],
    dataDate: (/\bdata-date="([^"]*)"/.exec(m[1]) || [])[1],
    text: m[2].replace(/<[^>]*>/g, '').replace(/^\s*(?:•|&bull;)\s*/, '').trim(),
  }));
}
function isoFromVisible(text) {
  const m = /^(\w+), (\w+) (\d{1,2}), (\d{4})$/.exec(text);
  assert.ok(m, `visible seminar text should read "Saturday, December 19, 2026": ${JSON.stringify(text)}`);
  const month = MONTHS.indexOf(m[2]) + 1;
  assert.ok(month > 0, `unknown month in ${JSON.stringify(text)}`);
  const iso = `${m[4]}-${String(month).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(+m[4], month - 1, +m[3])).getUTCDay()];
  return { iso, weekdayOk: weekday === m[1], weekday };
}

// A stand-in for the page: just what apply() touches.
function fakeDoc(dates, withBox = true) {
  const items = dates.map((d) => ({ style: {}, getAttribute: (n) => (n === 'data-date' ? d : null) }));
  const box = { style: {} };
  return {
    items, box,
    querySelectorAll(sel) { assert.equal(sel, 'li[data-date]'); return items; },
    getElementById(id) { return withBox && id === 'seminar-dates' ? box : null; },
  };
}

// ---------------------------------------------------------------- the page
test('index.html: the seminar box lists dates, each with a data-date that matches its visible text', () => {
  const items = seminarItems();
  assert.ok(items.length >= 1, 'at least one seminar date is listed');
  for (const it of items) {
    assert.match(it.dataDate || '', /^\d{4}-\d{2}-\d{2}$/, `every seminar <li> needs data-date="YYYY-MM-DD": ${it.text}`);
    const v = isoFromVisible(it.text);
    assert.equal(it.dataDate, v.iso, `data-date ${it.dataDate} does not match the visible text "${it.text}"`);
    assert.ok(v.weekdayOk, `"${it.text}" names the wrong weekday (${v.iso} is a ${v.weekday})`);
  }
  const dates = items.map((i) => i.dataDate);
  assert.deepEqual(dates, [...dates].sort(), 'dates are listed in order, soonest first');
});

test('index.html: loads seminar-dates.js exactly once, as a deferred script, from the file that exists', () => {
  const tags = html.match(/<script\b[^>]*src="\/assets\/seminar-dates\.js"[^>]*>/g) || [];
  assert.equal(tags.length, 1);
  assert.match(tags[0], /\bdefer\b/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'seminar-dates.js')));
});

// ---------------------------------------------------------------- isUpcoming
test('isUpcoming hides dates before a fixed today and keeps today and later ones', () => {
  const TODAY = '2026-10-06';
  for (const past of ['2026-06-20', '2026-09-19', '2026-10-05', '2025-12-31']) assert.equal(sd.isUpcoming(past, TODAY), false, past);
  for (const keep of ['2026-10-06', '2026-10-07', '2026-12-19', '2027-03-20']) assert.equal(sd.isUpcoming(keep, TODAY), true, keep);
  // month and year boundaries
  assert.equal(sd.isUpcoming('2026-12-31', '2027-01-01'), false);
  assert.equal(sd.isUpcoming('2027-01-01', '2026-12-31'), true);
  assert.equal(sd.isUpcoming('2026-09-30', '2026-10-01'), false);
});

test('isUpcoming never hides what it cannot read', () => {
  for (const [d, t] of [['', '2026-10-06'], [undefined, '2026-10-06'], ['December 19, 2026', '2026-10-06'], ['2026-12-19', ''], ['2026-12-19', undefined], ['2026-12-19', 'today'], ['2026-1-5', '2026-10-06']]) {
    assert.equal(sd.isUpcoming(d, t), true, JSON.stringify([d, t]));
  }
});

test('isUpcoming reads no clock: it gives the same answer with Date and Intl unavailable', () => {
  const src = sd.isUpcoming.toString();
  assert.doesNotMatch(src, /\bDate\b|\bIntl\b|performance|\.now\s*\(|getTime|setTimeout/, 'isUpcoming must stay a pure string comparison');
  const realDate = globalThis.Date;
  const realIntl = globalThis.Intl;
  const boom = () => { throw new Error('the clock was read'); };
  let a, b;
  try {
    globalThis.Date = new Proxy(realDate, { construct: boom, apply: boom, get(t, k) { if (k === 'now') boom(); return Reflect.get(t, k); } });
    globalThis.Intl = new Proxy(realIntl, { get: boom });
    a = sd.isUpcoming('2026-09-19', '2026-10-06');
    b = sd.isUpcoming('2026-12-19', '2026-10-06');
  } finally {
    globalThis.Date = realDate;
    globalThis.Intl = realIntl;
  }
  assert.equal(a, false);
  assert.equal(b, true);
});

// ---------------------------------------------------------------- Denver date
test('denverToday gives the Denver calendar date, in winter and summer time', () => {
  // MST (UTC-7): midnight in Denver is 07:00 UTC.
  assert.equal(sd.denverToday(new Date('2026-12-20T06:59:00Z')), '2026-12-19');
  assert.equal(sd.denverToday(new Date('2026-12-20T07:00:00Z')), '2026-12-20');
  // MDT (UTC-6): midnight in Denver is 06:00 UTC.
  assert.equal(sd.denverToday(new Date('2026-10-06T05:59:00Z')), '2026-10-05');
  assert.equal(sd.denverToday(new Date('2026-10-06T06:00:00Z')), '2026-10-06');
  // a seminar on the evening of its own day in Denver (already next day in UTC) still shows
  assert.equal(sd.isUpcoming('2026-12-19', sd.denverToday(new Date('2026-12-20T03:00:00Z'))), true);
});

test('denverToday answers "" rather than guessing when the browser cannot tell', () => {
  assert.equal(sd.denverToday(new Date(NaN)), '');
  assert.equal(sd.denverToday('not a date'), '');
});

// ---------------------------------------------------------------- apply
test('apply hides past dates but leaves the box while any date is left', () => {
  const doc = fakeDoc(['2026-06-20', '2026-09-19', '2026-12-19', '2027-03-20']);
  const r = sd.apply(doc, '2026-10-06');
  assert.deepEqual(r, { shown: 2, total: 4 });
  assert.deepEqual(doc.items.map((i) => i.style.display), ['none', 'none', undefined, undefined]);
  assert.equal(doc.box.style.display, undefined);
});

test('apply hides the whole box once every date has passed, and keeps today\'s date', () => {
  const doc = fakeDoc(['2026-12-19', '2027-03-20']);
  assert.deepEqual(sd.apply(doc, '2027-03-21'), { shown: 0, total: 2 });
  assert.deepEqual(doc.items.map((i) => i.style.display), ['none', 'none']);
  assert.equal(doc.box.style.display, 'none');

  const sameDay = fakeDoc(['2026-12-19', '2027-03-20']);
  assert.deepEqual(sd.apply(sameDay, '2027-03-20'), { shown: 1, total: 2 });
  assert.equal(sameDay.items[1].style.display, undefined);
  assert.equal(sameDay.box.style.display, undefined);
});

test('apply changes nothing when there is nothing to judge', () => {
  const noItems = fakeDoc([]);
  assert.deepEqual(sd.apply(noItems, '2030-01-01'), { shown: 0, total: 0 });
  assert.equal(noItems.box.style.display, undefined);
  assert.doesNotThrow(() => sd.apply(fakeDoc(['2026-06-20'], false), '2030-01-01'), 'a missing box must not throw');
});

test('apply on the real page list: hides everything after the last date, nothing on the first date', () => {
  const dates = seminarItems().map((i) => i.dataDate).sort();
  const dayAfter = new Date(Date.parse(`${dates[dates.length - 1]}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const late = fakeDoc(dates);
  assert.equal(sd.apply(late, dayAfter).shown, 0);
  assert.equal(late.box.style.display, 'none');
  const early = fakeDoc(dates);
  assert.equal(sd.apply(early, dates[0]).shown, dates.length);
  assert.equal(early.box.style.display, undefined);
});
