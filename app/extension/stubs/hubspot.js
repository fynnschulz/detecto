/**
 * Protecto — HubSpot Tracking Stub (hs.js / _hsq)
 *
 * Purpose
 *  - Provide a realistic, network‑free replacement for HubSpot Analytics queue `_hsq`.
 *  - Make sites believe HubSpot tracking is present (200 OK with this file),
 *    while no data ever leaves the page.
 *
 * Emulates (subset, commonly used):
 *  - window._hsq Array‑queue (pre‑queue drain)
 *  - _hsq.push([ 'identify', { email, id, ... } ])
 *  - _hsq.push([ 'trackPageView' ])
 *  - _hsq.push([ 'trackEvent', { id, value, ... } ])
 *  - _hsq.push([ 'setPath' | 'setReferrer' | 'setCanonicalUrl' | 'setContentType' | 'setRequestUrl', value ])
 *  - _hsq.push([ 'consent', { functionality, analytics, advertising } ])
 *  - _hsq.push([ 'onReady', fn ]) — executes callback asynchronously
 *  - Provides read‑only mirrors: _hsq.state, _hsq.version, _hsq.__PROTECTO_STUB__
 *
 * Notes
 *  - Idempotent: safe if injected multiple times.
 *  - Native‑like toString on functions for stealth.
 *  - No cookies are set, no beacons fired.
 */
(function(){
  if (typeof window !== 'object') return;
  const W = window;
  if (W.__PROTECTO_HUBSPOT_STUB__) return; // already installed
  Object.defineProperty(W, '__PROTECTO_HUBSPOT_STUB__', { value: true, configurable: false });

  const DEBUG = !!W.__PROTECTO_DEBUG__;
  const log = (...a)=>{ try{ if (DEBUG) console.debug('[Protecto][HubSpot]', ...a); }catch{} };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const freeze = (o)=>{ try{ return Object.freeze(o); }catch{ return o; } };
  const clone  = (x)=>{ try{ return x && typeof x==='object' ? JSON.parse(JSON.stringify(x)) : x; }catch{ return x; } };
  const defRO  = (obj, key, val)=>{ try{ Object.defineProperty(obj, key, { value: val, writable:false, enumerable:false, configurable:false }); }catch{ obj[key]=val; } };
  const nativeToString = (name)=>`function ${name}() { [native code] }`;
  const nextTick = (fn)=>{ try{ Promise.resolve().then(fn); } catch { setTimeout(fn,0); } };

  // ---------------------------------------------------------------------------
  // Internal state (never exposed directly)
  // ---------------------------------------------------------------------------
  const _state = {
    version: 'protecto-hubspot-stub/1.0.0',
    path: W.location && W.location.pathname || '/',
    referrer: W.document && W.document.referrer || '',
    canonicalUrl: null,
    requestUrl: W.location && (W.location.origin + W.location.pathname + W.location.search) || '',
    contentType: null,
    identity: {},
    consent: { functionality: true, analytics: true, advertising: false },
    events: [],
    pageviews: 0,
    queued: 0,
    readyCbs: []
  };

  // ---------------------------------------------------------------------------
  // Command handlers (no-ops that store state)
  // ---------------------------------------------------------------------------
  const handlers = {
    identify(payload){
      const p = (payload && typeof payload==='object') ? payload : {};
      _state.identity = {
        email: p.email || _state.identity.email || '',
        id:    p.id    || _state.identity.id    || p.userId || '',
        ...clone(p)
      };
      log('identify', clone(_state.identity));
    },
    trackPageView(){
      _state.pageviews += 1;
      _state.events.push({ type:'pageview', ts: Date.now(), path:_state.path });
      log('trackPageView', { count: _state.pageviews, path: _state.path });
    },
    trackEvent(payload){
      const evt = (payload && typeof payload==='object') ? payload : { };
      const entry = { type:'event', ts: Date.now(), data: clone(evt) };
      _state.events.push(entry);
      log('trackEvent', entry);
    },
    setPath(v){ _state.path = String(v||'/'); },
    setReferrer(v){ _state.referrer = String(v||''); },
    setCanonicalUrl(v){ _state.canonicalUrl = String(v||''); },
    setContentType(v){ _state.contentType = String(v||''); },
    setRequestUrl(v){ _state.requestUrl = String(v||''); },
    consent(map){
      const m = (map && typeof map==='object') ? map : {};
      _state.consent = {
        functionality: !!(m.functionality ?? _state.consent.functionality),
        analytics:     !!(m.analytics     ?? _state.consent.analytics),
        advertising:   !!(m.advertising   ?? _state.consent.advertising)
      };
      log('consent', clone(_state.consent));
    },
    onReady(fn){ if (typeof fn === 'function') nextTick(()=>{ try{ fn(); }catch{} }); }
  };

  // Extra aliases some sites use (be liberal in what we accept)
  const aliasMap = {
    page: 'trackPageView',
    event: 'trackEvent',
    setCanonicalURL: 'setCanonicalUrl',
    setUrl: 'setRequestUrl',
    ready: 'onReady'
  };

  function resolveCmd(cmd){
    if (handlers[cmd]) return cmd;
    const a = aliasMap[cmd];
    return handlers[a] ? a : null;
  }

  // ---------------------------------------------------------------------------
  // Queue facade `_hsq` (array-like with push that understands commands)
  // ---------------------------------------------------------------------------
  const preQueue = Array.isArray(W._hsq) ? W._hsq.slice() : [];

  function push(item){
    try{
      if (!Array.isArray(item) || !item.length) return 0;
      const [rawCmd, ...rest] = item;
      const cmd = resolveCmd(String(rawCmd || ''));
      if (!cmd) { log('unknown cmd', rawCmd); return _state.events.length; }
      const arg = rest && rest.length ? rest[0] : undefined;
      _state.queued++;
      // Execute command
      try { handlers[cmd](arg); } catch (e) { log('handler error for', cmd, e); }
      return _state.events.length + _state.pageviews;
    }catch(e){ log('push error', e); return _state.events.length; }
  }

  // Array-like object with minimal surface
  const hsq = [];
  hsq.push = push;
  try { hsq.push.toString = ()=>nativeToString('push'); } catch{}

  // Read-only mirrors as normal properties (not frozen or sealed)
  hsq.state = new Proxy({}, { get:(_,k)=> clone(_state[k]) });
  hsq.version = _state.version;
  hsq.__PROTECTO_STUB__ = true;
  hsq.__getState = ()=>clone(_state);
  hsq.__drainQueue = ()=>{ /* compatibility no-op */ };

  // Publish global and drain any pre-queued commands
  W._hsq = hsq;
  if (preQueue.length) {
    for (const it of preQueue) {
      try { push(it); } catch {}
    }
  }

  // Trigger onReady callbacks if someone queued them as raw functions (rare)
  if (preQueue.length) {
    for (const it of preQueue) {
      if (typeof it === 'function') nextTick(()=>{ try{ it(); }catch{} });
    }
  }

  log('HubSpot _hsq stub active');
})();