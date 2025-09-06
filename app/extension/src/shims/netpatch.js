// Protecto – NetPatch (Page-Context) : fängt fetch/XHR/Beacon/Image für Third-Party-Tracker ab
(function(){
  try {
    const ONE_BY_ONE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEA";
    const RE_SUB  = /(^|\.)(ads|adservice|adserver|doubleclick|googlesyndication|googleadservices|analytics|metrics|stats|pixel|track|beacon|tag|clarity|hotjar|criteo|taboola|outbrain|adform|quantserve|scorecardresearch|moatads|rubiconproject|pubmatic|openx|spotx|zedo|mathtag)\./i;
    const RE_PATH = /(collect|g\/collect|pixel|beacon|track|event|measure|metrics|stats|analytics|fbevents|tr\/|t\/collect|log)(\?|\/|$)/i;
    const RE_QUERY= /(utm_[a-z]+|fbclid|gclid|msclkid|yclid|dclid)=/i;
    const pageHost = location.hostname.replace(/^www\./,'');

    const safeHost = (u)=>{ try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ""; } };
    const isThird  = (u)=> { const h = safeHost(u); return !!h && h !== pageHost; };
    const suspicious= (u)=> { try { const url = new URL(u); return RE_SUB.test(url.hostname) || RE_PATH.test(url.pathname) || RE_QUERY.test(url.search); } catch { return false; } };

    // fetch()
    const _fetch = window.fetch;
    window.fetch = function(input, init){
      try {
        const url = (typeof input === "string") ? input : input?.url || "";
        if (url && isThird(url) && suspicious(url)) {
          // Fake-Response (JSON-ähnlich), damit Aufrufer nicht crasht
          const body = (/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(url) || /pixel|beacon/i.test(url)) ? "" : "{\"ok\":true}";
          const headers = body ? { "content-type":"application/json" } : {};
          return Promise.resolve(new Response(body, { status: 200, headers }));
        }
      } catch {}
      return _fetch.apply(this, arguments);
    };

    // XHR
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url){
      try {
        this.__protecto_url = url;
      } catch {}
      return _open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body){
      try {
        const url = this.__protecto_url || "";
        if (url && isThird(url) && suspicious(url)) {
          // Kurzschließen mit leerer Response
          const self = this;
          setTimeout(function(){
            try {
              Object.defineProperty(self, 'readyState', { value: 4 });
              Object.defineProperty(self, 'status', { value: 200 });
              Object.defineProperty(self, 'responseText', { value: "{\"ok\":true}" });
              self.onreadystatechange && self.onreadystatechange();
              self.onload && self.onload();
            } catch {}
          }, 0);
          return;
        }
      } catch {}
      return _send.apply(this, arguments);
    };

    // sendBeacon()
    const _sendBeacon = navigator.sendBeacon;
    try {
      navigator.sendBeacon = function(url, data){
        try {
          if (url && isThird(url) && suspicious(url)) return true; // tue so, als ob gesendet
        } catch {}
        return _sendBeacon.apply(this, arguments);
      };
    } catch {}

    // Image Pixel
    const _imgSrc = Object.getOwnPropertyDescriptor(Image.prototype, "src");
    Object.defineProperty(Image.prototype, "src", {
      set(v){
        try {
          if (v && isThird(v) && suspicious(v)) return _imgSrc.set.call(this, ONE_BY_ONE);
        } catch {}
        return _imgSrc.set.call(this, v);
      },
      get(){ return _imgSrc.get.call(this); },
      configurable: true
    });

  } catch {}
})();