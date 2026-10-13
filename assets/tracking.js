/*
 * The one tracking include for every page of owninnoco.com.
 *
 * Each page loads it in <head> with
 *   <script src="/assets/tracking.js"></script>
 * (not async or defer, so gtag() and fbq() exist before any onclick handler
 * or page script runs, exactly as the inline snippet did). The IDs live here
 * and nowhere else in the pages: change one here and every page follows.
 * tests/tracking-include.test.js holds every page to this.
 *
 * - Google tag (gtag.js), loaded ONCE, with Analytics GA4 G-76NN5P55H2 and
 *   Google Ads AW-16452139344 both configured on that one load.
 * - Meta pixel 785995940287531, PageView. No Advanced Matching: never pass
 *   user data to fbq('init'). Never the hacked pixel named in CLAUDE.md.
 */
(function (w, d) {
  var GA4 = 'G-76NN5P55H2';
  var ADS = 'AW-16452139344';
  var META_PIXEL = '785995940287531';

  // Google tag: one library load, both ids configured on it.
  var g = d.createElement('script');
  g.async = true;
  g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4;
  d.head.appendChild(g);
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer.push(arguments); };
  w.gtag('js', new Date());
  w.gtag('config', GA4);
  w.gtag('config', ADS);

  // Meta pixel: Meta's standard base code.
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(w, d,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  w.fbq('init', META_PIXEL);
  w.fbq('track', 'PageView');
})(window, document);
