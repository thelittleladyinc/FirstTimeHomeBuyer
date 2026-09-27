/*
 * OwnInNoCo quiz: funnel events + partial-quiz capture.
 *
 * 1. Funnel events (Meta Pixel + Google tag), for audiences built on BEHAVIOUR
 *    only. No event carries a name, email, phone, answer text or hash of any of
 *    them, and the pixel is not set up for Advanced Matching.
 *      quiz start (first interaction with the form)
 *          Meta: ViewContent {content_name:'NoCo Quiz'}      Google: quiz_start
 *      a valid email or phone has been typed
 *          Meta: QuizStarted (custom)                         Google: quiz_contact_entered
 *      "Not yet" (value no) chosen for "Are you pre-approved?"
 *          Meta: NotPreApproved (custom)                      Google: not_pre_approved
 *      full submit confirmed by the Command Center ({ ok: true })
 *          Meta: Lead                                         Google: generate_lead
 *      (Lead / generate_lead stay in index.html's submit handler.)
 *
 * 2. Partial capture: once a valid email or phone is in the form, if the visitor
 *    leaves the page (tab hidden / page closed) or does nothing for 60 seconds
 *    without submitting, what they typed so far (name, email, phone, the answers
 *    they actually changed, page and UTM tags) is sent with navigator.sendBeacon
 *    to the Command Center's /api/quiz-lead/partial. Never after a submit; never
 *    the same data twice; never the consent checkbox (a partial visitor has not
 *    agreed to texts).
 *
 * The pure helpers are exported for tests (tests/quiz-capture.test.js).
 */
(function (root) {
  'use strict';

  var PARTIAL_URL = 'https://bold-collective-command-center.onrender.com/api/quiz-lead/partial';
  var IDLE_MS = 60 * 1000;
  var CONTACT_FIELDS = ['firstName', 'lastName', 'email', 'phone'];
  var ANSWER_FIELDS = ['timeline', 'ownHome', 'veteran', 'credit', 'downPayment', 'preApproved'];
  var UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var HONEYPOT = 'hp_website';

  function validEmail(v) {
    var s = String(v || '').trim();
    return s.length <= 254 && /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/.test(s);
  }
  function validPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(d);
  }
  function hasContact(values) { return validEmail(values.email) || validPhone(values.phone); }

  // value "no" (shown as "Not yet") -> not pre-approved. "unsure" and "yes" are not.
  function isNotPreApproved(v) { return /^(no|not yet)\b/i.test(String(v || '').trim()); }

  function utmFrom(search) {
    var out = {};
    var q = String(search || '').replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      var k = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
      var v = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      if (UTM_FIELDS.indexOf(k) >= 0 && v) out[k] = v.slice(0, 100);
    });
    return out;
  }

  /**
   * The partial payload: contact fields typed so far, only the answers the
   * visitor actually changed, page, UTM, honeypot. Never consent. null when
   * there is no valid email/phone yet.
   */
  function buildPartial(values, touched, ctx) {
    if (!hasContact(values)) return null;
    var p = {};
    CONTACT_FIELDS.forEach(function (k) {
      var v = String(values[k] || '').trim();
      if (!v) return;
      if (k === 'email' && !validEmail(v)) return;
      if (k === 'phone' && !validPhone(v)) return;
      p[k] = v.slice(0, 254);
    });
    ANSWER_FIELDS.forEach(function (k) {
      if (touched[k] && values[k]) p[k] = String(values[k]).slice(0, 80);
    });
    var utm = (ctx && ctx.utm) || {};
    Object.keys(utm).forEach(function (k) { p[k] = utm[k]; });
    if (ctx && ctx.page) p.page = String(ctx.page).slice(0, 200);
    if (ctx && ctx.trigger) p.trigger = ctx.trigger;
    if (values[HONEYPOT]) p[HONEYPOT] = String(values[HONEYPOT]).slice(0, 100);
    return p;
  }
  function signature(p) {
    if (!p) return '';
    var copy = {};
    Object.keys(p).sort().forEach(function (k) { if (k !== 'trigger') copy[k] = p[k]; });
    return JSON.stringify(copy);
  }

  /** Wire everything to the form. deps: { win, doc, form, now?, setTimeout?, clearTimeout? } */
  function init(deps) {
    var win = deps.win;
    var form = deps.form;
    if (!form) return null;
    var setT = deps.setTimeout || win.setTimeout.bind(win);
    var clearT = deps.clearTimeout || win.clearTimeout.bind(win);
    var state = { started: false, contact: false, notPre: false, submitted: false, lastSig: '', touched: {}, timer: null };
    var utm = utmFrom(win.location && win.location.search);

    function fbq() { if (typeof win.fbq === 'function') win.fbq.apply(null, arguments); }
    function gtag() { if (typeof win.gtag === 'function') win.gtag.apply(null, arguments); }

    function values() {
      var v = {};
      CONTACT_FIELDS.concat(ANSWER_FIELDS, [HONEYPOT]).forEach(function (k) {
        var el = form.elements && form.elements[k];
        v[k] = el ? el.value : '';
      });
      return v;
    }

    function send(trigger) {
      if (state.submitted) return false;
      var p = buildPartial(values(), state.touched, { utm: utm, page: (win.location && (win.location.pathname + (win.location.hash || ''))) || '', trigger: trigger });
      var sig = signature(p);
      if (!p || sig === state.lastSig) return false;
      var body = new win.URLSearchParams(p);
      var ok = false;
      try { ok = !!(win.navigator && win.navigator.sendBeacon && win.navigator.sendBeacon(PARTIAL_URL, body)); } catch (e) { ok = false; }
      if (!ok && typeof win.fetch === 'function') {
        try { win.fetch(PARTIAL_URL, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }); ok = true; } catch (e) { ok = false; }
      }
      if (ok) state.lastSig = sig;
      return ok;
    }

    function armIdle() {
      if (state.timer) clearT(state.timer);
      state.timer = null;
      if (state.submitted || !state.contact) return;
      state.timer = setT(function () { state.timer = null; send('idle'); }, IDLE_MS);
    }

    function onActivity(e) {
      if (state.submitted) return;
      var t = e && e.target;
      var name = t && t.name;
      if (!state.started) {
        state.started = true;
        fbq('track', 'ViewContent', { content_name: 'NoCo Quiz', content_category: 'quiz' });
        gtag('event', 'quiz_start', { event_category: 'quiz' });
      }
      if (name && ANSWER_FIELDS.indexOf(name) >= 0 && e.type !== 'focusin') state.touched[name] = true;
      if (name === 'preApproved' && !state.notPre && isNotPreApproved(t.value)) {
        state.notPre = true;
        fbq('trackCustom', 'NotPreApproved', { content_name: 'NoCo Quiz' });
        gtag('event', 'not_pre_approved', { event_category: 'quiz' });
      }
      if (!state.contact && hasContact(values())) {
        state.contact = true;
        fbq('trackCustom', 'QuizStarted', { content_name: 'NoCo Quiz' });
        gtag('event', 'quiz_contact_entered', { event_category: 'quiz' });
      }
      if (e.type !== 'focusin') armIdle();
    }

    ['focusin', 'input', 'change'].forEach(function (type) { form.addEventListener(type, onActivity); });
    form.addEventListener('submit', function () {
      state.submitted = true;
      if (state.timer) { clearT(state.timer); state.timer = null; }
    }, true);

    var doc = deps.doc;
    if (doc && doc.addEventListener) {
      doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') send('hidden'); });
    }
    win.addEventListener('pagehide', function () { send('pagehide'); });

    return { state: state, send: send, markSubmitted: function () { state.submitted = true; } };
  }

  var api = { validEmail: validEmail, validPhone: validPhone, hasContact: hasContact, isNotPreApproved: isNotPreApproved,
    utmFrom: utmFrom, buildPartial: buildPartial, signature: signature, init: init,
    PARTIAL_URL: PARTIAL_URL, IDLE_MS: IDLE_MS, HONEYPOT: HONEYPOT };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.NocoQuizCapture = api;
    var start = function () { api.init({ win: root, doc: root.document, form: root.document.getElementById('noco-quiz') }); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(typeof window !== 'undefined' ? window : this);
