// Vurium Analytics — lightweight privacy-friendly tracker
(function(){
  if (typeof window === 'undefined') return;
  var ep = (document.currentScript && document.currentScript.dataset.api) || 'https://vuriumbook-api-431945333485.us-central1.run.app/t';
  var vid = localStorage.getItem('_va_vid');
  if (!vid) { vid = Math.random().toString(36).substring(2) + Date.now().toString(36); localStorage.setItem('_va_vid', vid); }
  var sid = sessionStorage.getItem('_va_sid');
  if (!sid) { sid = Math.random().toString(36).substring(2); sessionStorage.setItem('_va_sid', sid); }
  function track() {
    var data = { url: location.pathname, ref: document.referrer || '', scr: screen.width + 'x' + screen.height, vid: vid, sid: sid };
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ep, JSON.stringify(data));
    } else {
      fetch(ep, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function(){});
    }
  }
  // Track initial pageview
  track();
  // Track SPA navigation (pushState/replaceState)
  var origPush = history.pushState;
  history.pushState = function() { origPush.apply(this, arguments); setTimeout(track, 50); };
  var origReplace = history.replaceState;
  history.replaceState = function() { origReplace.apply(this, arguments); setTimeout(track, 50); };
  window.addEventListener('popstate', function() { setTimeout(track, 50); });
})();
