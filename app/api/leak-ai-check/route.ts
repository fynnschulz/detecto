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
    const key = `${source}|${title}|${date}|${url}`;
    if (!source && !title && !url) continue;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push({ source, title, date, url, source_type, evidence, exposed, confidence, status });
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

// --- Evidence extraction ---
// Extra detectors
const CC_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g; // basic major brands
const IBAN_REGEX = /\b[A-Z]{2}\d{13,32}\b/g; // generic IBAN pattern
const API_HINTS = /\b(api[_-]?key|secret|token|bearer|authorization|password|passwd|pwd)\b/i;
const TRADE_HINTS = /\b(for sale|verkauf|price|btc|monero|combo list|database dump|logs for sale|stealer|fullz)\b/i;
const ABUSE_HINTS = /\b(phishing|spam list|scam kit|credential stuffing|checker)\b/i;

function classifyContext(lower: string){
  if (TRADE_HINTS.test(lower)) return "verkauf";
  if (ABUSE_HINTS.test(lower)) return "missbrauch";
  return "normal";
}

function weightBySource(host:string){
  if (/pastebin|ghostbin|hastebin|controlc|rentry|pastelink/i.test(host)) return 10;
  if (/github|gist|reddit/i.test(host)) return 6;
  return 0;
}

function contextSnippet(text: string, idx: number, len: number) {
  const start = Math.max(0, idx-120);
  const end = Math.min(text.length, idx+len+120);
  return text.slice(start,end).replace(/\s+/g," ").trim();
}
function extractEvidence(text: string, opts: {emails:string[],emailHashes:string[],phones:string[],names:string[]}) {
  const lower = text.toLowerCase();
  const evidences:string[] = [];
  let confidence=0;
  const exposed:string[]=[];
  for (const e of opts.emails) {
    const idx=lower.indexOf(e.toLowerCase());
    if(idx!==-1){exposed.push("email"); evidences.push(contextSnippet(text,idx,e.length)); confidence+=40;}
  }
  for (const h of opts.emailHashes) {
    const idx=lower.indexOf(h);
    if(idx!==-1){exposed.push("email"); evidences.push(contextSnippet(text,idx,h.length)); confidence+=25;}
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

    const queryPayload={emails,usernames,phones,person:{fullName,city,country,address,birthYear,aliases:aliases.length?aliases:undefined},context:{services:services.length?services:undefined},deepScan};

    async function getBaseUrl(req: Request) {
      const proto=req.headers.get("x-forwarded-proto")||"https";
      const host=req.headers.get("x-forwarded-host")||req.headers.get("host");
      return `${proto}://${host}`;
    }
    const base=await getBaseUrl(req);

    // Build expanded queries (mode-aware)
    const strongHints=[...emailSearchSet,...phonesE164,...nameTokens.map(n=>`"${n}"`)];

    const pasteSitesLite=["site:pastebin.com","site:ghostbin.com","site:controlc.com","site:github.com","site:reddit.com"];
    const pasteSitesFull=["site:pastebin.com","site:ghostbin.com","site:hastebin.com","site:controlc.com","site:rentry.co","site:pastelink.net","site:github.com","site:gist.github.com","site:reddit.com"]; 

    const extraKwLite=["leak","datenleck","data breach","paste","dump"]; 
    const extraKwFull=["leak","datenleck","data breach","paste","dump","combo list","credential dump","verkauf","for sale","price","btc","monero","logs"]; 

    const pasteSites = deepScan ? pasteSitesFull : pasteSitesLite;
    const extraKw = deepScan ? extraKwFull : extraKwLite;
    const maxQueries = deepScan ? 60 : 20;

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
        const ev=extractEvidence(text,{emails:emailSearchSet,emailHashes:emailSearchSet,phones:phonesE164,names:nameTokens});
        const host=new URL(h.link).hostname;
        const lower=text.toLowerCase();
        const status = classifyContext(lower);
        const bonus = weightBySource(host) + (status!=="normal"?8:0);
        const conf = Math.min(100, ev.confidence + bonus);
        if(ev.confidence>0){
          findingsRaw.push({
            source:host,
            title:h.title||host,
            url:h.link,
            source_type:"open_web",
            evidence:ev.evidence,
            exposed:ev.exposed,
            confidence:conf,
            status
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
    const findings=sanitizeFindings(parsed);
    return NextResponse.json({query:queryPayload,findings},{status:200});
  } catch(e:any) {
    const msg=e?.name==="AbortError"?"Zeitüberschreitung bei der Abfrage":(e?.message||"Fehler");
    return NextResponse.json({error:msg},{status:500});
  }
}
