// Run: node --test scripts/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { validate, stale } from './dpa-programs.mjs';

const require = createRequire(import.meta.url);
const { match, creditBand } = require('../assets/dpa-match.js');
const data = JSON.parse(readFileSync(new URL('../data/dpa-programs.json', import.meta.url), 'utf8'));
const ids = (answers) => match(data, answers).map((r) => r.program.id);

// Values exactly as the quiz <select>s send them.
const renter = { ownHome: 'No - I rent', veteran: 'No', credit: 'Good (660-719)', downPayment: 'Less than $1,000' };

test('data file is valid', () => {
  assert.deepEqual(validate(data), []);
});

test('every program has an official url and a last_verified date', () => {
  for (const p of data.programs) {
    assert.match(p.url, /^https:\/\//, p.id);
    assert.match(p.last_verified, /^\d{4}-\d{2}-\d{2}$/, p.id);
  }
});

test('credit bands parse from the quiz values', () => {
  assert.deepEqual(creditBand('Excellent (720+)'), [720, 850]);
  assert.deepEqual(creditBand('Good (660-719)'), [660, 719]);
  assert.deepEqual(creditBand('Fair (620-659)'), [620, 659]);
  assert.deepEqual(creditBand('Needs improvement (below 620)'), [300, 619]);
  assert.equal(creditBand('Not sure'), null);
});

test('first-time renter with good credit sees CHFA first-time and DPA programs', () => {
  const got = ids(renter);
  for (const id of ['chfa-firststep', 'chfa-dpa-grant', 'chfa-dpa-second', 'chac-dpa', 'fha', 'chfa-homebuyer-education']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('va-home-loan'), 'VA only for veterans');
  assert.ok(!got.includes('chfa-schools-to-home'), 'employment programs need an occupation answer');
});

test('assistance is listed first when savings are low', () => {
  const first = match(data, renter)[0].program.type;
  assert.match(first, /dpa/);
});

test('current owners do not see first-time-only programs, unless a veteran for FirstStep', () => {
  const owner = { ...renter, ownHome: 'Yes - I own' };
  assert.ok(!ids(owner).includes('chfa-firststep'));
  assert.ok(!ids(owner).includes('chac-dpa'));
  assert.ok(ids(owner).includes('chfa-smartstep'));
  assert.ok(ids({ ...owner, veteran: 'Yes' }).includes('chfa-firststep'));
});

test('veterans see the VA loan', () => {
  assert.ok(ids({ ...renter, veteran: 'Yes' }).includes('va-home-loan'));
});

test('credit below 620 drops 620-minimum programs but keeps FHA with no caveat hiding it', () => {
  const low = { ...renter, credit: 'Needs improvement (below 620)' };
  const got = ids(low);
  assert.ok(!got.includes('chfa-firststep'));
  assert.ok(!got.includes('chfa-dpa-grant'));
  assert.ok(got.includes('fha'));
  const fha = match(data, low).find((r) => r.program.id === 'fha');
  assert.ok(fha.caveats.some((c) => /500/.test(c)));
});

test('"Not sure" credit keeps programs but adds a caveat', () => {
  const r = match(data, { ...renter, credit: 'Not sure' }).find((x) => x.program.id === 'chfa-firststep');
  assert.ok(r);
  assert.ok(r.caveats.some((c) => /620/.test(c)));
});

test('local programs follow the target area', () => {
  assert.ok(ids({ ...renter, targetArea: 'greeley' }).includes('habitat-greeley-weld'));
  assert.ok(ids({ ...renter, targetArea: 'greeley' }).includes('greeley-housing-solutions'));
  assert.ok(ids({ ...renter, targetArea: 'windsor' }).includes('larimer-county-homebuyer-resources'), 'Windsor straddles both counties');
  assert.ok(ids({ ...renter, targetArea: 'fort-collins' }).includes('habitat-fort-collins'));
  assert.ok(!ids({ ...renter, targetArea: 'fort-collins' }).includes('habitat-greeley-weld'));
  assert.ok(!ids(renter).includes('habitat-fort-collins'), 'no area answer, no local program');
});

test('USDA is not suggested for the larger cities', () => {
  assert.ok(!ids({ ...renter, targetArea: 'fort-collins' }).includes('usda-guaranteed'));
  assert.ok(ids({ ...renter, targetArea: 'wellington' }).includes('usda-guaranteed'));
});

test('employment-based programs match only on the occupation answer', () => {
  assert.ok(ids({ ...renter, occupation: 'co-public-school' }).includes('chfa-schools-to-home'));
  assert.ok(ids({ ...renter, occupation: 'firefighter' }).includes('hud-gnnd'));
  assert.ok(!ids({ ...renter, occupation: 'firefighter' }).includes('chfa-schools-to-home'));
});

test('matching never reads fields outside the quiz answers', () => {
  const src = readFileSync(new URL('../assets/dpa-match.js', import.meta.url), 'utf8');
  for (const word of ['race', 'religion', 'disab', 'familial', 'national', 'gender', 'marital', 'age']) {
    assert.ok(!new RegExp('a\\.' + word, 'i').test(src), word);
  }
});

test('stale() flags programs past the review window', () => {
  assert.equal(stale(data, '2026-09-27').length, 0);
  assert.equal(stale(data, '2026-12-31').length, data.programs.length);
});
