(function(){
  "use strict";

  // ===== Idempotenz + Stealth =====
  if (window.__PROTECTO_HOTJAR__) return;
  try { Object.defineProperty(window, '__PROTECTO_HOTJAR__', { value: true, writable:true, configurable:true, enumerable:false }); } catch { window.__PROTECTO_HOTJAR__ = true; }

  // ===== Helpers =====
  function nativeFn(name){ return function(){ return `function ${name}() { [native code] }`; }; }
  function ro(obj, key, value){
    try { Object.defineProperty(obj, key, { value, writable:true, configurable:true, enumerable:false }); }
    catch { obj[key] = value; }
  }
  function roGetter(obj, key, getter){
    try { Object.defineProperty(obj, key, { get:getter, configurable:true, enumerable:false }); } catch {}
  }

  const MAX_Q = 400;
  const state = {
    q: [],                 // full argument tuples
    enabled: true,
    userId: null,
    props: {},
    flags: Object.create(null),
    start: Date.now(),
    tags: new Set(),
    recording: false
  };

  function enqueue(tuple){
    try {
      if (state.q.length >= MAX_Q) state.q.shift();
      state.q.push([].slice.call(tuple));
    } catch {}
    return state.q.length;
  }

  // ===== Core API (synchron, truthy) =====
  function hj(){
    if (!state.enabled) return true;
    enqueue(arguments);
    try {
      const args = Array.prototype.slice.call(arguments);
      const cmd  = String(args[0]||'').toLowerCase();
      switch(cmd){
        case 'identify':        return hj.identify(args[1], args[2]);
        case 'event':           return hj.event(args[1], args[2]);
        case 'trigger':         return hj.event(args[1], args[2]);
        case 'statechange':     return hj.stateChange(args[1]);
        case 'vpv':             return hj.stateChange(args[1]);
        case 'tag':             return hj.tag(args[1]);
        case 'tagrecording':    return hj.tag(args[1]);
        case 'consent':         return hj.consent(args[1]);
        case 'record':          return hj.record(args[1]);
        case 'pauseRecordings': return hj.pauseRecordings();
        case 'resumeRecordings':return hj.resumeRecordings();
        case 'debug':           return hj.debug(args[1]);
        case 'getdata':         return hj.getData();
        default:                return true;
      }
    } catch { return true; }
  }

  // ===== Methods =====
  hj.identify = function(id, traits){
    if (id != null) state.userId = String(id);
    if (traits && typeof traits === 'object') Object.assign(state.props, traits);
    return true;
  };
  hj.event = function(name, params){
    // alias: trigger – akzeptiert beliebige Eventnamen/Parameter
    return true;
  };
  hj.stateChange = function(url){
    // virtual pageview
    if (typeof url === 'string') state.props.page = url;
    return true;
  };
  hj.tag = function(tags){
    // accepts array|string|object
    try {
      if (Array.isArray(tags)) tags.forEach(t => state.tags.add(String(t)));
      else if (tags && typeof tags === 'object') Object.keys(tags).forEach(k => { if (tags[k]) state.tags.add(String(k)); });
      else if (typeof tags === 'string') state.tags.add(tags);
    } catch {}
    return true;
  };
  hj.debug   = function(on){ state.flags.debug = !!on; return true; };
  hj.consent = function(granted){ state.flags.consent = !!granted; return true; };

  hj.record = function(on){
    if (typeof on === 'boolean') state.recording = on;
    else state.recording = true;
    return true;
  };
  hj.pauseRecordings  = function(){ state.recording = false; return true; };
  hj.resumeRecordings = function(){ state.recording = true;  return true; };

  // Control
  hj.stop  = function(){ state.enabled = false; return true; };
  hj.start = function(){ state.enabled = true;  return true; };

  // ===== Public markers (stealthy) =====
  ro(hj, 'q', state.q);                 // full tuples like original
  ro(hj, '_ready', true);               // gängige Prüfung
  ro(hj, 'version', '1.0');             // innocuous marker

  // Live-Getter (nicht enum)
  roGetter(hj, 'uid', ()=>state.userId);
  roGetter(hj, 'sid', ()=>state.start.toString(36));
  roGetter(hj, 'recording', ()=>state.recording);

  // _hjSettings / _hjOnReady Kompat
  if (typeof window._hjSettings === 'object' && window._hjSettings) {
    ro(hj, 'settings', window._hjSettings);
  }
  // Seiten rufen oft _hjOnReady.push(fn) – wir führen fn sofort aus
  if (!Array.isArray(window._hjOnReady)) {
    try { Object.defineProperty(window, '_hjOnReady', { value: [], writable:true, configurable:true, enumerable:false }); }
    catch { window._hjOnReady = []; }
  }
  try {
    Object.defineProperty(window._hjOnReady, 'push', {
      value: function(fn){ try { if (typeof fn === 'function') fn(); } catch {} return 1; },
      writable:true, configurable:true, enumerable:false
    });
  } catch {}

  // Native-like fingerprints
  try {
    hj.toString               = nativeFn('hj');
    hj.identify.toString      = nativeFn('identify');
    hj.event.toString         = nativeFn('event');
    hj.stateChange.toString   = nativeFn('stateChange');
    hj.tag.toString           = nativeFn('tag');
    hj.debug.toString         = nativeFn('debug');
    hj.consent.toString       = nativeFn('consent');
    hj.stop.toString          = nativeFn('stop');
    hj.start.toString         = nativeFn('start');
    hj.record.toString        = nativeFn('record');
    hj.pauseRecordings.toString  = nativeFn('pauseRecordings');
    hj.resumeRecordings.toString = nativeFn('resumeRecordings');
  } catch {}

  // getData – häufige Integrationsabfrage (synthetisch, aber stabil)
  hj.getData = function(){
    return {
      userId: state.userId,
      recording: state.recording,
      tags: Array.from(state.tags),
      props: Object.assign({}, state.props),
      started: state.start
    };
  };
  try { hj.getData.toString = nativeFn('getData'); } catch {}

  // Export (writable/configurable/extensible)
  try { Object.defineProperty(window, 'hj', { value: hj, writable:true, configurable:true, enumerable:false }); }
  catch { window.hj = hj; }

})();
