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

const DOMAIN_CATEGORY_RULES: Array<{ test: RegExp; cat: CategoryKey }> = [
  { test: /(amazon|amazon\.[a-z]{2,}|amzn)/, cat: 'marketplace' },
  { test: /(ebay|kleinanzeigen|etsy|aliexpress|zalando|otto|shein|temu)/, cat: 'onlineshop' },
  { test: /(sparkasse|volksbank|n26|revolut|wise|comdirect|dkb|ing-diba|ing\.de|ing\.com|paypal)/, cat: 'bank_finance' },
  { test: /(facebook|fb\.com|instagram|tiktok|snapchat|twitter|x\.com|linkedin|pinterest|reddit|discord)/, cat: 'social_media' },
  { test: /(netflix|amazonvideo|primevideo|disney|hulu|paramount|wowtv|wow\.tv|sky|spotify|applemusic|music\.apple|youtube|youtubemusic)/, cat: 'streaming' },
  { test: /(steam|epicgames|playstation|xbox|nintendo|riotgames|blizzard|origin|ea\.com)/, cat: 'gaming' },
  { test: /(gmail|googlemail|outlook|hotmail|live\.com|gmx|web\.de|yahoo)/, cat: 'email_provider' },
  { test: /(dropbox|drive\.google|onedrive|icloud|box\.com|mega\.nz)/, cat: 'cloud_storage' },
  { test: /(booking|airbnb|expedia|skyscanner|ryanair|lufthansa|bahn|deutschebahn|flixbus|uber|bolt)/, cat: 'travel' },
  { test: /(lieferando|doordash|ubereats|wolt|deliveroo|gorillas|flink)/, cat: 'food_delivery' },
  { test: /(nytimes|washingtonpost|guardian|spiegel|zeit|welt|faz|bbc|cnn|tagesschau)/, cat: 'news_media' },
  { test: /(doctolib|teleclinic|ada\.com|myfitnesspal|fitbit|withings)/, cat: 'healthcare' },
  { test: /(github|gitlab|bitbucket|notion|slack|trello|asana|figma|canva)/, cat: 'utilities' },
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
  s = s.replace(/^https?:\/\//, '');
  const slash = s.indexOf('/');
  if (slash !== -1) s = s.slice(0, slash);
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/^www\./, '');
  return s;
}

// ---- Tiny UI helpers (local only to the modal) ----
function Favicon({ domain }: { domain: string }) {
  const url = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-5 w-5 rounded-sm opacity-90 drop-shadow-[0_2px_8px_rgba(255,255,255,0.25)]"
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
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} Sterne`}
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-md border flex items-center justify-center transition ${
              n <= value ? 'bg-amber-400/80 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]' : 'hover:bg-amber-400/20'
            }`}
          >
            ★
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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
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
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.05] p-6 shadow-2xl backdrop-blur"
            >
              {/* decorative sheen */}
              <div aria-hidden className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 h-24 w-[140%] bg-gradient-to-b from-white/10 to-transparent blur-2xl" />

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Neuen Beitrag erstellen</h2>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/10"
                  aria-label="Modal schließen"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm mb-1">Domain (Titel)</label>
                  <div className="flex items-center gap-2">
                    {domain && <Favicon domain={domain} />}
                    <input
                      type="text"
                      placeholder="z. B. https://www.shop.de/produkt"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30 backdrop-blur"
                    />
                  </div>
                  {domain && (
                    <p className="text-xs opacity-70 mt-1">
                      Wird gespeichert als: <span className="font-medium">{domain}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm mb-1">Deine Erfahrung</label>
                  <textarea
                    placeholder="Beschreibe kurz und sachlich, was passiert ist…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30 backdrop-blur"
                  />
                  <p className="text-xs opacity-60 mt-1">{content.trim().length} / 20 Zeichen min.</p>
                </div>

                <div className="rounded-2xl border border-white/10 p-3">
                  <p className="text-sm font-medium mb-2">Bewertung (1–5 Sterne)</p>
                  <StarInput label="Seriösität" value={serio} onChange={setSerio} />
                  <StarInput label="Transparenz" value={transp} onChange={setTransp} />
                  <StarInput label="Kundenerfahrung" value={kunde} onChange={setKunde} />
                </div>

                {err && <div className="text-sm text-red-400">{err}</div>}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/20 disabled:opacity-50"
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
