import { NextResponse } from 'next/server'
import { htmlToText } from "html-to-text";
import crypto from "crypto";

// --- Rate Limit ---
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;
const ipHits: Map<string, number[]> = new Map();
function rateLimit(ip: string) {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter(ts => now - ts < WINDOW_MS);
  if (arr.length >= MAX_REQUESTS) return false;
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

// --- Types ---
type Payload = {
  emails?: string[]
  usernames?: string[]
  phones?: string[]
  fullName?: string
  city?: string
  country?: string
  address?: string
  birthYear?: number
  aliases?: string[]
  services?: string[]
  deepScan?: boolean
}

// --- Normalization helpers ---
function normEmail(e: string) {
  return String(e).trim().toLowerCase();
}
function normalizeEmailAdvanced(e: string) {
  const lower = normEmail(e);
  const [local, domain] = lower.split("@");
  if (!local || !domain) return lower;
  if (["gmail.com","googlemail.com"].includes(domain)) {
    const noPlus = local.split("+")[0];
    const noDots = noPlus.replace(/\./g,"");
    return `${noDots}@${domain}`;
  }
  return lower;
}
function emailVariants(e: string) {
  const variants = new Set<string>();
  variants.add(normEmail(e));
  variants.add(normalizeEmailAdvanced(e));
  const [local, domain] = e.split("@");
  if (domain && ["gmail.com","googlemail.com"].includes(domain)) {
    const base = local.split("+")[0];
    variants.add(`${base}@${domain}`);
  }
  return Array.from(variants);
}
function md5(s: string) { return crypto.createHash("md5").update(s).digest("hex"); }
function sha1(s: string) { return crypto.createHash("sha1").update(s).digest("hex"); }
function sha256(s: string) { return crypto.createHash("sha256").update(s).digest("hex"); }

function emailHashes(e: string) {
  const n = normalizeEmailAdvanced(e);
  return [md5(n), sha1(n), sha256(n)];
}

function b64(s: string) { return Buffer.from(s, "utf8").toString("base64"); }
function hex(s: string) { return Buffer.from(s, "utf8").toString("hex"); }
function emailEncodings(e: string) {
  const n = normalizeEmailAdvanced(e);
  return [b64(n), hex(n)];
}
// --- Query expansion helpers ---
const leetMap: Record<string,string[]> = { a:["4","@"], e:["3"], i:["1"], o:["0"], s:["5","$"], t:["7"], l:["1"], g:["9"], b:["8"] };
function leetVariants(s: string){
  const base = ascii(String(s).toLowerCase());
  const out = new Set<string>([base]);
  const chars = base.split("");
  // single-substitution variants (keep small to avoid explosion)
  for(let i=0;i<chars.length;i++){
    const c = chars[i];
    if(leetMap[c]){
      for(const sub of leetMap[c]){
        out.add(chars.slice(0,i).join("")+sub+chars.slice(i+1).join(""));
      }
    }
  }
  return Array.from(out);
}
function usernameVariants(u: string){
  const base = ascii(normUsername(u).toLowerCase());
  const bag = new Set<string>([base]);
  const suffixes = ["123","01","2025","_","-","_dev","_sec"]; 
  for(const sfx of suffixes){ bag.add(base+sfx); }
  const prefixes = ["_","-","the","real","its"];
  for(const pfx of prefixes){ bag.add(pfx+base); }
  leetVariants(base).forEach(v=>bag.add(v));
  return Array.from(bag);
}
function emailDomainTokens(emails: string[]){
  const out = new Set<string>();
  for(const e of emails){
    const parts = normEmail(e).split("@");
    if(parts.length!==2) continue;
    const domain = parts[1];
    out.add(domain);
    const [host,tld] = domain.split(".");
    if(host) out.add(host);
    if(tld) out.add(tld);
  }
  return Array.from(out);
}
// Simple Levenshtein + fuzzy comparer for names
function levenshtein(a: string, b: string){
  const m=a.length, n=b.length; const dp:number[][]=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
    const cost=a[i-1]===b[j-1]?0:1;
    dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
  }
  return dp[m][n];
}
const near = (a:string,b:string,dist=2)=>levenshtein(a.toLowerCase(),b.toLowerCase())<=dist;

function normUsername(u: string) { return String(u).trim(); }
function normPhone(p: string) {
  let s = String(p).replace(/[^0-9+]/g,"");
  if (!s) return s;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    if (s.startsWith("0")) s = "+49" + s.slice(1);
    else s = "+" + s;
  }
  return s;
}
function phoneRegexFromE164(e164: string) {
  const digits = e164.replace(/[^0-9]/g,"");
  const body = digits.split("").map(d=>`${d}[^0-9]{0,2}`).join("");
  return new RegExp(body,"i");
}
function normText(s?: string) { return (s || '').trim(); }
const ascii = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"");

// --- Sanitizer ---
const EXPOSED_WHITELIST = new Set([
  'email','password','phone','username','address','fullname','name','dob','birthdate','tokens','api_keys','credit_card','location','ip','device','other'
]);

function sanitizeFindings(raw: any): any[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw; else if (raw && Array.isArray(raw.findings)) arr = raw.findings; else return [];
  const out: any[] = [];
  const dedupe = new Set<string>();
  for (const f of arr) {
    const source = normText(f?.source);
    const title = normText(f?.title);
    const date = normText(f?.date);
    const url = normText(f?.url);
    const source_type = normText(f?.source_type);
    const evidence = normText(f?.evidence);
    let confidence = Number.isFinite(f?.confidence) ? Math.max(0, Math.min(100, Number(f.confidence))) : 0;
    let exposed: string[] = Array.isArray(f?.exposed) ? f.exposed.map((x: any)=> String(x).toLowerCase().trim()).filter((x: string)=> EXPOSED_WHITELIST.has(x)) : [];
    const status = normText(f?.status);
    const indicators: string[] = Array.isArray(f?.indicators) ? f.indicators.map((x:any)=>String(x)) : [];
    const trade_score = Number.isFinite(f?.trade_score) ? Math.max(0, Math.min(20, Number(f.trade_score))) : 0;
    const key = `${source}|${title}|${date}|${url}`;
    if (!source && !title && !url) continue;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push({ source, title, date, url, source_type, evidence, exposed, confidence, status, indicators, trade_score });
  }
  out.sort((a,b)=>{
    const c = b.confidence - a.confidence;
    if (c!==0) return c;
    const ta = Date.parse(a.date||"");
    const tb = Date.parse(b.date||"");
    return (isNaN(tb)?0:tb) - (isNaN(ta)?0:ta);
  });
  return out;
}

// --- Recommendations ---
function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }

function actionsForFinding(f: any): string[] {
  const acts: string[] = [];
  const exp = new Set<string>((f?.exposed || []).map((x: string) => String(x).toLowerCase()));
  const sourceType = String(f?.source_type || '').toLowerCase();
  const status = String(f?.status || '').toLowerCase();
  const indicators: string[] = Array.isArray(f?.indicators) ? f.indicators.map((x: any) => String(x).toLowerCase()) : [];

  const isBroker = sourceType === 'broker' || status === 'handel' || indicators.includes('broker_keywords');
  const hashDump = indicators.includes('hash_dump') || indicators.includes('csv_like_dump');

  // generelle Basics
  acts.push('Passwörter prüfen und ggf. ändern – besonders bei betroffenen Diensten');
  acts.push('Zwei‑Faktor‑Authentifizierung (2FA) überall aktivieren');

  if (exp.has('email')) {
    acts.push('Mail‑Konto absichern: starke Passwörter, 2FA, Weiterleitungen/Filter prüfen');
    acts.push('Phishing im Blick behalten; Absender genau prüfen');
  }
  if (exp.has('password') || hashDump) {
    acts.push('Passwort‑Wiederverwendung beenden; überall unterschiedliche Passwörter');
    acts.push('Passwort‑Manager einsetzen und kompromittierte Passwörter austauschen');
  }
  if (exp.has('tokens') || exp.has('api_keys')) {
    acts.push('API‑Schlüssel/Token sofort zurückziehen und neu ausstellen');
    acts.push('Zugehörige Webhooks/Integrationen überprüfen');
  }
  if (exp.has('phone')) {
    acts.push('Mobilfunk‑Konto mit Kunden‑PIN schützen (SIM‑Swap‑Schutz)');
    acts.push('Ungewöhnliche SMS/Anrufe skeptisch behandeln, keine Codes weitergeben');
  }
  if (exp.has('address') || exp.has('fullname') || exp.has('name')) {
    acts.push('Personensuchseiten per Opt‑out entfernen (Datenauskunft/Einwilligung widerrufen)');
  }
  if (exp.has('credit_card')) {
    acts.push('Kartenherausgeber kontaktieren, Karte sperren/neu ausstellen lassen');
    acts.push('Umsätze überwachen und Chargeback‑Fristen beachten');
  }
  if (isBroker) {
    acts.push('Identitäts‑Monitoring aktivieren; ungewöhnliche Anträge/Verträge prüfen');
    acts.push('Bei Verdacht: Kredit‑/Bonitätsauskunft beobachten und Missbrauch melden');
  }

  return uniq(acts).slice(0, 10);
}

function summarizeNextSteps(findings: any[]): string[] {
  const bag: string[] = [];
  for (const f of findings) actionsForFinding(f).forEach(a => bag.push(a));
  return uniq(bag).slice(0, 12);
}

// --- Evidence extraction ---
// Extra detectors
const CC_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g; // basic major brands
const IBAN_REGEX = /\b[A-Z]{2}\d{13,32}\b/g; // generic IBAN pattern
const API_HINTS = /\b(api[_-]?key|secret|token|bearer|authorization|password|passwd|pwd)\b/i;
const TRADE_HINTS = /\b(for sale|verkauf|price|btc|monero|combo list|database dump|logs for sale|stealer|fullz)\b/i;
const ABUSE_HINTS = /\b(phishing|spam list|scam kit|credential stuffing|checker)\b/i;

// Trade / broker indicators
const EMAIL_SIMPLE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;
const HASH_HEX = /\b[a-f0-9]{32,64}\b/ig; // md5/sha1/sha256 length range
const CSV_DELIMS = /[,;\t\|]/;
const PRICE_HINTS = /(\b\d{1,4}(?:[\.,]\d{2})?\s?(?:usd|eur|€|\$)\b|\bprice\b|\bpreisk?\b)/i;
const CONTACT_SELL = /(contact\s+me|dm\s+for|telegram|whatsapp|icq|jabber).*?(?:price|buy|verkauf|sale)/i;

function countEmails(text: string){
  const m = text.match(EMAIL_SIMPLE); return m ? m.length : 0;
}
function highRowDensity(text: string){
  // crude heuristic: many short, delimiter‑separated tokens per line
  const lines = text.split(/\n|\r/).slice(0, 2000);
  let dense = 0;
  for (const ln of lines){
    const parts = ln.split(CSV_DELIMS);
    if (parts.length >= 4 && ln.length > 12) dense++;
  }
  return dense >= 60; // ~60 lines that look like CSV/TSV
}
function detectTradeIndicators(text: string){
  const lower = text.toLowerCase();
  const flags: string[] = [];
  let score = 0;
  const emailCount = countEmails(text);
  const hashCount = (text.match(HASH_HEX)||[]).length;

  if (TRADE_HINTS.test(lower)) { flags.push('broker_keywords'); score += 6; }
  if (PRICE_HINTS.test(text))   { flags.push('price_tag');       score += 3; }
  if (/(btc|bitcoin|monero|xmr)/i.test(text)) { flags.push('crypto'); score += 2; }
  if (CONTACT_SELL.test(lower)) { flags.push('contact_for_sale'); score += 2; }
  if (emailCount >= 50)         { flags.push('bulk_emails');      score += 4; }
  if (hashCount  >= 200)        { flags.push('hash_dump');        score += 4; }
  if (highRowDensity(text))     { flags.push('csv_like_dump');    score += 3; }

  // normalize/clip
  if (score > 20) score = 20;
  return { flags, score };
}

function classifyContext(lower: string){
  if (TRADE_HINTS.test(lower)) return "verkauf";
  if (ABUSE_HINTS.test(lower)) return "missbrauch";
  return "normal";
}

function weightBySource(host:string){
  if (/(?:^|\.)pastebin|ghostbin|hastebin|controlc|rentry|pastelink/i.test(host)) return 12;
  if (/(?:^|\.)github|gist|gitlab/i.test(host)) return 8;
  if (/(?:^|\.)reddit|stackoverflow|superuser/i.test(host)) return 5;
  if (/(?:^|\.)medium|dev\.to/i.test(host)) return 2;
  return 0;
}

function contextSnippet(text: string, idx: number, len: number) {
  const start = Math.max(0, idx-120);
  const end = Math.min(text.length, idx+len+120);
  return text.slice(start,end).replace(/\s+/g," ").trim();
}
function extractEvidence(text: string, opts: {emails:string[],emailHashes:string[],emailEnc:string[],phones:string[],names:string[]}) {
  const lower = text.toLowerCase();
  const evidences:string[] = [];
  let confidence=0;
  const exposed:string[]=[];
  // helper for obfuscated email regex
  function emailObfRegex(e: string){
    const [local,domain] = e.toLowerCase().split("@");
    if(!local||!domain) return null;
    const esc = (s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const dot = "\\s*(?:\\.|dot)\\s*";
    const at = "\\s*(?:@|\n|\\[at\\]|\\(at\\)|\\s+at\\s+)\\s*";
    const localRx = esc(local).replace(/\./g,dot);
    const domainRx = esc(domain).replace(/\./g,dot);
    return new RegExp(`${localRx}${at}${domainRx}`,'i');
  }
  for (const e of opts.emails) {
    const eLower = e.toLowerCase();
    let found=false;
    let pos=-1; let len=e.length;
    const idx=lower.indexOf(eLower);
    if(idx!==-1){found=true; pos=idx;}
    if(!found){ const rx=emailObfRegex(eLower); if(rx){ const m=rx.exec(text); if(m){found=true; pos=m.index; len=m[0].length;} } }
    if(!found){
      // very loose: allow spaces between characters of local/domain
      const esc = (s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const spaced = eLower.replace(/([@.])/g,'$1').split("").map(ch=>ch.match(/[a-z0-9]/)?`${ch}\\s*`:esc(ch)).join("");
      const rx2 = new RegExp(spaced,'i');
      const m2 = rx2.exec(text);
      if(m2){found=true; pos=m2.index; len=m2[0].length;}
    }
    if(found){exposed.push("email"); evidences.push(contextSnippet(text,pos,len)); confidence+=40;}
  }
  for (const h of opts.emailHashes) {
    const idx=lower.indexOf(h);
    if(idx!==-1){exposed.push("email"); evidences.push(contextSnippet(text,idx,h.length)); confidence+=25;}
  }
  for (const enc of opts.emailEnc) {
    const idx=lower.indexOf(enc.toLowerCase());
    if(idx!==-1){exposed.push("email"); evidences.push(contextSnippet(text,idx,enc.length)); confidence+=15;}
  }
  for (const p of opts.phones) {
    const rx=phoneRegexFromE164(p);
    const m=rx.exec(text);
    if(m){exposed.push("phone"); evidences.push(contextSnippet(text,m.index,m[0].length)); confidence+=35;}
  }
  for (const n of opts.names) {
    const idx=lower.indexOf(n.toLowerCase());
    if(idx!==-1){exposed.push("name"); evidences.push(contextSnippet(text,idx,n.length)); confidence+=10;}
  }
  return {confidence: Math.min(100,confidence), evidence: evidences.slice(0,3).join(" … "), exposed:[...new Set(exposed)]};
}

// --- Handler ---
export async function POST(req: Request) {
  try {
    const ip=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"unknown";
    if(!rateLimit(ip)) return NextResponse.json({error:"Zu viele Anfragen. Bitte später erneut."},{status:429});
    const body=(await req.json()) as Payload;
    const deepScan = body.deepScan === true;

    const emails=(body.emails??[]).map(normEmail).filter(Boolean);
    const usernames=(body.usernames??[]).map(normUsername).filter(Boolean);
    const phones=(body.phones??[]).map(normPhone).filter(Boolean);

    // --- DEMO MODE ---
    // Triggered if demo@detecto.ai is among emails OR explicit body.demo === true
    const isDemo = (emails || []).includes('demo@detecto.ai') || (body as any)?.demo === true;
    if (isDemo) {
      const demoFindings = [
        {
          source: "pastebin.com",
          title: "Combo dump (sample)",
          date: "2024-11-07",
          url: "https://pastebin.com/abcdef12",
          source_type: "paste",
          evidence: "… demo@detecto.ai : hunter2 …",
          exposed: ["email","password"],
          confidence: 92,
          status: "kritisch",
          indicators: ["hash_dump","broker_keywords"],
          trade_score: 9
        },
        {
          source: "gist.github.com",
          title: "Credentials list (example)",
          date: "2025-02-14",
          url: "https://gist.github.com/1234567890",
          source_type: "open_web",
          evidence: "… api_key=sk-demo-XXXXXXXXXXXXXXXX ; jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
          exposed: ["tokens","api_keys","email"],
          confidence: 78,
          status: "hoch",
          indicators: ["jwt_token","api_key"],
          trade_score: 4
        },
        {
          source: "controlc.com",
          title: "phone/email list",
          date: "2025-03-22",
          url: "https://controlc.com/abcdef",
          source_type: "paste",
          evidence: "… +49 170 0000000 ; demo [at] detecto [dot] ai …",
          exposed: ["phone","email"],
          confidence: 65,
          status: "mittel",
          indicators: ["obfuscated_email"],
          trade_score: 2
        }
      ];

      const findings = sanitizeFindings(demoFindings).map(f => ({ ...f, actions: actionsForFinding(f) }));
      const next_steps = summarizeNextSteps(findings);
      const stats = { queries: deepScan ? 24 : 12, hits: demoFindings.length };
      const query = { ...body, demo: true };
      return NextResponse.json({ query, findings, next_steps, stats }, { status: 200 });
    }

    const fullName=normText(body.fullName);
    const city=normText(body.city);
    const country=normText(body.country);
    const address=normText(body.address);
    const birthYear=Number.isFinite(body.birthYear)?Number(body.birthYear):undefined;
    const aliases=(body.aliases??[]).map(normText).filter(Boolean);
    const services=(body.services??[]).map(normText).filter(Boolean);

    if(!emails.length && !usernames.length && !phones.length && !fullName && !city && !country && !address) {
      return NextResponse.json({error:"Bitte gib mindestens eine E‑Mail, einen Nutzernamen, eine Telefonnummer oder Name/Ort an."},{status:400});
    }

    // Build variants & hashes
    const emailAllVariants = Array.from(new Set(emails.flatMap(emailVariants)));
    const emailAllHashes = Array.from(new Set(emails.flatMap(emailHashes)));
    const emailAllEnc = Array.from(new Set(emails.flatMap(emailEncodings)));
    const emailSearchSet = Array.from(new Set([...emailAllVariants, ...emailAllHashes, ...emailAllEnc]));
    const phonesE164 = Array.from(new Set(phones));
    const nameTokens: string[] = [];
    if(fullName) {
      const n=ascii(fullName.trim());
      nameTokens.push(n);
      if(city) nameTokens.push(`${n} ${ascii(city)}`);
      if(country) nameTokens.push(`${n} ${ascii(country)}`);
    }
    for(const a of aliases){ if(a) nameTokens.push(ascii(a)); }
    // Username and domain tokens for expansion
    const userTokens = Array.from(new Set(usernames.flatMap(usernameVariants)));
    const domainTokens = emailDomainTokens(emails);

    const queryPayload={emails,usernames,phones,person:{fullName,city,country,address,birthYear,aliases:aliases.length?aliases:undefined},context:{services:services.length?services:undefined},deepScan};

    async function getBaseUrl(req: Request) {
      const proto=req.headers.get("x-forwarded-proto")||"https";
      const host=req.headers.get("x-forwarded-host")||req.headers.get("host");
      return `${proto}://${host}`;
    }
    const base=await getBaseUrl(req);

    // Build expanded queries (mode-aware)
    const strongHints=[
      ...emailSearchSet,
      ...phonesE164,
      ...nameTokens.map(n=>`"${n}"`),
      ...userTokens,
      ...domainTokens
    ];

    const pasteSitesLite=["site:pastebin.com","site:ghostbin.com","site:controlc.com","site:github.com","site:reddit.com"];
    const pasteSitesFull=["site:pastebin.com","site:ghostbin.com","site:hastebin.com","site:controlc.com","site:rentry.co","site:pastelink.net","site:github.com","site:gist.github.com","site:reddit.com"]; 

    const extraKwLite=["leak","datenleck","data breach","paste","dump","exposed","breach"];
    const extraKwFull=[
      "leak","datenleck","data breach","paste","dump","combo list","credential dump","verkauf","for sale","price","btc","monero","logs",
      "database","csv","txt","json","public","index","checker","combo","stealer"
    ];

    const pasteSites = deepScan ? pasteSitesFull : pasteSitesLite;
    const extraKw = deepScan ? extraKwFull : extraKwLite;
    const maxQueries = deepScan ? 80 : 20;

    const extraQueries=Array.from(new Set([
      ...strongHints,
      ...strongHints.flatMap(h=>extraKw.map(x=>`${h} ${x}`)),
      ...pasteSites.flatMap(ps=>strongHints.map(h=>`${ps} ${h}`)),
      ...services.flatMap(svc=>strongHints.map(h=>`${h} ${svc}`)),
    ])).slice(0,maxQueries);

    const osintRes=await fetch(`${base}/api/osint/search`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({extraQueries}),cache:"no-store"
    });
    let hits:any[]=[];
    if(osintRes.ok){try{const data=await osintRes.json(); hits=Array.isArray(data?.hits)?data.hits.slice(0, deepScan ? 40 : 15):[];}catch{}}

    // Fetch pages for evidence
    const findingsRaw:any[]=[];
    for(const h of hits){
      try {
        const res=await fetch(h.link,{method:"GET",cache:"no-store"});
        if(!res.ok) continue;
        const html=await res.text();
        const text=htmlToText(html,{wordwrap:false,selectors:[{selector:"script",format:"skip"},{selector:"style",format:"skip"}]});
        let extraTexts: string[] = [];
        if(deepScan){
          const hrefs = Array.from(html.matchAll(/href=\"([^\"]+)\"/g)).slice(0,50).map(m=>m[1]);
          const sameHostLinks = hrefs
            .map(href=>{ try{ return new URL(href, h.link).toString(); }catch{ return null; } })
            .filter((u): u is string => !!u && new URL(u).hostname===new URL(h.link).hostname)
            .filter(u=>/(leak|dump|paste|data|csv|txt)/i.test(u))
            .slice(0,3);
          for(const u of sameHostLinks){
            try{
              const r2=await fetch(u,{method:"GET",cache:"no-store"});
              if(!r2.ok) continue; const h2=await r2.text();
              const t2=htmlToText(h2,{wordwrap:false,selectors:[{selector:"script",format:"skip"},{selector:"style",format:"skip"}]});
              extraTexts.push(t2);
            }catch{}
          }
        }
        const ev=extractEvidence(text,{emails:emailSearchSet,emailHashes:emailAllHashes,emailEnc:emailAllEnc,phones:phonesE164,names:nameTokens});
        for(const t2 of extraTexts){
          const ev2 = extractEvidence(t2,{emails:emailSearchSet,emailHashes:emailAllHashes,emailEnc:emailAllEnc,phones:phonesE164,names:nameTokens});
          if(ev2.confidence>ev.confidence){
            ev.confidence = ev2.confidence;
            ev.evidence = ev2.evidence;
            ev.exposed = Array.from(new Set([...(ev.exposed||[]), ...(ev2.exposed||[])]));
          }
        }
        const host=new URL(h.link).hostname;
        const lower=text.toLowerCase();
        const status = classifyContext(lower);
        const trade = detectTradeIndicators(text);
        const bonus = weightBySource(host) + (status!=="normal"?8:0) + (trade.score>=8?6:0);
        const conf = Math.min(100, ev.confidence + bonus);
        if(ev.confidence>0){
          findingsRaw.push({
            source:host,
            title:h.title||host,
            url:h.link,
            source_type: trade.score>=10 ? "broker" : "open_web",
            evidence:ev.evidence,
            exposed:ev.exposed,
            confidence:conf,
            status: trade.score>=10 ? "handel" : status,
            indicators: trade.flags,
            trade_score: trade.score
          });
        }
      } catch{}
    }

    // Ask GPT to validate/structure
    const system=`Du bist ein präziser Sicherheits-Assistent. Analysiere die übergebenen Findings und validiere nur echte, belegbare Treffer. Ergänze falls nötig mit Quelle/Typ. Gib JSON zurück.`;
    const user={role:"user",content:[{type:"text",text:`Query: ${JSON.stringify(queryPayload)}\nRoh-Findings: ${JSON.stringify(findingsRaw)}`}]} as const;

    const aiTimeoutMs = deepScan ? 30000 : 18000;
    const aiMaxTokens = deepScan ? 1600 : 1100;

    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),aiTimeoutMs);
    const aiRes=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:system},user],temperature:0,response_format:{type:"json_object"},max_tokens: aiMaxTokens}),
      signal:controller.signal
    });
    clearTimeout(timeout);
    if(!aiRes.ok){const errText=await aiRes.text(); throw new Error(`OpenAI API Fehler: ${errText}`);}
    const aiData=await aiRes.json();
    let parsed:any; try{const content=aiData.choices?.[0]?.message?.content??"{}"; parsed=JSON.parse(content);}catch{parsed={findings:[]};}
    const findings = sanitizeFindings(parsed);
    const findingsWithActions = findings.map(f => ({ ...f, actions: actionsForFinding(f) }));
    const next_steps = summarizeNextSteps(findingsWithActions);
    const stats = { queries: extraQueries.length, hits: hits.length };
    return NextResponse.json({ query: queryPayload, findings: findingsWithActions, next_steps, stats }, { status: 200 });
  } catch(e:any) {
    const msg=e?.name==="AbortError"?"Zeitüberschreitung bei der Abfrage":(e?.message||"Fehler");
    return NextResponse.json({error:msg},{status:500});
  }
}
