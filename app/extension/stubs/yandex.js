/**
 * Protecto — Yandex Metrica Stub (ym / yaCounter*)
 *
 * Stealth goals
 *  - Provide a realistic, network‑free drop‑in for Yandex Metrica’s browser API.
 *  - Support the common snippet interface: global function `ym` with pre‑queue `ym.a`.
 *  - Optionally expose classic counter objects `window.yaCounter<ID>` with minimal API.
 *  - Never touch the network or cookies; keep behaviour synchronous where safe.
 *
 * Covered API (subset used widely in the wild):
 *  - ym(counterId, 'init', options)
 *  - ym(counterId, 'hit', url, params?)
 *  - ym(counterId, 'reachGoal', name, params?, cb?)
 *  - ym(counterId, 'params', obj)
 *  - ym(counterId, 'userParams', obj)
 *  - ym(counterId, 'setUserID', id)
 *  - ym(counterId, 'notBounce', params?)
 *  - ym(counterId, 'addFileExtension', ext | [ext])
 *  - ym(counterId, 'getClientID', cb) → cb(clientId)
 *
 * Notes
 *  - Idempotent install; adopts any pre‑queued calls in ym.a.
 *  - Generates a per‑tab stable clientId and sessionId.
 *  - Exposes minimal yaCounter<ID> object for legacy sites.
 */
(function(){
  if (typeof window !== 'object') return;
  const W = window;
  if (W.__PROTECTO_YM_STUB__) return; // already installed
  Object.defineProperty(W, '__PROTECTO_YM_STUB__', { value: true, configurable: false });

  const DEBUG = !!W.__PROTECTO_DEBUG__;
  const log = (...a)=>{ try{ if (DEBUG) console.debug('[Protecto][YM]', ...a); }catch{} };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  const defRO  = (obj,key,val)=>{ try{ Object.defineProperty(obj, key, { value: val, writable:false, enumerable:false, configurable:false }); }catch{ obj[key]=val; } };
  const clone  = (x)=>{ try{ return x && typeof x==='object' ? JSON.parse(JSON.stringify(x)) : x; }catch{ return x; } };
  const nativeToString = (name)=>`function ${name}() { [native code] }`;
  const nextTick = (fn)=>{ try{ Promise.resolve().then(fn); } catch { setTimeout(fn, 0); } };
  const randHex = (n=16)=>{ const a='abcdef0123456789'; let s=''; for(let i=0;i<n;i++) s+=a[(Math.random()*a.length)|0]; return s; };
  const now = ()=>Date.now();

  // Stable per‑tab identifiers
  const CID_KEY = '__protecto_ym_client_id';
  const SID_KEY = '__protecto_ym_session_id';
  let clientId = null, sessionId = null;
  try {
    clientId = sessionStorage.getItem(CID_KEY);
    sessionId = sessionStorage.getItem(SID_KEY);
  } catch {}
  if (!clientId) { clientId = `${now().toString(36)}-${randHex(8)}-${randHex(4)}`; try{ sessionStorage.setItem(CID_KEY, clientId); }catch{} }
  if (!sessionId) { sessionId = `${randHex(12)}`; try{ sessionStorage.setItem(SID_KEY, sessionId); }catch{} }

  // ---------------------------------------------------------------------------
  // Internal state per counter
  // ---------------------------------------------------------------------------
  const counters = Object.create(null); // id → { options, params, userParams, goals, lastHit, fileExt }

  function ensureCounter(id){
    const key = String(id);
    if (!counters[key]) {
      counters[key] = {
        id: key,
        created: now(),
        options: {},
        params: {},
        userParams: {},
        goals: [],        // { name, params, ts }
        hits: [],         // { url, params, ts }
        fileExt: [],
        shown: false,
        lastUpdate: null
      };
      exposeLegacyCounter(key);
    }
    return counters[key];
  }

  // Minimal legacy `yaCounter<ID>` object for older integrations
  function exposeLegacyCounter(id){
    const name = 'yaCounter' + id;
    if (W[name]) return; // keep existing
    const c = ensureCounter(id);
    const api = {
      reachGoal: function(name, params){ ym(id, 'reachGoal', name, params); },
      params:    function(obj){ ym(id, 'params', obj); },
      userParams:function(obj){ ym(id, 'userParams', obj); },
      setUserID: function(uid){ ym(id, 'setUserID', uid); },
      getClientID: function(cb){ ym(id, 'getClientID', cb); }
    };
    try { Object.defineProperty(api, 'toString', { value: ()=>"[object Object]", enumerable:false }); } catch {}
    try { Object.defineProperty(W, name, { value: api, writable:false, enumerable:false, configurable:true }); } catch { W[name] = api; }
  }

  // ---------------------------------------------------------------------------
  // ym facade function
  // ---------------------------------------------------------------------------
  const preQueue = (typeof W.ym === 'function' && Array.isArray(W.ym.a)) ? W.ym.a.slice() : [];

  function ym(counterId, method){
    try{
      const id = counterId;
      const cmd = String(method||'').trim();
      const rest = Array.prototype.slice.call(arguments, 2);
      const c = ensureCounter(id);
      switch(cmd){
        case 'init': {
          const opts = rest[0] && typeof rest[0]==='object' ? clone(rest[0]) : {};
          c.options = { ...c.options, ...opts, app: 'protecto-ym-stub' };
          c.lastUpdate = now();
          log('init', id, opts);
          break;
        }
        case 'hit': {
          const url = String(rest[0] || (W.location && W.location.href) || '/');
          const p = rest[1] && typeof rest[1]==='object' ? clone(rest[1]) : undefined;
          if (c.hits.length > 1000) c.hits.shift();
          c.hits.push({ url, params: p, ts: now() });
          log('hit', id, url, p);
          break;
        }
        case 'reachGoal': {
          const name = String(rest[0]||'').trim();
          const params = rest[1] && typeof rest[1]==='object' ? clone(rest[1]) : undefined;
          const cb = typeof rest[2] === 'function' ? rest[2] : null;
          if (name) c.goals.push({ name, params, ts: now() });
          if (cb) nextTick(()=>{ try{ cb(); }catch{} });
          log('reachGoal', id, name, params);
          break;
        }
        case 'params': {
          const obj = rest[0] && typeof rest[0]==='object' ? rest[0] : {};
          c.params = { ...c.params, ...clone(obj) };
          c.lastUpdate = now();
          log('params', id, clone(obj));
          break;
        }
        case 'userParams': {
          const obj = rest[0] && typeof rest[0]==='object' ? rest[0] : {};
          c.userParams = { ...c.userParams, ...clone(obj) };
          c.lastUpdate = now();
          log('userParams', id, clone(obj));
          break;
        }
        case 'setUserID': {
          const uid = rest[0] != null ? String(rest[0]) : null;
          c.userParams = { ...c.userParams, UserID: uid };
          c.lastUpdate = now();
          log('setUserID', id, uid);
          break;
        }
        case 'notBounce': {
          // Accept but do nothing; often used to mark active session
          log('notBounce', id);
          break;
        }
        case 'addFileExtension': {
          let ext = rest[0];
          if (!Array.isArray(ext)) ext = [ext];
          c.fileExt = Array.from(new Set(c.fileExt.concat(ext.filter(Boolean).map(String))));
          c.lastUpdate = now();
          log('addFileExtension', id, c.fileExt);
          break;
        }
        case 'getClientID': {
          const cb = rest.find(v=>typeof v==='function');
          if (cb) nextTick(()=>{ try{ cb(clientId); }catch{} });
          log('getClientID', id, clientId);
          break;
        }
        default: {
          // Unknown method — ignore quietly to match real tag resilience
          log('unknown', id, cmd);
        }
      }
    }catch(e){ log('error', e); }
  }
  try { ym.toString = ()=>nativeToString('ym'); } catch {}
  Object.defineProperty(ym, 'a', { value: [], writable: true, enumerable: false, configurable: true });
  Object.defineProperty(ym, 'l', { value: +new Date(), writable: true, enumerable: false, configurable: true });

  // Publish global
  W.ym = ym;

  // Drain pre‑queued commands
  if (preQueue && preQueue.length) {
    for (const it of preQueue) {
      try { if (Array.isArray(it)) ym.apply(null, it); } catch {}
    }
  }

  // Debug surface (read‑only)
  Object.defineProperty(ym, '__PROTECTO_STUB__', { value: true, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(ym, '__getState', { value: ()=>{
    const out = {};
    for (const k of Object.keys(counters)) {
      const c = counters[k];
      out[k] = {
        id: c.id,
        options: clone(c.options),
        params: clone(c.params),
        userParams: clone(c.userParams),
        goals: c.goals.slice(-10),
        hits: c.hits.slice(-10),
        fileExt: c.fileExt.slice(0)
      };
    }
    return out;
  }, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(ym, '__clientId', { value: clientId, writable: true, enumerable: false, configurable: true });
  Object.defineProperty(ym, '__sessionId', { value: sessionId, writable: true, enumerable: false, configurable: true });

  log('Yandex Metrica stub active');
})();
