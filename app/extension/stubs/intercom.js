/**
 * Protecto — Intercom Web Stub (stealth)
 *
 * Goal
 *  - Provide a realistic, network‑free drop‑in for the Intercom Web API so pages believe
 *    Intercom is present and working, while we never call the real network.
 *  - Compatible with the common snippet pattern where `window.Intercom` is a function
 *    (queue facade) accepting commands like 'boot', 'shutdown', 'update', 'trackEvent', etc.
 *
 * Design
 *  - Idempotent: safe on multiple injections.
 *  - Queue‑compatible: if a preexisting array/function is present, we adopt/drain it.
 *  - Native‑like: functions return native‑looking toString() results; readonly mirrors.
 *  - No network: everything is held in memory; no cookies set by us.
 *
 * Covered API (subset widely used in the wild):
 *  - Intercom('boot', settings)
 *  - Intercom('shutdown')
 *  - Intercom('update', data)
 *  - Intercom('trackEvent', name, metadata)
 *  - Intercom('show') / ('hide')
 *  - Intercom('showMessages') / ('showNewMessage', text)
 *  - Intercom('onShow', cb) / ('onHide', cb)
 *  - Intercom('getVisitorId') → string
 *  - Intercom('reattach_activator') / ('reattachActivator') — no‑op
 *  - Intercom('startTour', id)
 *  - Intercom('logEvent', name, metadata) — alias of trackEvent
 *
 * Notes
 *  - We store a plausible visitorId/sessionId (stable for the page session).
 *  - We respect `app_id` in boot settings; other fields are accepted and stored.
 */
(function(){
  if (typeof window !== 'object') return;
  const W = window;
  if (W.__PROTECTO_INTERCOM_STUB__) return; // already installed
  W.__PROTECTO_INTERCOM_STUB__ = true;

  const DEBUG = !!W.__PROTECTO_DEBUG__;
  const log = (...a)=>{ try{ if (DEBUG) console.debug('[Protecto][Intercom]', ...a); }catch{} };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  const freeze = (o)=>{ try { return Object.freeze(o); } catch { return o; } };
  const seal   = (o)=>{ try { return Object.seal(o); } catch { return o; } };
  const defRO  = (obj,key,val)=>{ try{ Object.defineProperty(obj, key, { value: val, writable:false, enumerable:false, configurable:false }); }catch{ obj[key]=val; } };
  const clone  = (x)=>{ try{ return x && typeof x==='object' ? JSON.parse(JSON.stringify(x)) : x; }catch{ return x; } };
  const nativeToString = (name)=>`function ${name}() { [native code] }`;
  const nextTick = (fn)=>{ try{ Promise.resolve().then(fn); } catch { setTimeout(fn, 0); } };
  const rand = (n=16)=>{ const a='abcdef0123456789'; let s=''; for(let i=0;i<n;i++) s+=a[(Math.random()*a.length)|0]; return s; };

  // Deterministic per‑tab visitor id
  const VISITOR_KEY = '__protecto_intercom_vid';
  let visitorId = sessionStorage.getItem(VISITOR_KEY);
  if (!visitorId) { visitorId = `${Date.now().toString(36)}_${rand(10)}`; try{ sessionStorage.setItem(VISITOR_KEY, visitorId); }catch{} }

  // ---------------------------------------------------------------------------
  // Internal state
  // ---------------------------------------------------------------------------
  const state = {
    version: 'protecto-intercom-stub/1.0.0',
    booted: false,
    shown: false,
    app_id: null,
    sessionId: rand(12),
    user: {},               // { user_id, email, name, phone, ... }
    company: undefined,     // { id, name, ... }
    page_context: { url: (W.location && W.location.href) || '', referring_domain: (document && document.referrer) || '' },
    events: [],             // { name, metadata, ts }
    callbacks: { onShow: [], onHide: [] },
    lastUpdate: null,
  };

  function emit(ev){
    const list = state.callbacks[ev];
    if (!Array.isArray(list) || !list.length) return;
    for (const cb of list.slice(0, 10)) {
      if (typeof cb === 'function') { try { cb(); } catch {} }
    }
  }

  // ---------------------------------------------------------------------------
  // Core API implementation
  // ---------------------------------------------------------------------------
  function api_boot(settings){
    const s = (settings && typeof settings==='object') ? settings : {};
    state.app_id = s.app_id || state.app_id || null;
    // shallow merge user/company fields Intercom commonly accepts
    if (s.user_id || s.email || s.name) {
      state.user = { ...state.user, user_id: s.user_id || state.user.user_id, email: s.email || state.user.email, name: s.name || state.user.name };
    }
    if (s.company && typeof s.company==='object') {
      state.company = { ...(state.company||{}), ...clone(s.company) };
    }
    state.page_context = {
      url: s.current_url || state.page_context.url,
      referring_domain: s.referrer || state.page_context.referring_domain
    };
    state.booted = true; state.lastUpdate = Date.now();
    log('boot', clone({ app_id: state.app_id, user: state.user, company: state.company }));
  }

  function api_shutdown(){
    state.booted = false; state.shown = false; state.user = {}; state.company = undefined; state.events.length = 0;
    log('shutdown');
  }

  function api_update(data){
    const d = (data && typeof data==='object') ? data : {};
    if (d.user_id || d.email || d.name) state.user = { ...state.user, ...clone({ user_id:d.user_id, email:d.email, name:d.name }) };
    if (d.company && typeof d.company==='object') state.company = { ...(state.company||{}), ...clone(d.company) };
    if (d.app_id) state.app_id = d.app_id;
    state.lastUpdate = Date.now();
    log('update', clone(d));
  }

  function api_trackEvent(name, metadata){
    const n = String(name||'').trim();
    const m = (metadata && typeof metadata==='object') ? metadata : undefined;
    if (!n) return;
    const entry = { name: n, metadata: clone(m), ts: Date.now() };
    if (state.events.length > 1000) state.events.shift();
    state.events.push(entry);
    log('trackEvent', entry);
  }

  function api_show(){ state.shown = true; nextTick(()=>emit('onShow')); log('show'); }
  function api_hide(){ state.shown = false; nextTick(()=>emit('onHide')); log('hide'); }
  function api_showMessages(){ api_show(); }
  function api_showNewMessage(text){ api_show(); if (text) log('showNewMessage', String(text)); }
  function api_onShow(cb){ if (typeof cb==='function') state.callbacks.onShow.push(cb); }
  function api_onHide(cb){ if (typeof cb==='function') state.callbacks.onHide.push(cb); }
  function api_getVisitorId(){ return visitorId; }
  function api_startTour(id){ log('startTour', id); }
  function api_reattach(){ log('reattach_activator'); }

  // Aliases
  const aliases = {
    logEvent: 'trackEvent',
    reattach_activator: 'reattach',
    reattachActivator: 'reattach',
    onClose: 'onHide',
  };

  const handlers = {
    boot: api_boot,
    shutdown: api_shutdown,
    update: api_update,
    trackEvent: api_trackEvent,
    show: api_show,
    hide: api_hide,
    showMessages: api_showMessages,
    showNewMessage: api_showNewMessage,
    onShow: api_onShow,
    onHide: api_onHide,
    getVisitorId: api_getVisitorId,
    startTour: api_startTour,
    reattach: api_reattach,
  };

  function resolveCmd(cmd){
    if (handlers[cmd]) return cmd;
    const a = aliases[cmd];
    return handlers[a] ? a : null;
  }

  // ---------------------------------------------------------------------------
  // Queue facade function (as Intercom snippet does)
  // ---------------------------------------------------------------------------
  const preQueue = Array.isArray(W.Intercom) ? W.Intercom.slice() : (W.Intercom && W.Intercom.q ? W.Intercom.q.slice() : []);

  function IntercomFacade(){
    // Called with (cmd, ...args)
    try{
      const args = Array.prototype.slice.call(arguments);
      if (!args.length) return;
      const cmd = resolveCmd(String(args[0]||''));
      const rest = args.slice(1);
      if (!cmd) { log('unknown command', args[0]); return; }
      try { handlers[cmd].apply(null, rest); } catch(e){ log('handler error', cmd, e); }
    }catch(e){ log('call error', e); }
  }
  try { IntercomFacade.toString = ()=>nativeToString('Intercom'); } catch {}

  // Attach helpers/mirrors similar to real Intercom facade shape
  IntercomFacade.booted = ()=>state.booted;
  IntercomFacade.getVisitorId = api_getVisitorId;
  IntercomFacade.q = [];

  // Publish global
  W.Intercom = IntercomFacade;

  // Drain any pre‑queued calls
  if (preQueue && preQueue.length) {
    for (const it of preQueue) {
      try {
        if (Array.isArray(it)) {
          IntercomFacade.apply(null, it);
        } else if (it && typeof it === 'object' && Array.isArray(it.args)) {
          IntercomFacade.apply(null, it.args);
        }
      } catch{}
    }
  }

  // Debug surface (read‑only clone access)
  IntercomFacade.__PROTECTO_STUB__ = true;
  IntercomFacade.__getState = ()=>clone(state);

  // Lock down some surfaces
  // try{ seal(state); }catch{}
  log('Intercom stub active');
})();