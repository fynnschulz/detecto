// Google Tag Manager Stub – professional fake implementation
(function(){
  "use strict";

  // Internal state for debugging/fake use
  const state = {
    events: [],
    callbacks: []
  };

  // Create the dataLayer array if it doesn't exist
  window.dataLayer = window.dataLayer || [];

  // Save original push method if exists
  const originalPush = window.dataLayer.push.bind(window.dataLayer);

  // Override push method to intercept events
  window.dataLayer.push = function(){
    const args = Array.prototype.slice.call(arguments);

    // Store each event pushed
    args.forEach(event => {
      state.events.push(event);

      // Simulate async processing with slight timing jitter (10-50ms)
      setTimeout(() => {
        // Call any registered callbacks for this event
        state.callbacks.forEach(cb => {
          try {
            cb(event);
          } catch (e) {
            // Swallow errors to avoid breaking page
          }
        });
      }, 10 + Math.floor(Math.random() * 40));
    });

    // Call original push to keep normal behavior
    return originalPush.apply(null, args);
  };

  // Provide a method to register callbacks for pushed events
  window.dataLayer.onEvent = function(callback){
    if (typeof callback === 'function') {
      state.callbacks.push(callback);
    }
  };

  // Simulate GTM loader events pushed on initialization
  const now = new Date().getTime();
  window.dataLayer.push({'gtm.start': now, event: 'gtm.js'});
  window.dataLayer.push({event: 'gtm.dom'});
  window.dataLayer.push({event: 'gtm.load'});
})();