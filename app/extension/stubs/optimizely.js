/* eslint-disable no-console */
/*!
 * Protecto Optimizely Web Stub – High‑fidelity MV3 version
 * --------------------------------------------------------
 * Ziel: API‑kompatibles, stealthy Verhalten ohne Netzwerkzugriffe.
 * Eigenschaften:
 *  - Idempotent (Mehrfachladen sicher)
 *  - Kompatibel mit gängigen Mustern: window.optimizely als Array/Queue
 *    und push([...]) / push({type: ...}) / push(function(){...})
 *  - Events: on/off/once/emit, ready()
 *  - API: activate, track, set, get, variation, decision, log, flush, version
 *  - Visitor/Attributes, Variation‑Bucketing (deterministisch), Consent‑Helper
 *  - Deep‑Clone, Memory‑Store (TTL), Rate‑Limiter, native‑like toString()
 *  - Plausible get('state') / get('visitor') / get('variationMap') Shape
 *  - Keine roten Netzwerkfehler – rein in‑memory
 */
(function(){
  'use strict';

  // --- Idempotenz --------------------------------------------------------------
  if (window && window.optimizely && window.optimizely.__isStub) {
    try { window.optimizely.__metrics.reinstallCount++; } catch (_) {}
    return;
  }

  // --- Helpers ----------------------------------------------------------------
  var NATIVE_TOSTRING = 'function () { [native code] }';
  function nativeLike(name, fn) {
    try { Object.defineProperty(fn, 'name', { value: name }); } catch (_) {}
    try { Object.defineProperty(fn, 'toString', { value: function(){ return 'function ' + name + '() { [native code] }'; } }); } catch(_){}
    return fn;
  }
  function defineRO(obj, key, val) {
    try { Object.defineProperty(obj, key, { value: val, writable: false, enumerable: false, configurable: false }); }
    catch(_) { try { obj[key] = val; } catch(__){} }
  }
  function now(){ return Date.now ? Date.now() : +new Date(); }
  function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }
  function deepClone(v, d){
    if (v == null || typeof v !== 'object') return v;
    if (d && d>50) return v;
    if (Array.isArray(v)) { var a=new Array(v.length); for(var i=0;i<v.length;i++) a[i]=deepClone(v[i],(d||0)+1); return a; }
    var o={}; for (var k in v) if (Object.prototype.hasOwnProperty.call(v,k)) o[k]=deepClone(v[k],(d||0)+1); return o;
  }
  function hash32(str){ var h=2166136261>>>0; for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
  function clamp(s, n){ s=String(s==null?'':s); return s.length>n ? s.slice(0,n) : s; }
  function uid(prefix){ return (prefix||'opt') + '_' + now().toString(36) + '_' + Math.floor(Math.random()*1e6).toString(36); }

  // Rate‑Limiter (pro Minute)
  function Limiter(maxPerMin){ this.max=Math.max(1,maxPerMin||240); this.buf=[]; this.win=60000; }
  Limiter.prototype.ok = function(ts){ ts=ts||now(); this.buf.push(ts); var cut=ts-this.win; while(this.buf.length && this.buf[0] < cut) this.buf.shift(); return this.buf.length <= this.max; };

  // Memory‑Store mit TTL
  function Mem(){ this.m = Object.create(null); }
  Mem.prototype.set = function(k,v,ttl){ this.m[k] = { v: deepClone(v), e: ttl ? (now()+ttl) : 0 }; };
  Mem.prototype.get = function(k){ var o=this.m[k]; if(!o) return undefined; if(o.e && now()>o.e){ delete this.m[k]; return undefined; } return deepClone(o.v); };
  Mem.prototype.del = function(k){ delete this.m[k]; };

  // --- Event Emitter -----------------------------------------------------------
  function Emitter(){ this._e = Object.create(null); }
  Emitter.prototype.on = nativeLike('on', function(n, f){ if(!n||typeof f!=='function') return this; (this._e[n]||(this._e[n]=[])).push(f); return this; });
  Emitter.prototype.off = nativeLike('off', function(n, f){ var a=this._e[n]; if(!a) return this; if(!f){ this._e[n]=[]; return this; } for(var i=a.length-1;i>=0;i--) if(a[i]===f) a.splice(i,1); return this; });
  Emitter.prototype.once = nativeLike('once', function(n, f){ if(!n||typeof f!=='function') return this; var s=this; function w(){ s.off(n,w); try{ f.apply(s, arguments); }catch(_){} } this.on(n,w); return this; });
  Emitter.prototype.emit = nativeLike('emit', function(n){ var a=this._e[n]; if(!a||!a.length) return 0; var args=[].slice.call(arguments,1); for(var i=0;i<a.length;i++){ try{ a[i].apply(this,args); }catch(_){ } } return a.length; });

  // --- Pre‑Queue sichern -------------------------------------------------------
  var preQ = Array.isArray(window && window.optimizely) ? window.optimizely.slice() : [];

  // --- Core API ----------------------------------------------------------------
  function createAPI(){
    var em = new Emitter();
    var limiter = new Limiter(360);
    var store = new Mem();

    var metrics = { createdAt: now(), commandsProcessed: 0, dropped: 0, reinstallCount: 0, version: 'stub-2.0.0' };

    var state = {
      id: uid('opt'),
      session: uid('sess'),
      ready: false,
      config: { debug: false },
      user: { id: null, anon: 'anon_'+Math.random().toString(36).slice(2) },
      attributes: {},
      page: { url: (typeof location!=='undefined'?location.href:''), referrer: (typeof document!=='undefined'?(document.referrer||''):'') },
      experiments: Object.create(null),
      variationMap: Object.create(null),
      logs: [],
      lastFlush: 0
    };

    function dlog(level, msg, data){
      var e = { t: now(), level: level, msg: String(msg||''), data: deepClone(data) };
      if (state.logs.length > 1000) state.logs.shift();
      state.logs.push(e);
      if (state.config.debug && typeof console !== 'undefined' && console[level]) {
        try { console[level]('[optimizely stub]', msg, data||''); } catch(_){}
      }
    }

    // Debug Toggle via localStorage
    try { if (typeof localStorage!=='undefined' && localStorage.getItem('opt_debug')==='1') state.config.debug = true; } catch(_){}

    // ready()
    var readyP;
    function ready(cb){
      if (!readyP) readyP = Promise.resolve().then(function(){ state.ready = true; em.emit('ready'); return true; });
      if (typeof cb === 'function') em.once('ready', cb);
      return readyP;
    }
    nativeLike('ready', ready);

    // Experiment/Variation helpers -------------------------------------------
    function ensureExp(id){ id=String(id); if(!state.experiments[id]) state.experiments[id] = { id:id, name:'Experiment '+id, variations:['0','1'], status:'Running' }; return state.experiments[id]; }
    function bucket(expId){ var uid = state.user.id || state.user.anon; var h = hash32(String(uid)+'|'+String(expId)); var exp = ensureExp(expId); var idx = h % exp.variations.length; var v = exp.variations[idx]; state.variationMap[expId] = v; return v; }

    // activate / view
    function activateCmd(input){
      var id = isObj(input) ? (input.id || input.experimentId || input.experiment) : input;
      if (!id) return false;
      var v = bucket(id);
      em.emit('activate', { experiment: String(id), variation: v, ts: now() });
      dlog('info','activate',{ id:id, variation:v });
      return v;
    }
    nativeLike('activate', activateCmd);

    // track
    function trackCmd(name, attrs){
      if (isObj(name) && name.type) { attrs = name.tags || name.attributes || {}; name = name.event || name.type; }
      name = clamp(name, 128);
      attrs = isObj(attrs) ? deepClone(attrs) : {};
      if (!limiter.ok()) { metrics.dropped++; return false; }
      var rec = { type: 'event', name: name, attrs: attrs, ts: now() };
      em.emit('track', rec);
      dlog('info','track', rec);
      return true;
    }
    nativeLike('track', trackCmd);

    // set / get / is -----------------------------------------------------------
    function setCmd(k, v){
      if (k && typeof k === 'object') { for (var kk in k) if (Object.prototype.hasOwnProperty.call(k,kk)) setCmd(kk, k[kk]); return true; }
      var key = String(k);
      switch(key){
        case 'userId':
          state.user.id = clamp(v, 128); em.emit('user', { id: state.user.id }); break;
        case 'visitorId':
          state.user.id = clamp(v, 128); em.emit('user', { id: state.user.id }); break;
        case 'attributes':
          if (v && typeof v==='object') { for (var a in v) if (Object.prototype.hasOwnProperty.call(v,a)) state.attributes[a] = deepClone(v[a]); }
          em.emit('attributes', deepClone(state.attributes));
          break;
        default:
          state[key] = deepClone(v);
      }
      dlog('info','set', { key:key, value:v });
      return true;
    }
    nativeLike('set', setCmd);

    function getCmd(k){
      var key = String(k);
      switch(key){
        case 'state':
          return {
            getVariationMap: nativeLike('getVariationMap', function(){ return deepClone(state.variationMap); }),
            getData: nativeLike('getData', function(){ return {
              experiments: deepClone(state.experiments),
              attributes: deepClone(state.attributes),
              page: deepClone(state.page)
            }; }),
            // Commonly accessed in some integrations
            getCampaignStates: nativeLike('getCampaignStates', function(){ return {}; })
          };
        case 'data': return { experiments: deepClone(state.experiments), attributes: deepClone(state.attributes), page: deepClone(state.page) };
        case 'variationMap': return deepClone(state.variationMap);
        case 'visitor': return { id: state.user.id || state.user.anon, attributes: deepClone(state.attributes) };
        case 'user': return deepClone(state.user);
        case 'config': return deepClone(state.config);
        default: return state[key];
      }
    }
    nativeLike('get', getCmd);

    function isCmd(flag){ return !!state[flag]; }
    nativeLike('is', isCmd);

    // variation / decision shortcuts ------------------------------------------
    function variationCmd(expId){ var v = state.variationMap[String(expId)]; return v == null ? bucket(expId) : v; }
    nativeLike('variation', variationCmd);
    function decisionCmd(expId){ return { experiment: String(expId), variation: variationCmd(expId) }; }
    nativeLike('decision', decisionCmd);

    // log/flush/version ---------------------------------------------------------
    function readLog(){ return deepClone(state.logs); }
    nativeLike('log', readLog);
    function flush(){ state.lastFlush = now(); em.emit('flush', { t: state.lastFlush }); return true; }
    nativeLike('flush', flush);
    function version(){ return 'optimizely-stub/2.0.0'; }
    nativeLike('version', version);

    // Consent‑Helper ------------------------------------------------------------
    var consentKey = 'opt_consent';
    var consent = {
      set: nativeLike('set', function(v){ store.set(consentKey, !!v); em.emit('consent', !!v); return true; }),
      get: nativeLike('get', function(){ var val = store.get(consentKey); return val == null ? undefined : !!val; })
    };

    // Router für push([...]) & push({type}) ------------------------------------
    function route(cmd){
      metrics.commandsProcessed++;
      try {
        if (!cmd) return;
        if (typeof cmd === 'function') { cmd.call(api); return; }
        if (Array.isArray(cmd)) {
          var name = String((cmd[0]||'')+'').toLowerCase();
          var args = cmd.slice(1);
          switch(name){
            case 'on': return api.on.apply(api,args);
            case 'off': return api.off.apply(api,args);
            case 'once': return api.once.apply(api,args);
            case 'ready': return ready.apply(api,args);
            case 'activate': return activateCmd.apply(api,args);
            case 'track': return trackCmd.apply(api,args);
            case 'set': return setCmd.apply(api,args);
            case 'get': return getCmd.apply(api,args);
            case 'variation': return variationCmd.apply(api,args);
            case 'decision': return decisionCmd.apply(api,args);
            case 'flush': return flush.apply(api,args);
            case 'version': return version.apply(api,args);
            default: dlog('warn','Unknown array command', { cmd:name, args: args });
          }
        } else if (isObj(cmd) && cmd.type) {
          // Optimizely often pushes objects: { type: 'event', event: 'x', tags: {...} }
          var t = String(cmd.type).toLowerCase();
          switch(t){
            case 'event': return trackCmd(cmd.event||cmd.name||cmd.type, cmd.tags||cmd.attributes||{});
            case 'activate': return activateCmd(cmd);
            case 'visitor': return setCmd('visitorId', cmd.id || cmd.userId);
            case 'user': return setCmd('userId', cmd.id || cmd.userId);
            case 'set': return setCmd(cmd.key||cmd.k, cmd.value||cmd.v);
            default: dlog('warn','Unknown object command', cmd);
          }
        }
      } catch (e) {
        dlog('error','Command error', { e: String(e && e.message || e), cmd: cmd });
      }
    }

    // push interface ------------------------------------------------------------
    function push(){ for (var i=0;i<arguments.length;i++) route(arguments[i]); return api.length; }
    nativeLike('push', push);

    // Öffentliches Objekt (callable Array‑like) --------------------------------
    var api = function(){ return push.apply(api, arguments); };

    // Event‑APIs
    api.on = nativeLike('on', function(name, fn){ em.on(name, fn); return api; });
    api.off = nativeLike('off', function(name, fn){ em.off(name, fn); return api; });
    api.once = nativeLike('once', function(name, fn){ em.once(name, fn); return api; });
    api.emit = nativeLike('emit', function(){ return em.emit.apply(em, arguments); });

    // Core methods
    api.ready = ready;
    api.activate = activateCmd;
    api.track = trackCmd;
    api.set = setCmd;
    api.get = getCmd;
    api.is = isCmd;
    api.variation = variationCmd;
    api.decision = decisionCmd;
    api.log = readLog;
    api.flush = flush;
    api.version = version;
    api.consent = consent;

    // Metadaten / Flags
    defineRO(api, '__isStub', true);
    defineRO(api, '__metrics', metrics);
    defineRO(api, '__state', state);
    defineRO(api, '__store', store);
    defineRO(api, 'length', 0);

    // Plausibles JSON
    try { defineRO(api, 'toJSON', nativeLike('toJSON', function(){ return { id: state.id, session: state.session, version: version() }; })); } catch(_){}

    // native‑like callable
    try { Object.defineProperty(api, 'toString', { value: function(){ return '[object Optimizely]'; } }); } catch(_) {}

    // Async Ready (wie echte SDKs)
    setTimeout(function(){ api.ready(); }, 0);

    return api;
  }

  // --- Installation ------------------------------------------------------------
  var existing = window.optimizely;
  var api = createAPI();

  // "Array‑like" shape beibehalten – viele Seiten prüfen optmizely.length
  try { Object.defineProperty(api, 'length', { get: function(){ return api.__metrics ? api.__metrics.commandsProcessed : 0; } }); } catch(_) {}

  // Export
  try { Object.defineProperty(window, 'optimizely', { value: api, writable: false }); } catch(_) { window.optimizely = api; }

  // Vorhandene Queue abarbeiten
  if (Array.isArray(existing) && existing.length) {
    for (var i=0;i<existing.length;i++) {
      try { api.push(existing[i]); } catch(_) {}
    }
  }

  // Kompatibilität: manche Integrationen lesen window.optimizely.get('state').getVariationMap()
  // (ist bereits implementiert)

  // Harmloser Reset/Enable/Disable – häufig abgefragt
  api.enable = nativeLike('enable', function(){ api.__state.enabled = true; return true; });
  api.disable = nativeLike('disable', function(){ api.__state.enabled = false; return true; });
  api.reset = nativeLike('reset', function(){ api.__state.variationMap = {}; api.__store.del('opt_consent'); api.emit('reset'); return true; });

  // Markiere Stub‑Installation im Window für Debugtools (nicht enumerable)
  defineRO(window, '__PROTECTO_OPTIMIZELY_STUB__', true);

  // Optional: Silent log
  try { if (api.__state.config.debug) console.debug('[optimizely stub] ready'); } catch(_){}
})();