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
    const key = `${source}|${title}|${date}|${url}`;
    if (!source && !title && !url) continue;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push({ source, title, date, url, source_type, evidence, exposed, confidence });
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
    const phonesE164 = Array.from(new Set(phones));
    const nameTokens: string[] = [];
    if(fullName) {
      const n=ascii(fullName.trim());
      nameTokens.push(n);
      if(city) nameTokens.push(`${n} ${ascii(city)}`);
      if(country) nameTokens.push(`${n} ${ascii(country)}`);
    }
    for(const a of aliases){ if(a) nameTokens.push(ascii(a)); }

    const queryPayload={emails,usernames,phones,person:{fullName,city,country,address,birthYear,aliases:aliases.length?aliases:undefined},context:{services:services.length?services:undefined}};

    async function getBaseUrl(req: Request) {
      const proto=req.headers.get("x-forwarded-proto")||"https";
      const host=req.headers.get("x-forwarded-host")||req.headers.get("host");
      return `${proto}://${host}`;
    }
    const base=await getBaseUrl(req);

    // Build expanded queries
    const strongHints=[...emailAllVariants,...phonesE164,...nameTokens.map(n=>`\"${n}\"`)];
    const pasteSites=["site:pastebin.com","site:ghostbin.com","site:hastebin.com","site:controlc.com","site:rentry.co","site:pastelink.net"];
    const extraQueries=Array.from(new Set([
      ...strongHints,
      ...strongHints.map(h=>`${h} leak`),
      ...strongHints.map(h=>`${h} datenleck`),
      ...strongHints.map(h=>`${h} data breach`),
      ...pasteSites.flatMap(ps=>strongHints.map(h=>`${ps} ${h}`)),
      ...services.flatMap(svc=>strongHints.map(h=>`${h} ${svc}`)),
    ])).slice(0,30);

    const osintRes=await fetch(`${base}/api/osint/search`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({extraQueries}),cache:"no-store"
    });
    let hits:any[]=[];
    if(osintRes.ok){try{const data=await osintRes.json(); hits=Array.isArray(data?.hits)?data.hits.slice(0,20):[];}catch{}}

    // Fetch pages for evidence
    const findingsRaw:any[]=[];
    for(const h of hits){
      try {
        const res=await fetch(h.link,{method:"GET",cache:"no-store"});
        if(!res.ok) continue;
        const html=await res.text();
        const text=htmlToText(html,{wordwrap:false,selectors:[{selector:"script",format:"skip"},{selector:"style",format:"skip"}]});
        const ev=extractEvidence(text,{emails:emailAllVariants,emailHashes:emailAllHashes,phones:phonesE164,names:nameTokens});
        if(ev.confidence>0){
          findingsRaw.push({source:new URL(h.link).hostname,title:h.title||new URL(h.link).hostname,url:h.link,source_type:"open_web",evidence:ev.evidence,exposed:ev.exposed,confidence:ev.confidence});
        }
      } catch{}
    }

    // Ask GPT to validate/structure
    const system=`Du bist ein präziser Sicherheits-Assistent. Analysiere die übergebenen Findings und validiere nur echte, belegbare Treffer. Ergänze falls nötig mit Quelle/Typ. Gib JSON zurück.`;
    const user={role:"user",content:[{type:"text",text:`Query: ${JSON.stringify(queryPayload)}\nRoh-Findings: ${JSON.stringify(findingsRaw)}`}]} as const;

    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),20000);
    const aiRes=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:system},user],temperature:0,response_format:{type:"json_object"},max_tokens:1200}),
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
