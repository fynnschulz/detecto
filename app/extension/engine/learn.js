// Learning & Dynamic Rule Cache for Protecto (MV3, ES modules)
// Exports: getLearned, remember, ensureDnrRule, stubToPath

const STORE_KEY = "protecto_learned_v1";      // { [host]: { stub: "generic|ga|gtm|fbq", seen: number } }
const ID_MAP_KEY = "protecto_rule_ids_v1";    // { [host]: ruleId }

function hash32(str){
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function idForHost(host){
  // Stable range 40000..49999 (10k space)
  const h = hash32(String(host || ""));
  return 40000 + (h % 10000);
}

export function stubToPath(stub){
  switch (String(stub)) {
    case "ga":  return "/stubs/ga.js";
    case "gtm": return "/stubs/gtm.js";
    case "fbq": return "/stubs/fbq.js";
    default:     return "/stubs/generic.js";
  }
}

export async function getLearned(){
  const { [STORE_KEY]: data = {} } = await chrome.storage.local.get(STORE_KEY);
  return data;
}

async function setLearned(data){
  await chrome.storage.local.set({ [STORE_KEY]: data || {} });
}

export async function remember(host, stub){
  if (!host) return { stub, seen: 0 };
  const data = await getLearned();
  const cur  = data[host] || { stub: String(stub || "generic"), seen: 0 };
  if (!cur.stub) cur.stub = String(stub || "generic");
  cur.seen = (cur.seen | 0) + 1;
  cur.last = Date.now();
  // preserve persistence flags if present
  if (typeof cur.dnrPersisted !== 'boolean') cur.dnrPersisted = false;
  if (typeof cur.dnrRuleId !== 'number') delete cur.dnrRuleId;
  data[host] = cur;
  await setLearned(data);
  return cur;
}

async function getRuleIdMap(){
  const { [ID_MAP_KEY]: m = {} } = await chrome.storage.local.get(ID_MAP_KEY);
  return m;
}

async function setRuleIdMap(map){
  await chrome.storage.local.set({ [ID_MAP_KEY]: map || {} });
}

function makeRegexForHost(host){
  // Matches the host and subdomains, any path
  const esc = String(host).replace(/\./g, "\\.");
  return `^https?:\\/\\/(?:[^\\/]*\\.)?${esc}\\/.*$`;
}

export async function ensureDnrRule(host, stub, minSeen){
  try {
    const data = await getLearned();
    const ent  = data[host];
    const seen = ent && typeof ent.seen === "number" ? ent.seen : 0;
    const threshold = Math.max(1, Number(minSeen || 3));
    if (seen < threshold) return false;

    const id    = idForHost(host);
    const rule = {
      id,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: stubToPath(stub || (ent && ent.stub) || 'generic') } },
      condition: {
        regexFilter: makeRegexForHost(host),
        resourceTypes: ["script", "xmlhttprequest", "image", "ping"]
      }
    };

    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id] });
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [rule] });

    // mark persisted
    const updated = data[host] || { stub: String(stub || 'generic'), seen: seen };
    updated.dnrPersisted = true;
    updated.dnrRuleId = id;
    updated.stub = updated.stub || String(stub || 'generic');
    data[host] = updated;
    await setLearned(data);
    return true;
  } catch (e) {
    console.warn("[Protecto][ensureDnrRule] failed for", host, e);
    return false;
  }
}

export async function restorePersistedRules(){
  try {
    const data = await getLearned();
    const toAdd = [];
    for (const [host, ent] of Object.entries(data || {})){
      if (!ent || ent.dnrPersisted !== true) continue;
      const id = idForHost(host);
      toAdd.push({
        id,
        priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: stubToPath(ent.stub || 'generic') } },
        condition: { regexFilter: makeRegexForHost(host), resourceTypes: ["script","xmlhttprequest","image","ping"] }
      });
    }
    if (toAdd.length) {
      const ids = toAdd.map(r => r.id);
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: toAdd });
    }
  } catch (e) {
    console.warn('[Protecto][restorePersistedRules] failed', e);
  }
}
