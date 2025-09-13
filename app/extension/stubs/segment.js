(function(){
  if (window.analytics && window.analytics.__PROTECTO_STUB__) return;
  var __PROTECTO_DEBUG__ = !!window.__PROTECTO_DEBUG__;
  function dlog(){ try{ if(__PROTECTO_DEBUG__) console.debug.apply(console, ["[Protecto][Segment]"].concat([].slice.call(arguments))); }catch(_){} }

  function isObj(x){ return x && typeof x === "object"; }
  function clone(x){ try{ return JSON.parse(JSON.stringify(x)); } catch(_){ return x; } }
  function now(){ return Date.now ? Date.now() : (+new Date()); }

  var __state = {
    initialized: false,
    writeKey: null,
    options: {},
    anonymousId: (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32),
    userId: null,
    traits: {},
    groupId: null,
    groupTraits: {},
    listeners: {},
    queue: [],
    maxKeep: 1000
  };

  function enqueue(kind, payload){
    var evt = { ts: now(), kind: kind, payload: clone(payload||{}) };
    __state.queue.push(evt);
    if (__state.queue.length > __state.maxKeep) __state.queue.splice(0, __state.queue.length - __state.maxKeep);
    emit(kind, evt.payload);
    dlog("event", kind, evt.payload);
    return evt;
  }

  function on(evt, cb){ if (typeof cb!=="function") return; (__state.listeners[evt] = __state.listeners[evt]||[]).push(cb); }
  function off(evt, cb){ var a=__state.listeners[evt]; if(!a) return; var i=a.indexOf(cb); if(i>=0) a.splice(i,1); }
  function emit(evt, data){ var a=__state.listeners[evt]; if(!a) return; a.slice().forEach(function(fn){ try{ fn(clone(data)); }catch(_){ } }); }

  var userObj = {
    id: function(v){
      if (arguments.length){ __state.userId = v==null?null:String(v); enqueue("user:id", { id: __state.userId }); return this; }
      return __state.userId;
    },
    traits: function(v){
      if (isObj(v)) { __state.traits = clone(v); enqueue("user:traits", __state.traits); return this; }
      return clone(__state.traits);
    },
    anonymousId: function(v){
      if (arguments.length){ __state.anonymousId = String(v||""); enqueue("user:anonymousId", { anonymousId: __state.anonymousId }); return this; }
      return __state.anonymousId;
    }
  };

  function createPromise(){
    return {
      then: function(cb){ try{ cb(); }catch(_){ } return this; },
      catch: function(){ return this; },
      finally: function(cb){ try{ cb(); }catch(_){ } return this; }
    };
  }

  function ready(cb){ if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0); return createPromise(); }
  function load(writeKey, opts){ 
    __state.initialized = true; 
    __state.writeKey = writeKey || __state.writeKey; 
    __state.options = isObj(opts)?clone(opts):{}; 
    enqueue("load", { writeKey: __state.writeKey, options: __state.options }); 
    return createPromise();
  }
  function page(category, name, properties, options, cb){
    if (typeof category === "object") { options = properties; properties = category; category = undefined; name = properties && properties.name; }
    enqueue("page", { category:category||null, name:name||null, properties:clone(properties||{}), options:clone(options||{}), userId:__state.userId, anonymousId:__state.anonymousId });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
    return createPromise();
  }
  function identify(userId, traits, options, cb){
    if (isObj(userId)) { options = traits; traits = userId; userId = traits && traits.userId; }
    __state.userId = (userId==null?null:String(userId));
    if (isObj(traits)) __state.traits = clone(traits);
    enqueue("identify", { userId: __state.userId, traits: clone(__state.traits), options: clone(options||{}) });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
    return createPromise();
  }
  function track(event, properties, options, cb){
    enqueue("track", { event:String(event||"event"), properties: clone(properties||{}), options: clone(options||{}), userId:__state.userId, anonymousId:__state.anonymousId });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
    return createPromise();
  }
  function group(groupId, traits, options, cb){
    __state.groupId = groupId==null?null:String(groupId);
    if (isObj(traits)) __state.groupTraits = clone(traits);
    enqueue("group", { groupId: __state.groupId, traits: clone(__state.groupTraits), options: clone(options||{}) });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
    return createPromise();
  }
  function alias(newId, options, cb){
    enqueue("alias", { previousId: __state.userId, userId: String(newId||"") , options: clone(options||{}) });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
    return createPromise();
  }
  function reset(){
    __state.userId=null; __state.traits={}; __state.groupId=null; __state.groupTraits={}; 
    enqueue("reset", {}); 
    return createPromise();
  }
  function debug(v){ 
    var on = (v===true || v==="true" || v===1 || v==="1"); 
    __PROTECTO_DEBUG__ = on; 
    enqueue("debug", { enabled:on }); 
    return this;
  }
  function timeout(ms){ 
    enqueue("timeout", { ms: ms|0 }); 
    return this;
  }
  function setAnonymousId(id){ 
    __state.anonymousId = String(id||""); 
    enqueue("anonymousId", { anonymousId: __state.anonymousId }); 
    return this;
  }

  function onApi(evt, cb){ on(evt, cb); return this; }
  function offApi(evt, cb){ off(evt, cb); return this; }

  function _getState(){ return clone({ initialized:__state.initialized, writeKey:__state.writeKey, anonymousId:__state.anonymousId, userId:__state.userId, traits:__state.traits, groupId:__state.groupId, groupTraits:__state.groupTraits, queue:__state.queue }); }

  function analyticsFn(){
    var args = arguments;
    if (args.length === 0) return analytics;
    var method = args[0];
    var fn = analytics[method];
    if (typeof fn === 'function') {
      try { return fn.apply(analytics, Array.prototype.slice.call(args,1)) || analytics; } catch(_) { return analytics; }
    }
    return analytics;
  }

  var api = {
    ready: ready,
    load: load,
    page: page,
    identify: identify,
    track: track,
    group: group,
    alias: alias,
    reset: reset,
    debug: debug,
    timeout: timeout,
    setAnonymousId: setAnonymousId,
    on: onApi,
    off: offApi,
    user: function(){ return userObj; },
    _getState: _getState,
    initialized: false,
    VERSION: "stub",
    toString: function(){ return "function analytics() { [native code] }"; }
  };

  // Make properties writable and normal
  api.initialized = __state.initialized;
  api.VERSION = "stub";

  // Attach all methods to api for chaining
  Object.keys(api).forEach(function(key){
    if(typeof api[key] === 'function'){
      var original = api[key];
      api[key] = function(){
        var res = original.apply(this, arguments);
        return (res === undefined) ? this : res;
      };
    }
  });

  // Make analytics a callable function with api methods attached
  var analyticsProxy = function(){
    return analyticsFn.apply(null, arguments);
  };
  for (var k in api) {
    if (api.hasOwnProperty(k)) {
      analyticsProxy[k] = api[k];
    }
  }
  analyticsProxy.__PROTECTO_STUB__ = true;
  analyticsProxy.toString = api.toString;

  var preQ = Array.isArray(window.analytics) ? window.analytics.slice() : [];
  window.analytics = analyticsProxy;

  for (var i=0;i<preQ.length;i++){
    var item = preQ[i];
    if (!item) continue;
    if (Array.isArray(item)){
      var m = item[0];
      var args = item.slice(1);
      if (typeof analyticsProxy[m] === "function") {
        try { analyticsProxy[m].apply(analyticsProxy, args); } catch(_){ }
      } else if (m && typeof m === "object" && typeof m.integration === "string") {
        enqueue("integration", clone(m));
      } else {
        enqueue("call", { method:m, args: clone(args) });
      }
    } else if (isObj(item)) {
      enqueue("object", item);
    }
  }

  dlog("stub loaded; writeKey=", __state.writeKey);
})();
