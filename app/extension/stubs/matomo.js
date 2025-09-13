(function(){
  "use strict";

  // ===== Idempotenz + Stealth =====
  if (window.__PROTECTO_MATOMO__) return;
  window.__PROTECTO_MATOMO__ = true;

  // ===== Helpers =====
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }

  const MAX_Q = 400;
  const state = {
    q: [],                 // full tuples from _paq
    start: Date.now(),
    trackerUrl: '',
    siteId: null,
    userId: null,
    documentTitle: '',
    customDimensions: Object.create(null),
    customVariables: Object.create(null),
    ecommerce: { enabled: false },
    linkTracking: false,
    optOut: false,
    visitorId: null,
    clientId: null,
    lastEventTs: 0
  };

  // try to derive a stable visitorId/clientId (best‑effort)
  (function(){
    try {
      const keyV = '__protecto_matomo_vid__';
      const keyC = '__protecto_matomo_cid__';
      const ls = window.localStorage;
      if (ls) {
        state.visitorId = ls.getItem(keyV) || null;
        state.clientId  = ls.getItem(keyC) || null;
      }
      const rnd = () => Math.random().toString(36).slice(2);
      if (!state.visitorId) state.visitorId = (Date.now().toString(36)+rnd()).slice(0,16);
      if (!state.clientId)  state.clientId  = (rnd()+Date.now().toString(36)).slice(0,16);
      if (ls) { try { ls.setItem(keyV, state.visitorId); ls.setItem(keyC, state.clientId); } catch {} }
    } catch {}
  })();

  function enqueue(tuple){
    try {
      if (state.q.length >= MAX_Q) state.q.shift();
      state.q.push([].slice.call(tuple));
    } catch {}
    return state.q.length;
  }

  // ===== Minimal Tracker implementation =====
  function createTracker(trackerUrl, siteId){
    const tState = {
      url: typeof trackerUrl === 'string' ? trackerUrl : state.trackerUrl,
      id: siteId != null ? String(siteId) : (state.siteId != null ? String(state.siteId) : '1'),
      cd: state.customDimensions,
      cv: state.customVariables,
      uid: state.userId,
      linkTracking: state.linkTracking,
      enabled: true
    };

    const t = {
      setTrackerUrl(url){ if (typeof url === 'string') { tState.url = url; state.trackerUrl = url; } return true; },
      setSiteId(id){ tState.id = String(id); state.siteId = String(id); return true; },
      getSiteId(){ return tState.id; },
      getTrackerUrl(){ return tState.url || ''; },
      setUserId(id){ tState.uid = id == null ? null : String(id); state.userId = tState.uid; return true; },
      getVisitorId(){ return state.visitorId; },
      getClientId(){ return state.clientId; },
      setDocumentTitle(title){ state.documentTitle = String(title||''); return true; },
      setCustomDimension(idx, val){ if (idx!=null) tState.cd[String(idx)] = val; return true; },
      deleteCustomDimension(idx){ if (idx!=null) delete tState.cd[String(idx)]; return true; },
      setCustomVariable(idx, name, val, scope){ tState.cv[String(idx)] = { name:String(name||''), value: val, scope: scope||'page' }; return true; },
      deleteCustomVariable(idx, scope){ delete tState.cv[String(idx||'')]; return true; },
      trackPageView(title){ if (title!=null) state.documentTitle = String(title); state.lastEventTs = Date.now(); return true; },
      trackEvent(cat, act, name, value){ state.lastEventTs = Date.now(); return true; },
      trackLink(url, linkType){ state.lastEventTs = Date.now(); return true; },
      trackSiteSearch(q, cat, results){ state.lastEventTs = Date.now(); return true; },
      trackGoal(goalId, revenue){ state.lastEventTs = Date.now(); return true; },
      enableLinkTracking(){ tState.linkTracking = true; state.linkTracking = true; return true; },
      disableLinkTracking(){ tState.linkTracking = false; state.linkTracking = false; return true; },
      setReferrerUrl(u){ return true; },
      setCustomUrl(u){ return true; },
      setDoNotTrack(val){ state.optOut = !!val; return true; },
      rememberCookieConsentGiven(){ return true; },
      rememberCookieConsentRemoved(){ return true; },
      setConsentGiven(){ return true; },
      setConsentRemoved(){ return true; },
      optUserOut(){ state.optOut = true; return true; },
      forgetUserOptOut(){ state.optOut = false; return true; },
      isUserOptedOut(){ return !!state.optOut; },
      ping(){ return true; },
      // plugin hooks
      addListener(){ return true; },
      removeListener(){ return true; }
    };

    try {
      t.setTrackerUrl.toString = nativeFn('setTrackerUrl');
      t.setSiteId.toString = nativeFn('setSiteId');
      t.getSiteId.toString = nativeFn('getSiteId');
      t.getTrackerUrl.toString = nativeFn('getTrackerUrl');
      t.setUserId.toString = nativeFn('setUserId');
      t.getVisitorId.toString = nativeFn('getVisitorId');
      t.getClientId.toString = nativeFn('getClientId');
      t.setDocumentTitle.toString = nativeFn('setDocumentTitle');
      t.setCustomDimension.toString = nativeFn('setCustomDimension');
      t.deleteCustomDimension.toString = nativeFn('deleteCustomDimension');
      t.setCustomVariable.toString = nativeFn('setCustomVariable');
      t.deleteCustomVariable.toString = nativeFn('deleteCustomVariable');
      t.trackPageView.toString = nativeFn('trackPageView');
      t.trackEvent.toString = nativeFn('trackEvent');
      t.trackLink.toString = nativeFn('trackLink');
      t.trackSiteSearch.toString = nativeFn('trackSiteSearch');
      t.trackGoal.toString = nativeFn('trackGoal');
      t.enableLinkTracking.toString = nativeFn('enableLinkTracking');
      t.disableLinkTracking.toString = nativeFn('disableLinkTracking');
      t.setReferrerUrl.toString = nativeFn('setReferrerUrl');
      t.setCustomUrl.toString = nativeFn('setCustomUrl');
      t.setDoNotTrack.toString = nativeFn('setDoNotTrack');
      t.rememberCookieConsentGiven.toString = nativeFn('rememberCookieConsentGiven');
      t.rememberCookieConsentRemoved.toString = nativeFn('rememberCookieConsentRemoved');
      t.setConsentGiven.toString = nativeFn('setConsentGiven');
      t.setConsentRemoved.toString = nativeFn('setConsentRemoved');
      t.optUserOut.toString = nativeFn('optUserOut');
      t.forgetUserOptOut.toString = nativeFn('forgetUserOptOut');
      t.isUserOptedOut.toString = nativeFn('isUserOptedOut');
      t.ping.toString = nativeFn('ping');
      t.addListener.toString = nativeFn('addListener');
      t.removeListener.toString = nativeFn('removeListener');
    } catch {}

    return t;
  }

  // ===== Piwik/Matomo namespace =====
  const Piwik = (function(){
    const trackers = [];
    function getTracker(url, id){
      const tr = createTracker(url, id);
      trackers.push(tr);
      return tr;
    }
    function getAsyncTrackers(){ return trackers.slice(); }
    try {
      getTracker.toString = nativeFn('getTracker');
      getAsyncTrackers.toString = nativeFn('getAsyncTrackers');
    } catch {}
    return { getTracker, getAsyncTrackers };
  })();

  // Expose namespaces
  window.Piwik = Piwik;
  window.Matomo = Piwik;

  // ===== _paq bootstrap queue =====
  // Adopt any existing array as bootstrap
  let pre = [];
  try {
    if (Array.isArray(window._paq)) pre = window._paq.slice(0);
  } catch {}

  const _paq = [];
  function paqPush(){
    for (let i=0;i<arguments.length;i++){
      const tuple = Array.prototype.slice.call(arguments[i] || []);
      enqueue(tuple);
      dispatch(tuple);
    }
    return _paq.length;
  }

  function dispatch(tuple){
    try {
      const cmd = String(tuple[0]||'');
      const args = tuple.slice(1);
      // Map common commands to a default tracker
      const tr = (function(){
        const arr = Piwik.getAsyncTrackers();
        return arr[0] || Piwik.getTracker(state.trackerUrl, state.siteId||1);
      })();

      switch (cmd) {
        case 'setTrackerUrl': return tr.setTrackerUrl(args[0]);
        case 'setSiteId': return tr.setSiteId(args[0]);
        case 'setUserId': return tr.setUserId(args[0]);
        case 'trackPageView': return tr.trackPageView(args[0]);
        case 'trackEvent': return tr.trackEvent(args[0], args[1], args[2], args[3]);
        case 'trackLink': return tr.trackLink(args[0], args[1]);
        case 'trackSiteSearch': return tr.trackSiteSearch(args[0], args[1], args[2]);
        case 'trackGoal': return tr.trackGoal(args[0], args[1]);
        case 'enableLinkTracking': return tr.enableLinkTracking();
        case 'disableLinkTracking': return tr.disableLinkTracking();
        case 'setReferrerUrl': return tr.setReferrerUrl(args[0]);
        case 'setCustomUrl': return tr.setCustomUrl(args[0]);
        case 'setDocumentTitle': return tr.setDocumentTitle(args[0]);
        case 'setCustomDimension': return tr.setCustomDimension(args[0], args[1]);
        case 'deleteCustomDimension': return tr.deleteCustomDimension(args[0]);
        case 'setCustomVariable': return tr.setCustomVariable(args[0], args[1], args[2], args[3]);
        case 'deleteCustomVariable': return tr.deleteCustomVariable(args[0], args[1]);
        case 'rememberCookieConsentGiven': return tr.rememberCookieConsentGiven();
        case 'rememberCookieConsentRemoved': return tr.rememberCookieConsentRemoved();
        case 'setConsentGiven': return tr.setConsentGiven();
        case 'setConsentRemoved': return tr.setConsentRemoved();
        case 'optUserOut': return tr.optUserOut();
        case 'forgetUserOptOut': return tr.forgetUserOptOut();
        case 'ping': return tr.ping();
        default:
          // push unknown commands to _paq to satisfy inspections
          _paq.push(tuple);
          return true;
      }
    } catch { return true; }
  }

  // Initialize _paq export (array with special push)
  _paq.push = function(){ return paqPush.apply(null, arguments); };

  window._paq = _paq;

  // Drain bootstrap queue
  try {
    if (pre && pre.length) {
      for (let i=0;i<pre.length;i++) { paqPush(pre[i]); }
    }
  } catch {}

  // ===== Fingerprints =====
  try {
    paqPush.toString = nativeFn('push');
  } catch {}
  try {
    Piwik.getTracker.toString = nativeFn('getTracker');
    Piwik.getAsyncTrackers.toString = nativeFn('getAsyncTrackers');
  } catch {}

})();
