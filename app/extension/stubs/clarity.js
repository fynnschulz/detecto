(function(){
  "use strict";

  // --- Idempotenz + Stealth Flag
  if (window.__PROTECTO_CLARITY__) return;
  try { Object.defineProperty(window, '__PROTECTO_CLARITY__', { value: true, writable:false, configurable:false, enumerable:false }); } catch { window.__PROTECTO_CLARITY__ = true; }

  // --- Helpers
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function defGlobal(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:false, configurable:false, enumerable:false }); }
    catch { obj[key] = value; }
  }

  // Clarity erwartet ein funktionsartiges API mit vorangestellter Queue
  // https://clarity.microsoft.com (Original setzt window.clarity=function(){(clarity.q=clarity.q||[]).push(arguments)};)

  const MAX_Q = 200;
  const state = {
    q: [],
    props: {},
    userId: null,
    sessionId: (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0,20),
    enabled: true
  };

  // Adopt pre-existing bootstrap (window.clarity with .q) if present
  let preBootstrapQ = [];
  try {
    if (typeof window.clarity === 'function' && Array.isArray(window.clarity.q) && !window.clarity.loaded) {
      preBootstrapQ = window.clarity.q.slice(0);
    }
  } catch {}

  function pushQ(){
    // Supports: pushQ(arguments) OR pushQ([ [..], [..] ])
    if (arguments.length === 1 && Array.isArray(arguments[0])){
      const list = arguments[0];
      for (let i=0;i<list.length;i++){
        const tuple = Array.prototype.slice.call(list[i] || []);
        if (state.q.length >= MAX_Q) state.q.shift();
        state.q.push(tuple);
      }
      return state.q.length;
    }
    for (let i=0;i<arguments.length;i++){
      const tuple = Array.prototype.slice.call(arguments[i] || []);
      if (state.q.length >= MAX_Q) state.q.shift();
      state.q.push(tuple);
    }
    return state.q.length;
  }

  function clarity(){
    // Standard-API: clarity('set'| 'identify' | 'event' | 'consent' | 'track', ...)
    if (!state.enabled) return true;
    pushQ(arguments);
    try {
      const a = Array.prototype.slice.call(arguments);
      const cmd = String(a[0]||'').toLowerCase();
      switch(cmd){
        case 'set': {
          // clarity('set', key, value) | clarity('set', {k:v}) | clarity('set', [['k','v'], ...]) | clarity('set','page',path)
          const k = a[1];
          const v = a[2];
          if (k && Array.isArray(k)) {
            for (let i=0;i<k.length;i++){
              const pair = k[i];
              if (Array.isArray(pair) && typeof pair[0] === 'string') state.props[pair[0]] = pair[1];
            }
          } else if (k && typeof k === 'object') {
            Object.assign(state.props, k);
          } else if (typeof k === 'string') {
            if (k === 'page') state.props.page = v;
            else state.props[k] = v;
          }
          return true;
        }
        case 'identify': {
          state.userId = a[1] || state.userId;
          if (a[2] && typeof a[2] === 'object') Object.assign(state.props, a[2]);
          return true;
        }
        case 'event': {
          return true;
        }
        case 'consent': {
          // clarity('consent', 'set'|'grant'|'revoke', value|object)
          const action = String(a[1]||'').toLowerCase();
          const val = a[2];
          if (val && typeof val === 'object') {
            state.props.consent = Object.assign({}, state.props.consent || {}, val);
          } else if (action === 'set' || action === 'grant' || action === 'revoke') {
            state.props.consent = (val !== undefined ? val : action);
          }
          return true;
        }
        case 'track': {
          return true;
        }
        case 'upload': {
          return true;
        }
        case 'stop': {
          state.enabled = false; return true;
        }
        case 'start': {
          state.enabled = true; return true;
        }
        case 'upgrade': {
          return true; // frequently no-op in practice
        }
        default:
          return true;
      }
    } catch { return true; }
  }

  // Control helpers
  function stop(){ state.enabled = false; return true; }
  function start(){ state.enabled = true; return true; }

  // Aliase, wie häufig von Integrationen genutzt
  clarity.set      = function(k,v){ return clarity('set', k, v); };
  clarity.identify = function(id, props){ return clarity('identify', id, props); };
  clarity.event    = function(name, props){ return clarity('event', name, props); };
  clarity.consent  = function(action, val){ return clarity('consent', action, val); };
  clarity.track    = function(name, props){ return clarity('track', name, props); };
  clarity.upload   = function(){ return clarity('upload'); };
  clarity.stop     = stop;
  clarity.start    = start;

  // Drain any pre-existing bootstrap queue into our queue
  try {
    if (preBootstrapQ && preBootstrapQ.length) pushQ(preBootstrapQ);
  } catch {}

  // Queue-Kompatibilität + Marker wie beim Original
  try { Object.defineProperty(clarity, 'q', { value: state.q, writable:false, configurable:false, enumerable:false }); } catch { clarity.q = state.q; }
  try { Object.defineProperty(clarity, 'v', { value: '0.7', writable:false, configurable:false, enumerable:false }); } catch { clarity.v = '0.7'; }
  try { Object.defineProperty(clarity, 't', { value: +new Date(), writable:false, configurable:false, enumerable:false }); } catch { clarity.t = +new Date(); }
  try { Object.defineProperty(clarity, 'loaded', { value: true, writable:false, configurable:false, enumerable:false }); } catch { clarity.loaded = true; }

  try { Object.defineProperty(clarity, 'sid', { get: ()=>state.sessionId, enumerable:false, configurable:false }); } catch {}
  try { Object.defineProperty(clarity, 'uid', { get: ()=>state.userId,    enumerable:false, configurable:false }); } catch {}

  // Native-like Fingerprints
  try {
    clarity.toString         = nativeFn('clarity');
    clarity.set.toString     = nativeFn('set');
    clarity.identify.toString= nativeFn('identify');
    clarity.event.toString   = nativeFn('event');
    clarity.consent.toString = nativeFn('consent');
    clarity.track.toString   = nativeFn('track');
    clarity.upload.toString  = nativeFn('upload');
    clarity.stop.toString    = nativeFn('stop');
    clarity.start.toString   = nativeFn('start');
    clarity.upgrade.toString = nativeFn('upgrade');
    clarity.stop.toString    = nativeFn('stop');
    clarity.start.toString   = nativeFn('start');
  } catch {}

  // Read-only Export
  defGlobal(window, 'clarity', clarity);

})();