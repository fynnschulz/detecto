// Microsoft Bing UET Stub – uetq (pro‑level, high‑fidelity)
(function(){
  try {
    // Idempotenz: bereits vorhanden & von uns? → nichts tun
    if (window.uetq && window.uetq.__PROTECTO_STUB__) return;

    // -------- internals / helpers --------
    const NATIVE = Function.prototype.toString;
    const NATIVE_STR = "function () { [native code] }";
    const now = (typeof performance !== 'undefined' && performance.now) ? ()=>performance.now() : ()=>Date.now();

    function toNative(fn){ try{ fn.toString = NATIVE.bind(function(){ return NATIVE_STR; }); }catch{} return fn; }
    function named(name, fn){ try{ Object.defineProperty(fn, 'name', { value: name, configurable: true }); }catch{} return fn; }
    function freezeDeep(obj){ try{ Object.freeze(obj); }catch{} return obj; }

    // -------- observed API surface in the wild --------
    //  * window.uetq: Array‑like queue with .push(...), plus helper methods (init, event, set, config, ready)
    //  * Some sites expect uetq.loaded === true, uetq.version, uetq.q (read‑only queue)
    //  * Occasionally a light wrapper window.uet exists with .push delegating to uetq.push

    // Übernehme evtl. bereits existierende Pre‑Queue (falls Seiten sie vor Laden füllen)
    const pre = (Array.isArray(window.uetq) ? window.uetq.slice() : []);

    // interne Queue + Subscriber (für Seitencode, der lauscht)
    const _queue = [];
    const _subs  = new Set();

    // Liefere eine Array‑Instanz, die wie ein echtes Array wirkt
    const uetq = [];

    // Primäre Operations: push / init / event / set / config / ready
    const pushImpl = named('push', toNative(function(){
      try {
        const args = Array.prototype.slice.call(arguments);
        // Normalisiere typische Kurzformen
        //   uetq.push('event', 'PageView', {...})
        //   uetq.push('init', 'TAGID', {consent:'granted'})
        _queue.push({ t: now(), a: args });
        for (const s of _subs) { try { s.apply(null, args); } catch {} }
        return _queue.length;
      } catch { return _queue.length; }
    }));

    const initImpl   = named('init',   toNative(function(/*tagId, config*/){ return; }));
    const eventImpl  = named('event',  toNative(function(/*name, props*/){ return; }));
    const setImpl    = named('set',    toNative(function(/*key, val*/){ return; }));
    const configImpl = named('config', toNative(function(/*opts*/){ return; }));
    const readyImpl  = named('ready',  toNative(function(cb){ try{ typeof cb === 'function' && cb(); }catch{} }));

    // Pub/Sub, damit Hostcode optional auf Queue‑Ereignisse reagieren kann
    const subscribeImpl   = named('subscribe',   toNative(function(cb){ if (typeof cb === 'function') _subs.add(cb); }));
    const unsubscribeImpl = named('unsubscribe', toNative(function(cb){ _subs.delete(cb); }));

    // API auf der Array‑Instanz bereitstellen (übliches Muster bei Vendor‑Queues)
    Object.defineProperties(uetq, {
      push:   { value: pushImpl,   writable: false, configurable: false, enumerable: false },
      init:   { value: initImpl,   writable: false, configurable: false, enumerable: false },
      event:  { value: eventImpl,  writable: false, configurable: false, enumerable: false },
      set:    { value: setImpl,    writable: false, configurable: false, enumerable: false },
      config: { value: configImpl, writable: false, configurable: false, enumerable: false },
      ready:  { value: readyImpl,  writable: false, configurable: false, enumerable: false },
      subscribe:   { value: subscribeImpl,   writable: false, configurable: false, enumerable: false },
      unsubscribe: { value: unsubscribeImpl, writable: false, configurable: false, enumerable: false }
    });

    // Introspektions‑Flags, die oft geprüft werden
    Object.defineProperties(uetq, {
      __PROTECTO_STUB__: { value: true,  writable: false, configurable: false },
      loaded:            { value: true,  writable: false, configurable: false },
      version:           { value: '1.0', writable: false, configurable: false },
      // read‑only Zugriff auf die interne Queue
      q:                 { get: function(){ return _queue; } }
    });

    // Optionales Wrapper‑Objekt window.uet (selten, aber gesehen), das .push delegiert
    // Dadurch bestehen Integrationen, die window.uet statt uetq prüfen
    const uetWrapper = {};
    Object.defineProperties(uetWrapper, {
      push: { value: pushImpl, writable: false, configurable: false, enumerable: false },
      __PROTECTO_STUB__: { value: true, writable: false, configurable: false }
    });

    // native‑like toString für Funktionen
    toNative(uetq.push); toNative(uetq.init); toNative(uetq.event); toNative(uetq.set);
    toNative(uetq.config); toNative(uetq.ready); toNative(subscribeImpl); toNative(unsubscribeImpl);

    // Deep‑freeze, um Monkey‑Patching zu vermeiden
    freezeDeep(uetq); freezeDeep(uetWrapper);

    // Globale Objekte setzen (nicht enumerierbar, nicht überschreibbar)
    Object.defineProperty(window, 'uetq', {
      value: uetq,
      configurable: false,
      writable: false,
      enumerable: false
    });
    // Nur setzen, wenn nicht bereits vorhanden (fremde Implementierungen unangetastet lassen)
    if (!window.uet) {
      Object.defineProperty(window, 'uet', {
        value: uetWrapper,
        configurable: false,
        writable: false,
        enumerable: false
      });
    }

    // Pre‑Queue übernehmen (wenn Seite vor Stub bereits Befehle gesammelt hat)
    if (pre && pre.length) {
      try {
        for (let i=0;i<pre.length;i++) {
          const it = pre[i];
          // Support sowohl array‑calls als auch einzelne strings
          if (Array.isArray(it)) {
            pushImpl.apply(null, it);
          } else {
            // fallback: treat as 'event'
            pushImpl('event', it);
          }
        }
      } catch {}
    }

    // Optionale leichte Telemetrie für Debug (nur lokal, ohne Netzwerk)
    // window.__PROTECTO_DEBUG__ && console.debug('[Protecto][Stub:uET]', 'active', _queue.length);

  } catch {}
})();