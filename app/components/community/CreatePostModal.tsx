'use client';

import React, { useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { motion, AnimatePresence } from 'framer-motion';

// ---- Types & category helpers (local + minimal, preserve behavior) ----
export type CategoryKey =
  | 'onlineshop'
  | 'bank_finance'
  | 'social_media'
  | 'streaming'
  | 'gaming'
  | 'email_provider'
  | 'cloud_storage'
  | 'travel'
  | 'food_delivery'
  | 'marketplace'
  | 'news_media'
  | 'healthcare'
  | 'utilities'
  | 'other';

const rx = (alts: string[]) =>
  new RegExp(`(?:^|[.-])(?:${alts.join('|')})(?:$|[.-])`);

const DOMAIN_CATEGORY_RULES: Array<{ test: RegExp; cat: CategoryKey }> = [
  // MARKTPLATZ / SHOPS
  { test: rx(['amazon', 'amzn']), cat: 'marketplace' },
  { test: rx(['ebay', 'kleinanzeigen', 'etsy', 'zalando', 'otto', 'shein', 'temu']), cat: 'onlineshop' },

  // BANK/FINANCE
  { test: rx(['sparkasse', 'volksbank', 'n26', 'revolut', 'wise', 'comdirect', 'dkb', 'ing', 'paypal']), cat: 'bank_finance' },

  // SOCIAL
  { test: rx(['facebook', 'fb', 'instagram', 'tiktok', 'snapchat', 'twitter', 'x', 'linkedin', 'pinterest', 'reddit', 'discord']), cat: 'social_media' },

  // STREAMING/MUSIC
  { test: rx(['netflix', 'primevideo', 'amazonvideo', 'disney', 'hulu', 'paramount', 'wowtv', 'wow', 'sky', 'spotify', 'applemusic', 'music.apple', 'youtube', 'youtubemusic']), cat: 'streaming' },

  // GAMING
  { test: rx(['steam', 'epicgames', 'playstation', 'xbox', 'nintendo', 'riotgames', 'blizzard', 'origin', 'ea']), cat: 'gaming' },

  // E-MAIL
  { test: rx(['gmail', 'googlemail', 'outlook', 'hotmail', 'live', 'gmx', 'web', 'yahoo']), cat: 'email_provider' },

  // CLOUD
  { test: rx(['dropbox', 'drive.google', 'onedrive', 'icloud', 'box', 'mega']), cat: 'cloud_storage' },

  // TRAVEL
  { test: rx(['booking', 'airbnb', 'expedia', 'skyscanner', 'ryanair', 'lufthansa', 'bahn', 'deutschebahn', 'flixbus', 'uber', 'bolt']), cat: 'travel' },

  // FOOD
  { test: rx(['lieferando', 'doordash', 'ubereats', 'wolt', 'deliveroo', 'gorillas', 'flink']), cat: 'food_delivery' },

  // NEWS/MEDIA
  { test: rx(['nytimes', 'washingtonpost', 'guardian', 'spiegel', 'zeit', 'welt', 'faz', 'bbc', 'cnn', 'tagesschau']), cat: 'news_media' },

  // HEALTH
  { test: rx(['doctolib', 'teleclinic', 'ada', 'myfitnesspal', 'fitbit', 'withings']), cat: 'healthcare' },

  // UTILITIES / BIZ-TOOLS
  { test: rx(['github', 'gitlab', 'bitbucket', 'notion', 'slack', 'trello', 'asana', 'figma', 'canva']), cat: 'utilities' },
];

function categorizeDomain(domain: string): CategoryKey {
  const d = (domain || '').toLowerCase();
  for (const rule of DOMAIN_CATEGORY_RULES) {
    if (rule.test.test(d)) return rule.cat;
  }
  if (/(shop|store)/.test(d)) return 'onlineshop';
  return 'other';
}

function normalizeDomain(input: string) {
  if (!input) return '';
  let s = input.trim().toLowerCase();
  // first token if user pasted with spaces
  s = s.split(/\s+/)[0];

  // Try URL parsing; fallback to manual
  try {
    if (!/^https?:\/\//.test(s)) s = 'http://' + s;
    const u = new URL(s);
    s = u.hostname || s;
  } catch {
    s = s.replace(/^https?:\/\//, '').split('/')[0];
  }

  // strip www. and port
  s = s.replace(/^www\./, '').replace(/:\d+$/, '');

  // eTLD+1 heuristic for common public suffixes
  const parts = s.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const specialSuffixes = new Set([
    'co.uk', 'com.au', 'co.jp', 'com.br', 'com.ar', 'com.mx',
    'com.tr', 'co.in', 'co.za', 'com.sg', 'com.cn'
  ]);

  const last2 = parts.slice(-2).join('.');
  const last3 = parts.slice(-3).join('.');

  if (specialSuffixes.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// ---- Tiny UI helpers (local only to the modal) ----
function Favicon({ domain }: { domain: string }) {
  const url = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-5 w-5 rounded-sm opacity-90 ring-1 ring-white/20 drop-shadow-[0_2px_8px_rgba(255,255,255,0.25)]"
      loading="lazy"
      decoding="async"
    />
  );
}

function Star({ filled = false, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      className={`transition duration-300 will-change-transform ${filled ? 'opacity-100 scale-105' : 'opacity-70'}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.787 1.401 8.168L12 18.896l-7.335 3.87 1.401-8.168L.132 9.211l8.2-1.193L12 .587z"
        stroke="currentColor"
      />
    </svg>
  );
}

function StarInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm opacity-90">{label}</span>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} Sterne`}
            onClick={() => onChange(n)}
            className={`p-2 rounded-full transition transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/20 ${
              n <= value
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={n <= value ? 'fill-current drop-shadow-[0_4px_12px_rgba(255,193,7,0.35)]' : 'fill-none'}
            >
              <path
                d="M12 17.3l-5.3 3 1.4-5.9-4.5-3.9 6-.5L12 4l2.4 6 6 .5-4.5 3.9 1.4 5.9z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Component ----
export default function CreatePostModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClientComponentClient();

  const [domainInput, setDomainInput] = useState('');
  const domain = useMemo(() => normalizeDomain(domainInput), [domainInput]);

  const [content, setContent] = useState('');
  const [serio, setSerio] = useState(3);
  const [transp, setTransp] = useState(3);
  const [kunde, setKunde] = useState(3);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!domain || domain.length < 3 || !domain.includes('.')) {
      setErr('Bitte eine gültige Domain angeben (z. B. example.com).');
      return;
    }
    if (!content || content.trim().length < 20) {
      setErr('Bitte beschreibe deine Erfahrung (mindestens 20 Zeichen).');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErr('Bitte zuerst einloggen, um einen Beitrag zu posten.');
        return;
      }

      const category = categorizeDomain(domain);

      const { error: insertError } = await supabase.from('community_posts').insert({
        user_id: user.id,
        domain,
        content: content.trim(),
        rating_seriositaet: serio,
        rating_transparenz: transp,
        rating_kundenerfahrung: kunde,
        category,
      });

      if (insertError) {
        if (
          insertError.code === '42703' ||
          (String(insertError.message || '').toLowerCase().includes('column') &&
            String(insertError.message || '').toLowerCase().includes('category'))
        ) {
          const { error: e2 } = await supabase.from('community_posts').insert({
            user_id: user.id,
            domain,
            content: content.trim(),
            rating_seriositaet: serio,
            rating_transparenz: transp,
            rating_kundenerfahrung: kunde,
          });
          if (e2) throw e2;
        } else {
          throw insertError;
        }
      }

      onCreated();
      onClose();
      // reset form
      setDomainInput('');
      setContent('');
      setSerio(3);
      setTransp(3);
      setKunde(3);
    } catch (e: any) {
      console.error('Insert error', e);
      setErr(e?.message ?? 'Unbekannter Fehler beim Speichern.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.12),transparent_60%)] bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 top-16 z-50 mx-auto w-full max-w-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="relative overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl ring-1 ring-white/10"
            >
              {/* decorative sheen */}
              <div aria-hidden className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 h-28 w-[160%] bg-gradient-to-b from-white/15 to-transparent blur-3xl" />

              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight drop-shadow">Neuen Beitrag erstellen</h2>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/15 active:scale-95 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  aria-label="Modal schließen"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm mb-1 opacity-80">Domain (Titel)</label>
                  <div className="flex items-center gap-2">
                    {domain && <Favicon domain={domain} />}
                    <input
                      type="text"
                      placeholder="z. B. https://www.shop.de/produkt"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/20 bg-white/10/50 px-3 py-2 outline-none focus:border-white/40 focus:ring-4 focus:ring-white/10 backdrop-blur-md placeholder:opacity-60 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition"
                    />
                  </div>
                  {domain && (
                    <p className="text-xs opacity-80 mt-1">
                      Wird gespeichert als: <span className="font-medium">{domain}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm mb-1 opacity-80">Deine Erfahrung</label>
                  <textarea
                    placeholder="Beschreibe kurz und sachlich, was passiert ist…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded-xl border border-white/20 bg-white/10/50 px-3 py-2 outline-none focus:border-white/40 focus:ring-4 focus:ring-white/10 backdrop-blur-md placeholder:opacity-60 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition"
                  />
                  <p className="text-xs opacity-70 mt-1">{content.trim().length} / 20 Zeichen min.</p>
                </div>

                <div className="rounded-2xl border border-white/15 p-3 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                  <p className="text-sm font-medium mb-2">Bewertung (1–5 Sterne)</p>
                  <StarInput label="Seriösität" value={serio} onChange={setSerio} />
                  <StarInput label="Transparenz" value={transp} onChange={setTransp} />
                  <StarInput label="Kundenerfahrung" value={kunde} onChange={setKunde} />
                </div>

                {err && <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">{err}</div>}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 active:scale-95 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl border border-white/20 bg-gradient-to-r from-amber-400 to-rose-400 text-black font-medium px-4 py-2 hover:brightness-110 active:scale-95 transition shadow-[0_8px_30px_rgba(255,179,71,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Speichern…' : 'Beitrag posten'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
