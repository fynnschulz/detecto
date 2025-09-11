

/**
 * Protecto — Adobe Analytics / AppMeasurement & VisitorAPI Stub
 * Goal: Behave like real libraries enough that sites "think" AA is present,
 * while doing nothing network-wise. MV3-friendly, side‑effect free.
 *
 * Covered APIs (core subset):
 *  - window.s_gi(rsid) → instance registry per report suite
 *  - AppMeasurement instance shape: s.t(), s.tl(), s.linkTrackVars, s.linkTrackEvents,
 *    s.prop1..75, s.eVar1..250, s.events, s.pageName, s.channel, s.campaign,
 *    s.sa(rsid), s.getVisitorID(), s.doPlugins hook support
 *  - VisitorAPI: window.Visitor.getInstance(orgId) with ECID‑like methods
 *
 * Notes:
 *  - No network I/O. All track calls resolve synchronously with no-ops.
 *  - Idempotent: safe if loaded multiple times.
 *  - Native‑like function toString for basic stealth.
 */
(function(){
  if (typeof window !== 'object') return;
  const W = window;
  if (W.__PROTECTO_ADOBE_STUB__) return; // idempotent
  W.__PROTECTO_ADOBE_STUB__ = true;

  const DEBUG = !!W.__PROTECTO_DEBUG__;
  const log = (...a)=>{ try{ if(DEBUG) console.debug('[Protecto][Adobe]', ...a);}catch{} };

  // ---------------------------------------------------------------------------
  // Minimal utility helpers
  // ---------------------------------------------------------------------------
  const defineRO = (obj, key, val)=>{ try{ Object.defineProperty(obj, key, {value:val, writable:false, configurable:false, enumerable:false}); }catch{ obj[key]=val; } };
  const freeze  = (o)=>{ try{ return Object.freeze(o); }catch{ return o; } };
  const clone   = (x)=>{ try{ return x && typeof x==='object' ? JSON.parse(JSON.stringify(x)) : x; }catch{ return x; } };
  const nativeToString = (name)=>`function ${name}() { [native code] }`;

  // ---------------------------------------------------------------------------
  // VisitorAPI stub (ECID)
  // ---------------------------------------------------------------------------
  // Shape inspired by Experience Cloud ID Service docs
  // https://experienceleague.adobe.com/en/docs/id-service/using/id-service-api/methods/getinstance
  function createVisitor(orgId){
    const _state = {
      orgId: String(orgId||'').trim() || 'UNKNOWN@AdobeOrg',
      mcid: 'MID.' + Math.random().toString(36).slice(2) + Date.now(),
      optout: false,
      customerIDs: {},
      blob: '',
      locationHint: ''
    };

    const v = {
      getMarketingCloudVisitorID(cb){
        const id = _state.mcid;
        if (typeof cb === 'function') try{ cb(id); }catch{}
        return id;
      },
      isOptedOut(){ return !!_state.optout; },
      setCustomerIDs(map){ if (map && typeof map === 'object') _state.customerIDs = clone(map); },
      getCustomerIDs(){ return clone(_state.customerIDs); },
      getAudienceManagerBlob(cb){ const val = _state.blob; if (typeof cb==='function') try{cb(val);}catch{} return val; },
      getLocationHint(cb){ const val = _state.locationHint; if (typeof cb==='function') try{cb(val);}catch{} return val; },
      setMarketingCloudVisitorID(id){ if (id) _state.mcid = String(id); },
      getInstance(org){ return createVisitor(org||_state.orgId); },
      _getState(){ return clone(_state); }
    };

    // Make it look a bit native
    try{ v.getMarketingCloudVisitorID.toString = ()=>nativeToString('getMarketingCloudVisitorID'); }catch{}
    return freeze(v);
  }

  if (!W.Visitor) {
    W.Visitor = { getInstance: (orgId)=>createVisitor(orgId) };
    try{ W.Visitor.getInstance.toString = ()=>nativeToString('getInstance'); }catch{}
  }

  // ---------------------------------------------------------------------------
  // AppMeasurement stub
  // ---------------------------------------------------------------------------
  // API references:
  //  - s_gi(): https://experienceleague.adobe.com/en/docs/analytics/implementation/vars/functions/s-gi
  //  - t():     https://experienceleague.adobe.com/en/docs/analytics/implementation/vars/functions/t-method
  //  - tl():    https://experienceleague.adobe.com/en/docs/analytics/implementation/vars/functions/tl-method

  const _instances = Object.create(null); // rsid -> instance

  function createAppMeasurement(rsid){
    const _cfg = {
      account: String(rsid||'').trim() || 'unset',
      trackingServer: '',
      trackingServerSecure: ''
    };

    const _vars = {
      // common AA variables
      pageName: '', channel: '', campaign: '', hier1: '',
      events: '', products: '',
      prop: {}, eVar: {}, list: {},
      linkTrackVars: '', linkTrackEvents: '',
      visitor: W.Visitor ? W.Visitor.getInstance('UNKNOWN@AdobeOrg') : null
    };

    // Pre-create prop1..75 and eVar1..250 accessors
    for (let i=1;i<=75;i++) Object.defineProperty(_vars, 'prop'+i, { get(){return this.prop[i]||'';}, set(v){ this.prop[i]=String(v); }, enumerable:false});
    for (let i=1;i<=250;i++) Object.defineProperty(_vars, 'eVar'+i, { get(){return this.eVar[i]||'';}, set(v){ this.eVar[i]=String(v); }, enumerable:false});

    // Core track compiler (no network)
    function compileHit(kind){
      return freeze({
        kind, account:_cfg.account,
        vars: clone(_vars),
        ts: Date.now()
      });
    }

    // Public instance object "s"
    const s = {
      // config
      get account(){ return _cfg.account; },
      set account(v){ _cfg.account = String(v||''); },
      sa(v){ _cfg.account = String(v||''); return this; },
      get trackingServer(){ return _cfg.trackingServer; },
      set trackingServer(v){ _cfg.trackingServer = String(v||''); },
      get trackingServerSecure(){ return _cfg.trackingServerSecure; },
      set trackingServerSecure(v){ _cfg.trackingServerSecure = String(v||''); },

      // vars passthroughs
      get pageName(){ return _vars.pageName; }, set pageName(v){ _vars.pageName=String(v||''); },
      get channel(){ return _vars.channel; }, set channel(v){ _vars.channel=String(v||''); },
      get campaign(){ return _vars.campaign; }, set campaign(v){ _vars.campaign=String(v||''); },
      get hier1(){ return _vars.hier1; }, set hier1(v){ _vars.hier1=String(v||''); },
      get events(){ return _vars.events; }, set events(v){ _vars.events=String(v||''); },
      get products(){ return _vars.products; }, set products(v){ _vars.products=String(v||''); },
      get linkTrackVars(){ return _vars.linkTrackVars; }, set linkTrackVars(v){ _vars.linkTrackVars=String(v||''); },
      get linkTrackEvents(){ return _vars.linkTrackEvents; }, set linkTrackEvents(v){ _vars.linkTrackEvents=String(v||''); },
      get visitor(){ return _vars.visitor; }, set visitor(v){ _vars.visitor=v; },

      // Hooks
      doPlugins: null,
      registerPreTrackCallback(fn){ if(!this._pre) this._pre=[]; if(typeof fn==='function') this._pre.push(fn); },
      registerPostTrackCallback(fn){ if(!this._post) this._post=[]; if(typeof fn==='function') this._post.push(fn); },

      // Main tracking calls (no network)
      t(){
        try{
          if (typeof this.doPlugins === 'function') { try{ this.doPlugins(this); }catch(e){ log('doPlugins error', e); } }
          if (this._pre) for (const f of this._pre) try{ f(this); }catch{}
          const hit = compileHit('t');
          if (this._post) for (const f of this._post) try{ f(this, hit); }catch{}
          log('t()', hit);
          return hit; // real lib returns tracking URL string sometimes; harmless to return payload
        }catch(e){ log('t() error', e); return null; }
      },
      tl(obj, linkType, linkName){
        try{
          const hit = compileHit('tl');
          hit.linkType = String(linkType||'o');
          hit.linkName = String(linkName||'');
          // AA 2.22.4: ignores non-string href gracefully (we mimic by ignoring obj)
          log('tl()', {linkType:hit.linkType, linkName:hit.linkName});
          return hit;
        }catch(e){ log('tl() error', e); return null; }
      },

      // Convenience helpers often present in implementations
      getVisitorID(){ try{ return _vars.visitor && _vars.visitor.getMarketingCloudVisitorID(); }catch{ return null; } },
      clearVars(){ try{ _vars.events=''; _vars.products=''; _vars.linkTrackVars=''; _vars.linkTrackEvents=''; }catch{} },

      // Expose raw for debugging
      _getVars(){ return clone(_vars); },
      _getConfig(){ return clone(_cfg); }
    };

    // Native‑like method faces
    try{ s.t.toString  = ()=>nativeToString('t'); }catch{}
    try{ s.tl.toString = ()=>nativeToString('tl'); }catch{}
    try{ s.sa.toString = ()=>nativeToString('sa'); }catch{}

    // Define prop/eVar/list as data bags but keep accessors on _vars
    defineRO(s, 'prop', _vars.prop);
    defineRO(s, 'eVar', _vars.eVar);
    defineRO(s, 'list', _vars.list);

    return s;
  }

  // s_gi registry per RSID
  function s_gi(rsid){
    const key = String(rsid||'').trim() || 'unset';
    if (_instances[key]) return _instances[key];
    const inst = createAppMeasurement(key);
    _instances[key] = inst;
    return inst;
  }

  if (!W.s_gi) {
    W.s_gi = s_gi;
    try{ W.s_gi.toString = ()=>nativeToString('s_gi'); }catch{}
  }

  // Common global alias: sites often assign `var s = s_gi('...');`
  if (!('s' in W)) {
    try { Object.defineProperty(W, 's', { get(){ return _instances[Object.keys(_instances)[0]] || null; }, set(v){ /* ignore */ }, configurable:false }); }catch{}
  }

  log('Adobe/AppMeasurement stub active');
})();