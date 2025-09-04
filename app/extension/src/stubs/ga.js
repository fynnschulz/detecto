// Google Tag Manager Stub – pro-level fake that satisfies API calls but fires nothing
(function(){
  "use strict";
  if (window.dataLayer && Array.isArray(window.dataLayer) && window.dataLayer._gtmStub) return; // already defined

  const DEBUG = false;

  const state = {
    pushes: [],
    lastPush: null,
    containers: new Set(),
    startTimestamp: Date.now()
  };

  // timing jitter util
  function jitter(min=30,max=200){
    return new Promise(res => setTimeout(res, Math.floor(min + Math.random()*(max-min))));
  }

  function createDataLayer() {
    const dl = [];

    dl._gtmStub = true;

    dl.push = function() {
      const args = Array.prototype.slice.call(arguments);
      if (args.length === 0) return 0;

      // Simulate async handling with jitter
      jitter().then(() => {
        args.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            // Track container ID if 'gtm.start' event with containerId is pushed
            if (item['gtm.start'] && item['gtm.uniqueEventId']) {
              if (item['gtm.containerId']) {
                state.containers.add(item['gtm.containerId']);
              }
              state.startTimestamp = item['gtm.start'];
            }
            state.pushes.push(item);
            state.lastPush = item;
            if (DEBUG) console.log("[Protecto GTM Stub] push:", item);
          } else {
            // Unknown push → still log & fake
            if (DEBUG) console.log("[Protecto GTM Stub] unknown push arg:", item);
            state.pushes.push({ _raw:item, ts:Date.now() });
            state.lastPush = item;
          }
        });

        // Push to underlying array for length property and compatibility
        Array.prototype.push.apply(dl, args);
      });

      // Return new length to mimic native push
      return dl.length;
    };

    Object.defineProperty(dl, 'length', {
      get: function() {
        return Array.prototype.length.call(dl);
      },
      configurable: false,
      enumerable: true
    });

    return dl;
  }

  // Expose globally
  window.dataLayer = createDataLayer();
})();