/*
 * Matches the homeownership quiz answers to the programs in /data/dpa-programs.json.
 *
 * Works in the browser (window.DpaMatch) and in Node (require) so the rules can be
 * tested without a browser: node --test scripts/*.test.mjs
 *
 * Rules are deliberately conservative. A program is left out only when an answer
 * clearly rules it out (e.g. a credit band entirely below the program minimum, or
 * a veteran-only loan for a non-veteran). Everything shown is "you may qualify:
 * confirm with a lender". Nothing here matches on a protected characteristic.
 * Employment-based programs are matched only on the optional occupation answer,
 * and only because the program itself is employment-based.
 */
(function (root) {
  'use strict';

  // Credit answers from the quiz <select name="credit"> -> [min, max] score band.
  function creditBand(value) {
    var v = String(value || '').toLowerCase();
    if (/excellent|720/.test(v)) return [720, 850];
    if (/good|660/.test(v)) return [660, 719];
    if (/fair/.test(v)) return [620, 659];
    if (/below|needs|improv/.test(v)) return [300, 619];
    return null; // "Not sure" or unanswered
  }

  function isOwner(value) { return /yes|own/i.test(String(value || '')) && !/rent/i.test(String(value || '')); }
  function isVeteran(value) { return /^yes/i.test(String(value || '').trim()); }
  function lowSavings(value) { return /less than|1,?000-\$?5/i.test(String(value || '')); }

  function normalise(answers) {
    var a = answers || {};
    return {
      owner: isOwner(a.ownHome),
      veteran: isVeteran(a.veteran),
      credit: creditBand(a.credit),
      creditUnknown: creditBand(a.credit) === null,
      lowSavings: lowSavings(a.downPayment),
      area: String(a.targetArea || '').trim(),
      occupation: String(a.occupation || '').trim()
    };
  }

  // Returns { program, reasons[], caveats[] } or null when the answers rule it out.
  function evaluate(program, ans, areas) {
    var m = program.match || {};
    var reasons = [];
    var caveats = [];
    var area = ans.area && areas[ans.area] ? areas[ans.area] : null;
    var counties = area ? area.counties : [];

    if (m.always) {
      reasons.push('A required first step for most Colorado programs');
      return { program: program, reasons: reasons, caveats: caveats };
    }

    if (m.veteran === 'required') {
      if (!ans.veteran) return null;
      reasons.push('You said you are a veteran or in the military');
    }

    if (m.occupations) {
      if (m.occupations.indexOf(ans.occupation) === -1) return null;
      reasons.push('Your line of work fits this employment-based program');
    }

    if (m.first_time === 'required' || m.first_time === 'required_or_veteran') {
      if (ans.owner) {
        if (m.first_time === 'required_or_veteran' && ans.veteran) {
          reasons.push('Open to qualified veterans even if you have owned before');
        } else {
          return null;
        }
      } else {
        reasons.push('You rent now, so you may count as a first-time buyer (no ownership in the last 3 years)');
      }
    }

    if (m.areas) {
      if (m.areas.indexOf(ans.area) === -1) return null;
      reasons.push('Serves ' + area.label);
    }
    if (m.counties) {
      var hit = null;
      for (var i = 0; i < m.counties.length; i++) { if (counties.indexOf(m.counties[i]) !== -1) { hit = m.counties[i]; break; } }
      if (!hit) return null;
      reasons.push('Serves ' + hit.charAt(0).toUpperCase() + hit.slice(1) + ' County');
    }
    if (m.exclude_areas) {
      if (m.exclude_areas.indexOf(ans.area) !== -1) return null;
    }

    if (m.min_credit) {
      if (ans.credit) {
        if (ans.credit[1] < m.min_credit) return null;          // whole band is below the minimum
        if (ans.credit[0] < m.min_credit) caveats.push('Needs a credit score of ' + m.min_credit + ' or higher');
        else reasons.push('Your credit range meets the ' + m.min_credit + ' minimum');
      } else {
        caveats.push('Needs a credit score of ' + m.min_credit + ' or higher');
      }
    }

    if (program.type && /^dpa|with_dpa/.test(program.type) && ans.lowSavings) {
      reasons.push('Helps with the down payment and closing costs');
    }
    if (program.fit_note) caveats.push(program.fit_note);
    if (!reasons.length) reasons.push('Open to most buyers who qualify for the loan');

    return { program: program, reasons: reasons, caveats: caveats };
  }

  // Lower number = shown first. Assistance first when savings are low.
  function rank(result, ans) {
    var t = result.program.type || '';
    var p;
    if (t === 'resource') p = 90;
    else if (/^dpa|with_dpa/.test(t)) p = ans.lowSavings ? 10 : 30;
    else if (t === 'federal_loan' || t === 'first_mortgage') p = 20;
    else p = 40;
    var m = result.program.match || {};
    if (m.occupations || m.veteran) p -= 5;
    if (typeof m.rank_adjust === 'number') p += m.rank_adjust;   // e.g. narrow programs lower
    return p;
  }

  function match(data, answers) {
    var programs = (data && data.programs) || [];
    var areas = (data && data.areas) || {};
    var ans = normalise(answers);
    var out = [];
    for (var i = 0; i < programs.length; i++) {
      var r = evaluate(programs[i], ans, areas);
      if (r) { r.rank = rank(r, ans); r.order = i; out.push(r); }
    }
    out.sort(function (a, b) { return (a.rank - b.rank) || (a.order - b.order); });
    return out;
  }

  var api = { match: match, creditBand: creditBand };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DpaMatch = api;
})(typeof window !== 'undefined' ? window : this);
