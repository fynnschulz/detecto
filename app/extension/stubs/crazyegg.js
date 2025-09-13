/*
 * Crazy Egg (CE2) – High‑fidelity MV3 Stub
 * ----------------------------------------
 * Ziel: API‑kompatibles, stealthy Verhalten ohne echte Netzwerkaufrufe.
 * Eigenschaften:
 *  - Idempotent (sicher bei Mehrfachladen)
 *  - Kompatibel mit gängigen Mustern: window.CE2 (Array‑Queue), CE_READY, CE_SNAPSHOT_NAME
 *  - Queue‑Verarbeitung für vor Stub gepushte Befehle (CE2.push([...]))
 *  - Events: on/off/once/emit, ready()
 *  - API: track, event, snapshot, heatmap, record, start, stop, set, get, is, log, flush, version
 *  - Consent‑Helper, Memory‑Store (TTL), Rate‑Limiter, Deep‑Clone
 *  - Native‑like toString(), plausible toJSON(), stabile Shape
 *  - Keine roten Netzwerkfehler – rein in‑memory
 */

(function stubCrazyEgg(global){
  'use strict';

  // Bereits installiert?
  if (global && global.CE2 && global.CE2.__isStub) {
    try { global.CE2.__metrics.reinstallCount++; } catch (_) {}
    return; // doppelte Installation vermeiden
  }

  // --- Helpers -----------------------------------------------------------------
  var NATIVE_TOSTRING = 'function () { [native code] }';
  function nativeLike(fn) {
    try { Object.defineProperty(fn, 'toString', { value: function(){ return NATIVE_TOSTRING; }, configurable: true }); } catch(_){}
    return fn;
  }

  function defineRO(obj, key, val) {
    try { obj[key] = val; } catch(_) {}
  }

  function now(){ return Date.now ? Date.now() : +new Date(); }

  function deepClone(v, d){
    if (v == null || typeof v !== 'object') return v;
    if (d && d>50) return v;
    if (Array.isArray(v)) {
      var arr = new Array(v.length);
      for (var i=0;i<v.length;i++) arr[i] = deepClone(v[i], (d||0)+1);
      return arr;
    }
    var out={};
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v,k)) out[k]=deepClone(v[k],(d||0)+1);
    return out;
  }

  function uid(prefix){ return (prefix||'ce') + '_' + now().toString(36) + '_' + Math.floor(Math.random()*1e6).toString(36); }

  // Minimal Emitter
  function Emitter(){ this._e = Object.create(null); }
  Emitter.prototype.on = nativeLike(function(n,f){ if(!n||typeof f!=='function') return this; (this._e[n]||(this._e[n]=[])).push(f); return this; });
  Emitter.prototype.off = nativeLike(function(n,f){ var a=this._e[n]; if(!a) return this; if(!f){ this._e[n]=[]; return this; } for(var i=a.length-1;i>=0;i--) if(a[i]===f) a.splice(i,1); return this; });
  Emitter.prototype.once = nativeLike(function(n,f){ if(!n||typeof f!=='function') return this; var s=this; function w(){ s.off(n,w); try{ f.apply(s,arguments); }catch(_){} } this.on(n,w); return this; });
  Emitter.prototype.emit = nativeLike(function(n){ var a=this._e[n]; if(!a||!a.length) return 0; var args=[].slice.call(arguments,1); for(var i=0;i<a.length;i++){ try{ a[i].apply(this,args); }catch(_){ } } return a.length; });

  // Rate Limiter (pro Minute)
  function Limiter(maxPerMin) { this.max = Math.max(1, maxPerMin || 180); this.buf = []; this.win = 60000; }
  Limiter.prototype.ok = function(ts){ ts = ts || now(); this.buf.push(ts); var cut = ts - this.win; while(this.buf.length && this.buf[0] < cut) this.buf.shift(); return this.buf.length <= this.max; };

  // Memory Store mit TTL
  function Mem(){ this.m = Object.create(null); }
  Mem.prototype.set = function(k,v,ttl){ this.m[k] = { v: deepClone(v), e: ttl ? (now()+ttl) : 0 }; };
  Mem.prototype.get = function(k){ var o=this.m[k]; if(!o) return undefined; if(o.e && now()>o.e){ delete this.m[k]; return undefined; } return deepClone(o.v); };
  Mem.prototype.del = function(k){ delete this.m[k]; };

  // Pre‑Queue sichern (falls CE2 ein Array war)
  var preQ = Array.isArray(global && global.CE2) ? global.CE2.slice() : [];

  // --- Core API ----------------------------------------------------------------
  function createAPI(){
    var em = new Emitter();

    var metrics = { createdAt: now(), commandsProcessed: 0, dropped: 0, reinstallCount: 0, version: 'stub-1.1.0' };
    var limiter = new Limiter(300);
    var store = new Mem();

    var state = {
      id: uid('ce2'),
      ready: false,
      session: uid('sess'),
      config: { debug: false },
      logs: [],
      flags: {},
      heatmap: { enabled: true, last: 0 },
      recording: { enabled: false, frames: 0, startedAt: 0 },
      snapshots: [],
      lastFlush: 0
    };

    function log(level, msg, data){
      var e = { t: now(), level: level, msg: String(msg||''), data: deepClone(data) };
      if (state.logs.length > 1000) state.logs.shift();
      state.logs.push(e);
      if (state.config.debug && typeof console !== 'undefined' && console[level]) {
        try { console[level]('[CrazyEgg stub]', msg, data||''); } catch(_){}
      }
    }

    // ready()
    var readyP;
    function ready(cb){
      if (!readyP) {
        readyP = Promise.resolve().then(function(){ state.ready = true; em.emit('ready'); return true; });
      }
      if (typeof cb === 'function') em.once('ready', cb);
      return readyP;
    }
    nativeLike(ready);

    // track()/event()
    function track(name, props){
      if (!limiter.ok()) { metrics.dropped++; return false; }
      log('info', 'track', { name: name, props: props });
      em.emit('event', { name: name, props: deepClone(props||{}) });
      return true;
    }
    nativeLike(track);
    var eventFn = nativeLike(function(name, props){ return track(name, props); });

    // snapshot(label)
    function snapshot(label){
      var snap = { id: uid('snap'), label: String(label||''), ts: now() };
      state.snapshots.push(snap);
      em.emit('snapshot', deepClone(snap));
      return snap.id;
    }
    nativeLike(snapshot);

    // heatmap.enable/disable/toggle
    function heatmapEnable(){ state.heatmap.enabled = true; state.heatmap.last = now(); em.emit('heatmap', { enabled: true }); return true; }
    function heatmapDisable(){ state.heatmap.enabled = false; state.heatmap.last = now(); em.emit('heatmap', { enabled: false }); return true; }
    function heatmapToggle(v){ state.heatmap.enabled = (typeof v==='boolean'? v : !state.heatmap.enabled); state.heatmap.last = now(); em.emit('heatmap', { enabled: !!state.heatmap.enabled }); return !!state.heatmap.enabled; }
    var heatmap = { enable: nativeLike(heatmapEnable), disable: nativeLike(heatmapDisable), toggle: nativeLike(heatmapToggle) };

    // recording.start/stop/status
    function start(){ state.recording.enabled = true; state.recording.startedAt = now(); em.emit('recording', { enabled: true }); return true; }
    function stop(){ state.recording.enabled = false; em.emit('recording', { enabled: false }); return true; }
    function status(){ return deepClone(state.recording); }
    var record = { start: nativeLike(start), stop: nativeLike(stop), status: nativeLike(status) };

    // set/get/is
    function set(k, v){ if (k && typeof k === 'object') { for (var kk in k) if (Object.prototype.hasOwnProperty.call(k,kk)) state[kk] = deepClone(k[kk]); } else if (typeof k === 'string') { state[k] = deepClone(v); } em.emit('set', { key: k, value: deepClone(v) }); return api; }
    function get(k, fallback){ var v = (k in state) ? state[k] : store.get(k); return v === undefined ? fallback : v; }
    function isF(flag){ return !!state.flags[flag]; }
    nativeLike(set); nativeLike(get); nativeLike(isF);

    // log(), flush(), version()
    function readLog(){ return deepClone(state.logs); }
    function flush(){ state.lastFlush = now(); em.emit('flush', { t: state.lastFlush }); return true; }
    function version(){ return 'crazyegg-stub/1.1.0'; }
    nativeLike(readLog); nativeLike(flush); nativeLike(version);

    // Consent‑Helper
    var consentKey = 'ce_consent';
    var consent = {
      set: nativeLike(function(v){ store.set(consentKey, !!v); em.emit('consent', !!v); return true; }),
      get: nativeLike(function(){ var val = store.get(consentKey); return val == null ? undefined : !!val; })
    };

    // Intern: Command Router (für Array‑Push)
    function route(cmd){
      metrics.commandsProcessed++;
      try {
        if (!cmd) return;
        if (typeof cmd === 'function') { cmd.call(api); return; }
        if (!Array.isArray(cmd)) return;
        var name = cmd[0];
        var args = cmd.slice(1);
        switch(name){
          case 'on': return api.on.apply(api,args);
          case 'off': return api.off.apply(api,args);
          case 'once': return api.once.apply(api,args);
          case 'ready': return ready.apply(api,args);
          case 'track': return track.apply(api,args);
          case 'event': return eventFn.apply(api,args);
          case 'snapshot': return snapshot.apply(api,args);
          case 'set': return set.apply(api,args);
          case 'get': return get.apply(api,args);
          case 'is': return isF.apply(api,args);
          case 'heatmap': return heatmapToggle.apply(api,args);
          case 'record': return (args[0]==='start'? start(): args[0]==='stop'? stop(): status());
          case 'flush': return flush.apply(api,args);
          case 'version': return version.apply(api,args);
          default:
            // Unbekannte Befehle möglichst still tolerieren
            log('warn','Unknown command', { cmd: name, args: args });
        }
      } catch(e){
        log('error','Command error', { e: String(e && e.message || e), cmd: cmd });
      }
    }

    // Öffentliches Objekt als Array mit push override
    var api = [];

    api.push = nativeLike(function(){
      for (var i=0; i<arguments.length; i++) route(arguments[i]);
      return Array.prototype.push.apply(api, arguments);
    });

    // Event‑APIs binden
    api.on = nativeLike(function(name, fn){ em.on(name, fn); return api; });
    api.off = nativeLike(function(name, fn){ em.off(name, fn); return api; });
    api.once = nativeLike(function(name, fn){ em.once(name, fn); return api; });
    api.emit = nativeLike(function(){ return em.emit.apply(em, arguments); });

    // Kern‑Methoden
    api.ready = ready;
    api.track = track;
    api.event = eventFn;
    api.snapshot = snapshot;
    api.heatmap = heatmap;
    api.record = record;
    api.start = record.start;  // häufige Synonyme
    api.stop = record.stop;
    api.set = set;
    api.get = get;
    api.is = isF;
    api.log = readLog;
    api.flush = flush;
    api.version = version;
    api.consent = consent;

    // Metadaten / Flags
    api.__isStub = true;
    api.__metrics = metrics;
    api.__state = state;
    api.__store = store;

    // Plausibles JSON
    try { api.toJSON = nativeLike(function(){ return { id: state.id, session: state.session, version: version() }; }); } catch(_){}

    // native‑like callable
    nativeLike(api);

    // Async Ready (wie echte SDKs)
    setTimeout(function(){ api.ready(); }, 0);

    return api;
  }

  // --- Installation ------------------------------------------------------------
  var existing = global.CE2;
  var api = createAPI();

  // Aliases/Globals, wie von Integrationen erwartet
  global.CE2 = api;
  try { global.CE_SNAPSHOT_NAME = 'snapshot'; } catch(_) { global.CE_SNAPSHOT_NAME = 'snapshot'; }
  try { global.CE_READY = api.ready; } catch(_) { global.CE_READY = api.ready; }

  // Pre‑Queue ausführen
  if (Array.isArray(existing) && existing.length) {
    for (var i=0;i<existing.length;i++) {
      try { api.push(existing[i]); } catch(_) {}
    }
  }

  // Optionale Debug‑Aktivierung via localStorage
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ce_debug') === '1') {
      api.__state.config.debug = true;
    }
  } catch(_){}

  // Zusätzliche, harmlose No‑Ops, die manche Seiten abfragen
  api.enable = nativeLike(function(){ api.__state.flags.enabled = true; return true; });
  api.disable = nativeLike(function(){ api.__state.flags.enabled = false; return true; });
  api.reset = nativeLike(function(){ api.__state.snapshots = []; api.__state.recording = { enabled:false, frames:0, startedAt:0 }; api.__store.del('ce_consent'); api.emit('reset'); return true; });

})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this));