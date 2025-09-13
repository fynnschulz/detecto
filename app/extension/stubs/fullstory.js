/*
 * Protecto FullStory Stub (FS) – high‑fidelity, stealth compatible
 * Goals:
 *  - Provide a drop‑in API surface for FullStory so sites think FS is loaded
 *  - Never network, never crash; maintain 200 OK when served as stub
 *  - Capture calls in memory for debugging/telemetry (optional)
 *  - Support both v1 style (FS.identify, FS.setUserVars, FS.getCurrentSessionURL)
 *    and v2 style command bus (FS('event', ...), FS('shutdown'), FS('getSession', {format:'url'}) )
 *
 * References (API behavior):
 *  - Identify Users: FS.identify(uid, userVars) – developer.fullstory.com (v1) 
 *  - Shutdown/Restart capture: FS('shutdown'|'restart') – developer.fullstory.com (v2)
 *  - Get session URL/ID: FS.getCurrentSessionURL(now?) and FS('getSession', {format})
 */
(function initProtectoFS(){
  try {
    if (window.FS && window.FS.__PROTECTO_STUB__) return; // idempotent

    const __DBG__ = !!window.__PROTECTO_DEBUG__;
    const NAMESPACE = (window._fs_namespace || 'FS');

    // Utility helpers
    const now = () => Date.now();
    const randHex = (n=16)=> Array.from({length:n},()=>Math.floor(Math.random()*16).toString(16)).join('');
    // const deepFreeze = (obj)=>{ try{ Object.freeze(obj); Object.getOwnPropertyNames(obj).forEach(p=>{
    //   const v = obj[p]; if (v && typeof v==='object' && !Object.isFrozen(v)) deepFreeze(v);
    // }); }catch{} return obj; };
    const clone = (v)=>{ try{ return JSON.parse(JSON.stringify(v)); }catch{ return v; } };
    const safeCall = (fn, args=[])=>{ try{ return fn.apply(null,args); }catch(e){ if(__DBG__) console.debug('[FS stub] call error', e); }};

    // Internal state
    const state = {
      startedAt: now(),
      orgId: '',
      shutdown: false,
      consent: true,
      uid: null,
      userVars: {},
      props: {}, // generic properties via setVars/ setUserVars
      page: { url: location.href, title: document.title },
      session: {
        id: randHex(16),
        url: `${location.origin}/client-session/${randHex(24)}`,
        startedAt: now()
      },
      device: { id: randHex(16) },
      queue: [], // captured calls
      readyCbs: [],
    };

    // Logging helper
    function log(){ if(__DBG__) try{ console.debug('[FS stub]', ...arguments);}catch{} }

    // Ready callback plumbing (mimic _fs_ready)
    window._fs_ready = function(cb){ if(typeof cb==='function'){ state.readyCbs.push(cb); queueMicrotask(()=>safeCall(cb)); }};

    // Queue serialization for telemetry
    function record(event, payload){
      const item = { ts: now(), event, payload: clone(payload) };
      if (state.queue.length > 1000) state.queue.shift();
      state.queue.push(item);
      log('event', event, payload);
      return item;
    }

    // v1 style API methods
    function identify(uid, userVars){
      if (uid && typeof uid !== 'string') uid = String(uid);
      state.uid = uid || null;
      if (userVars && typeof userVars==='object') Object.assign(state.userVars, clone(userVars));
      record('identify', { uid: state.uid, userVars: state.userVars });
    }

    function setUserVars(vars){
      if (vars && typeof vars==='object') Object.assign(state.userVars, clone(vars));
      record('setUserVars', { userVars: state.userVars });
    }

    function event(name, props){
      record('event', { name: String(name||'') , props: clone(props||{}) });
    }

    function logApi(message, level){ // alias to console log levels
      const lvl = (level||'log').toLowerCase();
      record('log', { level: lvl, message: String(message||'') });
      try{ (console[lvl] || console.log).call(console, '[FS]', message); }catch{}
    }

    function consent(granted){
      state.consent = !!granted; record('consent', { granted: state.consent });
    }

    function shutdown(){ state.shutdown = true; record('shutdown', {}); }
    function restart(){ state.shutdown = false; record('restart', {}); }

    function anonymize(){
      // Drop identity and start a new anon session
      state.uid = null; state.userVars = {};
      state.session = { id: randHex(16), url: `${location.origin}/client-session/${randHex(24)}`, startedAt: now() };
      record('anonymize', {});
    }

    function clearUserCookie(){
      try{ document.cookie.split(';').forEach(c=>{ const n=c.split('=')[0].trim(); document.cookie=`${n}=; Max-Age=0; path=/`;}); }catch{}
      record('clearUserCookie', {});
    }

    function getCurrentSessionURL(nowFlag){
      // v1: optional boolean now?
      record('getCurrentSessionURL', { now: !!nowFlag });
      return state.session.url + (nowFlag? `?t=${Date.now()}` : '');
    }

    // v2 style command bus (FS('cmd', args))
    function command(cmd, payload){
      cmd = (cmd||'').toString().toLowerCase();
      switch(cmd){
        case 'event':
          return event(payload && payload.name || '', payload && payload.properties);
        case 'log':
          return logApi(payload && payload.message, payload && payload.level);
        case 'setvars':
          return setVars(payload||{});
        case 'setuservars':
          return setUserVars(payload||{});
        case 'identify':
        case 'setidentity':
          if (payload && typeof payload==='object') return identify(payload.uid, payload.userVars||payload.properties);
          return;
        case 'shutdown':
          return shutdown();
        case 'restart':
          return restart();
        case 'consent':
          return consent(!!(payload && (payload.granted ?? payload)));
        case 'anonymize':
          return anonymize();
        case 'getsession':
          // payload { format: 'url'|'id' }
          record('getSession', { format: payload && payload.format });
          if (!payload || payload.format === 'url') return state.session.url;
          if (payload.format === 'id') return state.session.id;
          return { id: state.session.id, url: state.session.url };
        case 'observe':
          // Accept and immediately invoke with a snapshot-like object
          if (payload && typeof payload==='function') safeCall(payload, [{type:'session', value:{ id: state.session.id, url: state.session.url }}]);
          return;
        default:
          record('unknownCommand', { cmd, payload });
      }
    }

    function setVars(vars){
      if (vars && typeof vars==='object') Object.assign(state.props, clone(vars));
      record('setVars', { vars: state.props });
    }

    // Exposed object (callable + methods)
    function FS(){ return command.apply(null, arguments); }

    // Attach methods (v1 compatibility)
    Object.defineProperties(FS, {
      __PROTECTO_STUB__: { value: true, writable: true, configurable: true },
      identify: { value: identify, writable: true, configurable: true },
      setUserVars: { value: setUserVars, writable: true, configurable: true },
      event: { value: event, writable: true, configurable: true },
      log: { value: logApi, writable: true, configurable: true },
      consent: { value: consent, writable: true, configurable: true },
      shutdown: { value: shutdown, writable: true, configurable: true },
      restart: { value: restart, writable: true, configurable: true },
      anonymize: { value: anonymize, writable: true, configurable: true },
      clearUserCookie: { value: clearUserCookie, writable: true, configurable: true },
      setVars: { value: setVars, writable: true, configurable: true },
      getCurrentSessionURL: { value: getCurrentSessionURL, writable: true, configurable: true },
      getSession: { value: ()=>({ id: state.session.id, url: state.session.url }), writable: true, configurable: true },
      // Introspection helpers
      __getState: { value: ()=>clone(state), writable: true, configurable: true },
      __drainQueue: { value: ()=>clone(state.queue), writable: true, configurable: true },
      toString: { value: ()=> 'function FS() { [native code] }', writable: true, configurable: true }
    });

    // Also expose namespace alias if site changed it
    window[NAMESPACE] = FS;
    // Historical globals observed in integrations
    window.FS = FS;

    // Make main object non-extensible and readonly-ish
    // try{ Object.seal(FS); }catch{}

    // If there was a pre-queue array (e.g., window.FS = window.FS || []), drain it
    try {
      if (Array.isArray(window.FS) && window.FS.length){
        const prev = window.FS.slice();
        window.FS.length = 0;
        prev.forEach(call=>{
          try{
            if (Array.isArray(call)) {
              // v2 style queued commands: ['event', {name:".."}]
              command.apply(null, call);
            } else if (call && typeof call==='object' && call.command){
              command(call.command, call.payload);
            }
          }catch(e){ if(__DBG__) console.debug('[FS stub] drain error', e); }
        });
      }
    } catch {}

    log('initialized', { ns: NAMESPACE, session: state.session });
  } catch (e) {
    try{ console.warn('[FS stub] init failed', e); }catch{}
  }
})();
