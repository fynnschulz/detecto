/*
 * Protecto Stub – Amplitude (Browser)
 * Goal: be API-compatible enough that sites think Amplitude loaded.
 * – no network calls, no side effects
 * – stores events in memory (and optionally sessionStorage for realism)
 * – supports legacy amplitude-js patterns and Browser SDK v2 style
 */
(function(){
  if (typeof window === 'undefined') return;
  if (window.amplitude && window.amplitude.__PROTECTO_STUB__) return;

  const DEBUG = !!window.__PROTECTO_DEBUG__;
  const now = () => Date.now();
  const safeClone = (v)=>{
    try { return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; } catch { return v; }
  };
  const log = (...a)=>{ if (DEBUG) try{ console.debug('[Protecto][Stub][Amplitude]', ...a); }catch{} };

  // persistent-ish buffers to look real
  const SS_KEY = '__protecto_amp_buffer__';
  const MAX_BUFFER = 200; // cap
  const readBuf = ()=>{
    try { const s = sessionStorage.getItem(SS_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  };
  const writeBuf = (arr)=>{ try { sessionStorage.setItem(SS_KEY, JSON.stringify(arr.slice(-MAX_BUFFER))); } catch{}
  };

  // Minimal Identify object compatible surface
  function Identify(){ this._ops = []; }
  const addOp = (t,k,v)=>({ op:t, key:k, value:safeClone(v) });
  const idProto = Identify.prototype;
  idProto.set = function(k,v){ this._ops.push(addOp('set',k,v)); return this; };
  idProto.setOnce = function(k,v){ this._ops.push(addOp('setOnce',k,v)); return this; };
  idProto.unset = function(k){ this._ops.push(addOp('unset',k,true)); return this; };
  idProto.add = function(k,v){ this._ops.push(addOp('add',k,v)); return this; };
  idProto.append = function(k,v){ this._ops.push(addOp('append',k,v)); return this; };
  idProto.prepend = function(k,v){ this._ops.push(addOp('prepend',k,v)); return this; };
  idProto.preInsert = function(k,v){ this._ops.push(addOp('preInsert',k,v)); return this; };
  idProto.postInsert = function(k,v){ this._ops.push(addOp('postInsert',k,v)); return this; };
  idProto.remove = function(k,v){ this._ops.push(addOp('remove',k,v)); return this; };
  idProto.clearAll = function(){ this._ops.push({op:'clearAll'}); return this; };
  Identify.prototype.toString = function(){ return 'function Identify() { [native code] }'; };

  // Minimal Revenue object
  function Revenue(){ this._props = {}; }
  const rProto = Revenue.prototype;
  rProto.setProductId = function(v){ this._props.productId = String(v); return this; };
  rProto.setPrice = function(v){ this._props.price = Number(v)||0; return this; };
  rProto.setQuantity = function(v){ this._props.quantity = Number(v)||1; return this; };
  rProto.setRevenueType = function(v){ this._props.revenueType = String(v||''); return this; };
  rProto.setEventProperties = function(v){ this._props.properties = safeClone(v)||{}; return this; };
  Revenue.prototype.toString = function(){ return 'function Revenue() { [native code] }'; };

  // Instance factory (Amplitude supports getInstance())
  function createClient(name){
    const state = {
      name: name || 'default',
      apiKey: null,
      userId: null,
      deviceId: Math.random().toString(16).slice(2) + String(now()),
      sessionId: now(),
      optOut: false,
      userProps: {},
      groupProps: {},
      groups: {},
      buffer: readBuf(),
      readyCbs: [],
      inited: false,
    };

    const enqueue = (evt)=>{
      try {
        state.buffer.push(evt);
        if (state.buffer.length > MAX_BUFFER) state.buffer.shift();
        writeBuf(state.buffer);
      } catch {}
    };

    const client = function(){ /* legacy callable noop */ };

    client.init = function(apiKey, userId, options, cb){
      state.apiKey = apiKey || state.apiKey;
      if (userId != null) state.userId = userId;
      state.inited = true;
      log('init', { instance: state.name, apiKey: !!apiKey, userId });
      if (typeof cb === 'function') try { cb(); } catch {}
      // drain any ready callbacks
      setTimeout(()=>{ let f; while((f = state.readyCbs.shift())) try{ f(); }catch{} },0);
      return client;
    };

    client.isNewSession = function(){ return false; };

    client.setUserId = function(uid){ state.userId = uid==null? null : String(uid); return client; };
    client.getUserId = function(){ return state.userId; };

    client.setDeviceId = function(id){ if (id) state.deviceId = String(id); return client; };
    client.getDeviceId = function(){ return state.deviceId; };

    client.setSessionId = function(id){ state.sessionId = Number(id)||now(); return client; };
    client.getSessionId = function(){ return state.sessionId; };

    client.setOptOut = function(flag){ state.optOut = !!flag; return client; };

    client.setUserProperties = function(props){
      if (!props || typeof props !== 'object') return client;
      Object.assign(state.userProps, safeClone(props));
      enqueue({ t:'identify', ops:[{op:'setMany', value: safeClone(props)}], ts: now() });
      return client;
    };
    client.clearUserProperties = function(){ state.userProps = {}; enqueue({t:'identify', ops:[{op:'clearAll'}], ts: now()}); return client; };

    client.group = function(type, name){ if (type) state.groups[type]=name; return client; };
    client.setGroup = function(type, name){ return client.group(type,name); };

    client.identify = function(identify){
      const ops = (identify && identify._ops) ? identify._ops.slice() : [];
      // apply to local userProps for realism
      ops.forEach(({op,key,value})=>{
        if (op === 'set') state.userProps[key] = safeClone(value);
        else if (op === 'setOnce') if (!(key in state.userProps)) state.userProps[key] = safeClone(value);
        else if (op === 'unset') delete state.userProps[key];
        else if (op === 'add') state.userProps[key] = (Number(state.userProps[key])||0) + (Number(value)||0);
        else if (op === 'append') state.userProps[key] = (Array.isArray(state.userProps[key])? state.userProps[key]: []).concat([safeClone(value)]);
        else if (op === 'prepend') state.userProps[key] = [safeClone(value)].concat(Array.isArray(state.userProps[key])? state.userProps[key]: []);
        else if (op === 'preInsert' || op === 'postInsert') {
          const arr = Array.isArray(state.userProps[key]) ? state.userProps[key].slice() : [];
          if (op === 'preInsert' && !arr.includes(value)) arr.unshift(safeClone(value));
          if (op === 'postInsert' && !arr.includes(value)) arr.push(safeClone(value));
          state.userProps[key] = arr;
        } else if (op === 'remove') {
          const arr = Array.isArray(state.userProps[key]) ? state.userProps[key].slice() : [];
          state.userProps[key] = arr.filter(x=>JSON.stringify(x)!==JSON.stringify(value));
        } else if (op === 'clearAll') { state.userProps = {}; }
      });
      enqueue({ t:'identify', ops:safeClone(ops), ts: now() });
      return client;
    };

    client.groupIdentify = function(groupType, groupName, identify){
      const key = groupType+':'+groupName;
      const ops = (identify && identify._ops) ? identify._ops.slice() : [];
      const cur = state.groupProps[key] || {};
      ops.forEach(({op,k,key,value})=>{
        const kk = key||k; // tolerate both fields
        if (op === 'set') cur[kk] = safeClone(value);
        else if (op === 'setOnce') if (!(kk in cur)) cur[kk] = safeClone(value);
        else if (op === 'unset') delete cur[kk];
        else if (op === 'clearAll') for (const p in cur) delete cur[p];
      });
      state.groupProps[key] = cur;
      enqueue({ t:'groupIdentify', gt: groupType, gn: groupName, ops: safeClone(ops), ts: now() });
      return client;
    };

    function makeEvent(eventType, eventProps){
      return {
        event_type: String(eventType||'event'),
        event_properties: safeClone(eventProps)||{},
        user_id: state.userId,
        device_id: state.deviceId,
        session_id: state.sessionId,
        time: now(),
        library: 'protecto-stub-amplitude',
      };
    }

    client.logEvent = function(eventType, eventProps, cb){
      if (state.optOut) return client;
      const evt = makeEvent(eventType, eventProps);
      enqueue({ t:'event', e: evt });
      if (typeof cb === 'function') try{ cb(200, 'success'); }catch{}
      return client;
    };
    client.track = client.logEvent; // alias

    client.logRevenueV2 = function(revenue){
      const payload = revenue && revenue._props ? safeClone(revenue._props) : {};
      const evt = makeEvent('revenue', payload.properties || {});
      evt.revenue = (payload.price||0) * (payload.quantity||1);
      evt.price = payload.price; evt.quantity = payload.quantity; evt.productId = payload.productId; evt.revenueType = payload.revenueType;
      enqueue({ t:'event', e: evt });
      return client;
    };
    client.revenue = client.logRevenueV2; // v2 alias

    client.flush = function(){ /* noop */ return Promise.resolve({ code:200 }); };
    client.reset = function(){ state.userId=null; state.sessionId=now(); state.groups={}; return client; };

    client.getInstance = function(){ return client; };
    client.ready = function(cb){ if (typeof cb==='function') state.readyCbs.push(cb); if (state.inited) setTimeout(()=>client.init(),0); return client; };

    // Expose internals for debugging
    client.__PROTECTO_STUB__ = true;
    Object.defineProperty(client, '_buffer', { get(){ return state.buffer.slice(); } });
    Object.defineProperty(client, '_userProps', { get(){ return Object.assign({}, state.userProps); } });
    Object.defineProperty(client, '_groups', { get(){ return Object.assign({}, state.groups); } });

    // method toString spoofing (native-like)
    const nativeSig = 'function () { [native code] }';
    [
      'init','isNewSession','setUserId','getUserId','setDeviceId','getDeviceId','setSessionId','getSessionId',
      'setOptOut','setUserProperties','clearUserProperties','group','setGroup','identify','groupIdentify','logEvent','track','logRevenueV2','revenue','flush','reset','getInstance','ready'
    ].forEach(name=>{ try { client[name].toString = ()=>nativeSig; } catch{} });

    return client;
  }

  // Global amplitude facade (supports pre-queue style)
  const pre = Array.isArray(window.amplitude) ? window.amplitude.slice() : null;
  const amp = createClient('default');

  // Legacy static constructors
  amp.Identify = Identify; amp.Revenue = Revenue; amp.getInstance = ()=>amp;
  amp.toString = function(){ return 'function amplitude() { [native code] }'; };

  window.amplitude = amp;
  window.amplitude.__PROTECTO_STUB__ = true;

  // Drain any pre-queued commands like: amplitude.push(["init", apiKey, uid, opts])
  if (pre) {
    pre.forEach((cmd)=>{
      try {
        if (!Array.isArray(cmd)) return;
        const [method, a,b,c] = cmd;
        if (typeof amp[method] === 'function') amp[method](a,b,c);
        else if (method === 'identify' && cmd[1] && typeof cmd[1] === 'object') amp.identify(new Identify().set('queued', true));
      } catch{}
    });
  }

  log('Amplitude stub active');
})();
