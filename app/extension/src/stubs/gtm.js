// Google Tag Manager Stub – professional fake implementation
(function(){
  "use strict";

  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];

  // Internal state for debugging/fake use
  const state = {
    events: [],
    vars: {}
  };

  // Patch push method to capture events silently
  const origPush = window.dataLayer.push;
  window.dataLayer.push = function(){
    const args = Array.prototype.slice.call(arguments);
    try {
      for (const ev of args) {
        if (ev && typeof ev === "object") {
          state.events.push({ ev, ts: Date.now() });
          if (ev.event === "gtm.js") {
            state.vars["gtm.start"] = ev["gtm.start"] || Date.now();
          }
        }
      }
    } catch {}
    return origPush.apply(window.dataLayer, args);
  };

  // Fire gtm.start like real GTM
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  // Expose a fake gtag wrapper (some sites rely on it)
  window.gtag = function(){
    const args = Array.prototype.slice.call(arguments);
    state.events.push({ ev: { gtag: args }, ts: Date.now() });
    return true;
  };

  // Fake consent API (gtag('consent', ...))
  window.gtag.consent = {
    granted: true,
    update: function(params){
      state.vars.consent = params;
    }
  };

  // Fake get method for debugging hooks
  window.gtag.get = function(field){
    return state.vars[field];
  };
})();