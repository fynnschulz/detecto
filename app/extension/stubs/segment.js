/*
 * Segment analytics.js – High‑fidelity Stub (Protecto)
 *
 * Goals
 *  - Provide a realistic `window.analytics` API surface so sites think Segment is loaded
 *  - Absorb all calls (identify, track, page, group, alias, ready, on/off, debug, user, etc.)
 *  - Never perform network I/O; keep lightweight in-memory logs for diagnostics
 *  - Idempotent load; adopt pre‑queue created by Segment snippet; native‑like toString
 *  - Read‑only / non-configurable public interface to resist overwrites
 */
(function(){
  "use strict";

  if (window.__PROTECTO_SEGMENT_STUB__) return; // idempotent guard
  Object.defineProperty(window, "__PROTECTO_SEGMENT_STUB__", { value:true, configurable:false });

  var __PROTECTO_DEBUG__ = !!window.__PROTECTO_DEBUG__;
  function dlog(){ try{ if(__PROTECTO_DEBUG__) console.debug.apply(console, ["[Protecto][Segment]"].concat([].slice.call(arguments))); }catch(_){} }

  // ————— utilities —————
  function isObj(x){ return x && typeof x === "object"; }
  function clone(x){ try{ return JSON.parse(JSON.stringify(x)); } catch(_){ return x; } }
  function defineRO(obj, key, val){ Object.defineProperty(obj, key, { value:val, enumerable:true, configurable:false, writable:false }); }
  function defineROh(obj, key, getter){ Object.defineProperty(obj, key, { get:getter, enumerable:true, configurable:false }); }
  function nativeLike(fn){ try{ fn.toString = function(){ return "function " + (fn.name||"anonymous") + "() { [native code] }"; }; }catch(_){} return fn; }
  function nf(fn, name){ try{ Object.defineProperty(fn, "name", { value:name, configurable:true }); }catch(_){} return fn; }
  function now(){ return Date.now ? Date.now() : (+new Date()); }

  // ————— internal state —————
  var __state = Object.seal({
    initialized: false,
    writeKey: null,
    options: {},
    anonymousId: (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32),
    userId: null,
    traits: {},
    groupId: null,
    groupTraits: {},
    listeners: {},
    queue: [], // chronological event log (bounded)
    maxKeep: 1000
  });

  function enqueue(kind, payload){
    var evt = { ts: now(), kind: kind, payload: clone(payload||{}) };
    __state.queue.push(evt);
    if (__state.queue.length > __state.maxKeep) __state.queue.splice(0, __state.queue.length - __state.maxKeep);
    emit(kind, evt.payload);
    dlog("event", kind, evt.payload);
    return evt;
  }

  // ————— tiny EventEmitter —————
  function on(evt, cb){ if (typeof cb!=="function") return; (__state.listeners[evt] = __state.listeners[evt]||[]).push(cb); }
  function off(evt, cb){ var a=__state.listeners[evt]; if(!a) return; var i=a.indexOf(cb); if(i>=0) a.splice(i,1); }
  function emit(evt, data){ var a=__state.listeners[evt]; if(!a) return; a.slice().forEach(function(fn){ try{ fn(clone(data)); }catch(_){ } }); }

  // ————— user() facade —————
  var userObj = {};
  defineRO(userObj, "id", nativeLike(nf(function(v){
    if (arguments.length){ __state.userId = v==null?null:String(v); enqueue("user:id", { id: __state.userId }); return __state.userId; }
    return __state.userId;
  }, "id")));
  defineRO(userObj, "traits", nativeLike(nf(function(v){
    if (isObj(v)) { __state.traits = clone(v); enqueue("user:traits", __state.traits); }
    return clone(__state.traits);
  }, "traits")));
  defineRO(userObj, "anonymousId", nativeLike(nf(function(v){
    if (arguments.length){ __state.anonymousId = String(v||""); enqueue("user:anonymousId", { anonymousId: __state.anonymousId }); return __state.anonymousId; }
    return __state.anonymousId;
  }, "anonymousId")));
  try{ Object.freeze(userObj); }catch(_){ }

  // ————— core API —————
  var analytics = window.analytics || [];

  function ready(cb){ if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0); }
  function load(writeKey, opts){ __state.initialized = true; __state.writeKey = writeKey || __state.writeKey; __state.options = isObj(opts)?clone(opts):{}; enqueue("load", { writeKey: __state.writeKey, options: __state.options }); }
  function page(category, name, properties, options, cb){
    // flexible signature handling like Segment
    if (typeof category === "object") { options = properties; properties = category; category = undefined; name = properties && properties.name; }
    enqueue("page", { category:category||null, name:name||null, properties:clone(properties||{}), options:clone(options||{}), userId:__state.userId, anonymousId:__state.anonymousId });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
  }
  function identify(userId, traits, options, cb){
    if (isObj(userId)) { options = traits; traits = userId; userId = traits && traits.userId; }
    __state.userId = (userId==null?null:String(userId));
    if (isObj(traits)) __state.traits = clone(traits);
    enqueue("identify", { userId: __state.userId, traits: clone(__state.traits), options: clone(options||{}) });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
  }
  function track(event, properties, options, cb){
    enqueue("track", { event:String(event||"event"), properties: clone(properties||{}), options: clone(options||{}), userId:__state.userId, anonymousId:__state.anonymousId });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
  }
  function group(groupId, traits, options, cb){
    __state.groupId = groupId==null?null:String(groupId);
    if (isObj(traits)) __state.groupTraits = clone(traits);
    enqueue("group", { groupId: __state.groupId, traits: clone(__state.groupTraits), options: clone(options||{}) });
    if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0);
  }
  function alias(newId, options, cb){ enqueue("alias", { previousId: __state.userId, userId: String(newId||"") , options: clone(options||{}) }); if (typeof cb === "function") setTimeout(function(){ try{ cb(); }catch(_){ } }, 0); }
  function reset(){ __state.userId=null; __state.traits={}; __state.groupId=null; __state.groupTraits={}; enqueue("reset", {}); }
  function debug(v){ var on = (v===true || v==="true" || v===1 || v==="1"); __PROTECTO_DEBUG__ = on; enqueue("debug", { enabled:on }); }
  function timeout(ms){ enqueue("timeout", { ms: ms|0 }); }
  function setAnonymousId(id){ __state.anonymousId = String(id||""); enqueue("anonymousId", { anonymousId: __state.anonymousId }); }

  // ————— emitter passthrough —————
  var onApi  = nativeLike(nf(function(evt, cb){ on(evt, cb); }, "on"));
  var offApi = nativeLike(nf(function(evt, cb){ off(evt, cb); }, "off"));

  // ————— get state for debugging —————
  function _getState(){ return clone({ initialized:__state.initialized, writeKey:__state.writeKey, anonymousId:__state.anonymousId, userId:__state.userId, traits:__state.traits, groupId:__state.groupId, groupTraits:__state.groupTraits, queue:__state.queue }); }

  // ————— attach API —————
  var api = {};
  [
    ["ready", ready],
    ["load", load],
    ["page", page],
    ["identify", identify],
    ["track", track],
    ["group", group],
    ["alias", alias],
    ["reset", reset],
    ["debug", debug],
    ["timeout", timeout],
    ["setAnonymousId", setAnonymousId],
    ["on", onApi],
    ["off", offApi],
    ["user", nativeLike(nf(function(){ return userObj; }, "user"))],
    ["_getState", nativeLike(nf(_getState, "_getState"))]
  ].forEach(function(pair){ var k=pair[0], fn=nativeLike(nf(pair[1], k)); defineRO(api, k, fn); });

  // native-like toString for the main object when callable checks happen
  try{ api.toString = function(){ return "function analytics() { [native code] }"; }; }catch(_){ }

  // mark as initialized enough so sites proceed
  defineROh(api, "initialized", function(){ return __state.initialized; });
  defineROh(api, "VERSION", function(){ return "stub"; });

  // ————— adopt pre‑queue from the classic Segment snippet —————
  // Segment snippet often defines window.analytics as an Array and fills with method names
  // Example queued call: analytics.push(["track", "Event", {..}, {..}])
  try{
    var preQ = Array.isArray(analytics) ? analytics.slice() : [];
    // Replace global with API *first* so any further pushes land on real methods
    Object.defineProperty(window, "analytics", { value: api, enumerable:true, configurable:false, writable:false });

    // Replay pre‑queue
    for (var i=0;i<preQ.length;i++){
      var item = preQ[i];
      if (!item) continue;
      if (Array.isArray(item)){
        var m = item[0];
        var args = item.slice(1);
        if (typeof api[m] === "function") {
          try { api[m].apply(api, args); } catch(_){ }
        } else if (m && typeof m === "object" && typeof m.integration === "string") {
          // some advanced queue shapes; just log
          enqueue("integration", clone(m));
        } else {
          enqueue("call", { method:m, args: clone(args) });
        }
      } else if (isObj(item)) {
        // Some sites push objects directly
        enqueue("object", item);
      }
    }
  }catch(_){
    try{ Object.defineProperty(window, "analytics", { value: api, enumerable:true, configurable:false, writable:false }); }catch(_){ window.analytics = api; }
  }

  // Freeze surface to look immutable
  try{ Object.freeze(api); }catch(_){ }

  dlog("stub loaded; writeKey=", __state.writeKey);
})();
