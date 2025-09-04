(() => {
  "use strict";

  // ============================================================
  // Protecto Fingerprint Cloak — Extensive, Stealthy, Deterministic
  // Runs in MAIN world (injected only in Strict mode).
  // Goals:
  //  - Degrade fingerprint entropy without breaking sites
  //  - Return plausible, stable values (per domain & session)
  //  - Avoid obvious anti-adblock detection (no hard errors)
  //  - Count fingerprint attempts for Risk Engine
  // ============================================================

  // -------------------------
  // Helpers (seeded PRNG etc.)
  // -------------------------
  const ORIG = {
    canvas_toDataURL: HTMLCanvasElement.prototype.toDataURL,
    canvas_toBlob: HTMLCanvasElement.prototype.toBlob,
    audio_getChannelData: AudioBuffer.prototype.getChannelData,
    ctx2d_measureText: CanvasRenderingContext2D?.prototype?.measureText,
  };

  // Hash a string to 32-bit (xorshift-like)
  function h32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h += h << 13; h ^= h >>> 7;
    h += h << 3;  h ^= h >>> 17;
    h += h << 5;
    return h >>> 0;
  }

  // Deterministic PRNG (mulberry32)
  function mulberry32(seed) {
    return function() {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seed = h32(location.hostname + "§" + navigator.userAgent);
  const rand = mulberry32(seed);

  function randInt(min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
  }

  function jitterSmallPx(maxAbs = 2) {
    const j = Math.floor(rand() * (maxAbs * 2 + 1)) - maxAbs; // [-max..+max]
    return j;
  }

  // Gaussian-ish random using Box–Muller with deterministic source
  function gauss(mean = 120, stdev = 40) {
    // Use two PRNs from deterministic rand()
    let u = 1 - rand(); // avoid 0
    let v = rand();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Math.max(20, Math.round(mean + z * stdev)); // >=20ms
  }

  // -------------------------
  // Risk Engine reporting
  // -------------------------
  let fpCount = 0;
  const bump = () => {
    fpCount++;
    try {
      chrome?.runtime?.sendMessage?.({
        type: "risk:signal",
        domain: location.hostname.replace(/^www\./, ""),
        fingerprintCalls: 1
      });
    } catch {}
  };

  // -------------------------
  // Safe define helper
  // -------------------------
  function safeDefine(obj, prop, getter) {
    try {
      const desc = Object.getOwnPropertyDescriptor(obj, prop);
      if (!desc || desc.configurable) {
        Object.defineProperty(obj, prop, { configurable: true, get: getter });
      }
    } catch {}
  }

  // ============================================================
  // 1) Canvas anti-fingerprint (toDataURL / toBlob / measureText)
  // ============================================================
  try {
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      try {
        const ctx = this.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "rgba(0,0,0,0.01)";
          ctx.fillRect(0, 0, 1, 1); // tiny noise
        }
        bump();
      } catch {}
      return ORIG.canvas_toDataURL.apply(this, args);
    };
  } catch {}

  try {
    if (ORIG.canvas_toBlob) {
      HTMLCanvasElement.prototype.toBlob = function(cb, ...rest) {
        try {
          const ctx = this.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "rgba(0,0,0,0.01)";
            ctx.fillRect(0, 0, 1, 1);
          }
          bump();
        } catch {}
        return ORIG.canvas_toBlob.call(this, cb, ...rest);
      };
    }
  } catch {}

  try {
    if (ORIG.ctx2d_measureText) {
      CanvasRenderingContext2D.prototype.measureText = function(...args) {
        const m = ORIG.ctx2d_measureText.apply(this, args);
        // Proxy TextMetrics with slight deterministic jitter in width/actualBoundingBoxRight
        const j = (jitterSmallPx(1)) * 0.01; // very tiny (±0.01px)
        const proxy = new Proxy(m, {
          get(target, prop) {
            if (prop === "width") return (target.width || 0) + j;
            if (prop === "actualBoundingBoxRight") return (target.actualBoundingBoxRight || 0) + j;
            return Reflect.get(target, prop);
          }
        });
        bump();
        return proxy;
      };
    }
  } catch {}

  // ============================================================
  // 2) Audio anti-fingerprint (AudioBuffer / OfflineAudioContext)
  // ============================================================
  try {
    AudioBuffer.prototype.getChannelData = function(...args) {
      const results = ORIG.audio_getChannelData.apply(this, args);
      // Deterministic micro-noise every ~100th sample
      for (let i = 0; i < results.length; i += 97) {
        results[i] += (rand() * 1e-7); // tiny
      }
      bump();
      return results;
    };
  } catch {}

  try {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OAC) {
      const proto = OAC.prototype;
      const origStart = proto.startRendering;
      if (origStart) {
        proto.startRendering = function(...args) {
          return origStart.apply(this, args).then((buf) => {
            try {
              // Add tiny deterministic noise on each channel
              for (let ch = 0; ch < (buf.numberOfChannels || 1); ch++) {
                const data = buf.getChannelData(ch);
                for (let i = 0; i < data.length; i += 97) {
                  data[i] += (rand() * 1e-7);
                }
              }
              bump();
            } catch {}
            return buf;
          });
        };
      }
    }
  } catch {}

  // ============================================================
  // 3) Navigator & Screen stabilization
  // ============================================================
  // hardwareConcurrency & deviceMemory (stable plausible values)
  try {
    const hc = Math.min(8, Math.max(2, 2 + randInt(0, 6))); // 2..8
    safeDefine(navigator, "hardwareConcurrency", () => { bump(); return hc; });
  } catch {}

  try {
    const dm = [2, 4, 8][randInt(0, 2)];
    if (!("deviceMemory" in navigator) || typeof navigator.deviceMemory !== "number") {
      safeDefine(navigator, "deviceMemory", () => { bump(); return dm; });
    }
  } catch {}

  // plugins → minimal plausible PluginArray-like
  try {
    const fakePlugins = [
      { name: "Chrome PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" }
    ];
    const pluginArray = new Proxy(fakePlugins, {
      get(target, prop) {
        if (prop === "length") return target.length;
        if (prop === Symbol.iterator) return target[Symbol.iterator].bind(target);
        const idx = Number(prop);
        if (!Number.isNaN(idx)) return target[idx];
        return Reflect.get(target, prop);
      }
    });
    safeDefine(navigator, "plugins", () => { bump(); return pluginArray; });
  } catch {}

  // languages → stable choice from set (per domain)
  try {
    const options = [["en-US","en"], ["de-DE","de"], ["fr-FR","fr"], ["es-ES","es"]];
    const langs = options[seed % options.length];
    safeDefine(navigator, "languages", () => { bump(); return langs; });
  } catch {}

  // platform / maxTouchPoints / webdriver (avoid bot flags)
  try { safeDefine(navigator, "maxTouchPoints", () => 0); } catch {}
  try {
    // webdriver should be undefined or false
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => undefined });
  } catch {}

  // screen width/height with tiny deterministic jitter
  try {
    const sw = screen.width, sh = screen.height;
    safeDefine(screen, "width",  () => sw + jitterSmallPx(1));
    safeDefine(screen, "height", () => sh + jitterSmallPx(1));
  } catch {}

  // ============================================================
  // 4) WebGL shims — reduce entropy
  // ============================================================
  function patchWebGL(glProto, gl2 = false) {
    if (!glProto) return;
    try {
      const origGetParameter = glProto.getParameter;
      glProto.getParameter = function(pname) {
        // Mask vendor/renderer strings (also when debug extension tries to reveal)
        const UNMASKED_VENDOR_WEBGL = 0x9245;
        const UNMASKED_RENDERER_WEBGL = 0x9246;
        const VENDOR  = 0x1F00;
        const RENDERER= 0x1F01;
        if (pname === VENDOR || pname === UNMASKED_VENDOR_WEBGL) {
          bump();
          return "WebKit";
        }
        if (pname === RENDERER || pname === UNMASKED_RENDERER_WEBGL) {
          bump();
          return "WebKit WebGL";
        }
        return origGetParameter.call(this, pname);
      };

      const origGetExtension = glProto.getExtension;
      glProto.getExtension = function(name) {
        if (name && /WEBGL_debug_renderer_info/i.test(name)) {
          bump();
          return null; // hide detailed renderer info
        }
        return origGetExtension.call(this, name);
      };

      const origGetSupportedExtensions = glProto.getSupportedExtensions;
      if (origGetSupportedExtensions) {
        glProto.getSupportedExtensions = function() {
          const list = origGetSupportedExtensions.call(this) || [];
          // Filter out debug renderer info
          const filtered = list.filter(e => !/WEBGL_debug_renderer_info/i.test(e));
          return filtered;
        };
      }
    } catch {}
  }

  try { patchWebGL(WebGLRenderingContext?.prototype); } catch {}
  try { patchWebGL(WebGL2RenderingContext?.prototype, true); } catch {}

  // ============================================================
  // 5) RTCPeerConnection — mask local IP in SDP
  // ============================================================
  try {
    const OrigRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (OrigRTC) {
      const PatchedRTC = function(config) {
        const pc = new OrigRTC(config);
        const origCreateOffer = pc.createOffer.bind(pc);
        const origSetLocalDescription = pc.setLocalDescription.bind(pc);

        pc.createOffer = async function(options) {
          const offer = await origCreateOffer(options);
          try {
            if (offer && offer.sdp) {
              offer.sdp = offer.sdp.replace(
                /(\d{1,3}\.){3}\d{1,3}/g,
                "10.0.0.1"
              );
              bump();
            }
          } catch {}
          return offer;
        };

        pc.setLocalDescription = async function(desc) {
          try {
            if (desc && desc.sdp) {
              desc.sdp = desc.sdp.replace(
                /(\d{1,3}\.){3}\d{1,3}/g,
                "10.0.0.1"
              );
              bump();
            }
          } catch {}
          return origSetLocalDescription(desc);
        };

        return pc;
      };
      window.RTCPeerConnection = PatchedRTC;
      window.webkitRTCPeerConnection = PatchedRTC;
    }
  } catch {}

  // ============================================================
  // 6) MediaDevices.enumerateDevices — sanitize ids/labels
  // ============================================================
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const origEnum = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = async function() {
        const devices = await origEnum();
        try {
          bump();
          // Replace deviceId/groupId with deterministic hashes; scrub labels
          return devices.map(d => ({
            deviceId: "protecto-" + (h32(d.deviceId || d.label || "x").toString(16)),
            kind: d.kind,
            label: "", // scrubs labels unless permission granted
            groupId: "protecto-" + (h32(d.groupId || "g").toString(16))
          }));
        } catch {
          return devices;
        }
      };
    }
  } catch {}

  // ============================================================
  // 7) Battery API (optional stub)
  // ============================================================
  try {
    if (navigator.getBattery) {
      const origGetBattery = navigator.getBattery.bind(navigator);
      navigator.getBattery = function() {
        bump();
        return origGetBattery().then(b => {
          try {
            // Wrap BatteryManager with stable values
            const proxy = new Proxy(b, {
              get(target, prop) {
                if (prop === "charging") return true;
                if (prop === "level")    return 0.85;
                return Reflect.get(target, prop);
              }
            });
            return proxy;
          } catch {
            return b;
          }
        }).catch(() => ({
          charging: true, level: 0.85, chargingTime: 0, dischargingTime: Infinity
        }));
      };
    }
  } catch {}

  // ============================================================
  // 8) Permissions API (avoid leaks)
  // ============================================================
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function(params) {
        try { bump(); } catch {}
        // Return as-is but could normalize states to reduce entropy
        return origQuery(params);
      };
    }
  } catch {}

  // Done
})();