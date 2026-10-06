/*
 * OwnInNoCo home page: stop showing seminar dates that have already passed.
 *
 * index.html lists each seminar as <li data-date="YYYY-MM-DD"> inside the box
 * with id="seminar-dates". When the page loads, this hides any <li> whose
 * data-date is earlier than today's date in Denver (America/Denver), and hides
 * the whole box once none is left. A seminar happening today still shows all
 * day. Without JavaScript (or if the browser cannot work out Denver's date) the
 * list is left exactly as written in the HTML: nothing is ever hidden by guess.
 *
 * This only tidies the list. The Eventbrite sign-up button is untouched.
 *
 * The pure helpers are exported for tests (tests/seminar-dates.test.js).
 */
(function (root) {
  'use strict';

  var TIME_ZONE = 'America/Denver';
  var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  // Pure: compares two YYYY-MM-DD strings (zero-padded ISO dates sort as text)
  // and reads no clock. True when the seminar is today or later. If either
  // value is not a YYYY-MM-DD date it answers true, so the date stays visible.
  function isUpcoming(dateText, todayText) {
    var d = String(dateText || '').trim();
    var t = String(todayText || '').trim();
    if (!ISO_DATE.test(d) || !ISO_DATE.test(t)) return true;
    return d >= t;
  }

  // The calendar date in Denver at the instant `now`, as YYYY-MM-DD, or '' if
  // this browser cannot say. The caller supplies the instant (the browser path
  // below passes new Date()), so this is testable with fixed instants.
  function denverToday(now) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(now);
      var p = {};
      parts.forEach(function (x) { p[x.type] = x.value; });
      var out = p.year + '-' + p.month + '-' + p.day;
      return ISO_DATE.test(out) ? out : '';
    } catch (e) {
      return '';
    }
  }

  // Hides the past dates and, when every dated entry is past, the whole box.
  function apply(doc, todayText) {
    var items = doc.querySelectorAll('li[data-date]');
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
      if (isUpcoming(items[i].getAttribute('data-date'), todayText)) shown++;
      else items[i].style.display = 'none';
    }
    var box = doc.getElementById('seminar-dates');
    if (box && items.length > 0 && shown === 0) box.style.display = 'none';
    return { shown: shown, total: items.length };
  }

  var api = { isUpcoming: isUpcoming, denverToday: denverToday, apply: apply, TIME_ZONE: TIME_ZONE };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.NocoSeminarDates = api;
    var run = function () {
      var today = denverToday(new Date());
      if (today) apply(root.document, today);
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run);
    else run();
  }
})(typeof window !== 'undefined' ? window : this);
