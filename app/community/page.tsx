'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { motion, AnimatePresence } from 'framer-motion';

// --- Category helpers ---
type CategoryKey =
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

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  onlineshop: 'Onlineshops',
  bank_finance: 'Banken & Finanzen',
  social_media: 'Social Media',
  streaming: 'Streaming',
  gaming: 'Gaming',
  email_provider: 'E-Mail-Provider',
  cloud_storage: 'Cloud & Speicher',
  travel: 'Reisen',
  food_delivery: 'Lieferdienste',
  marketplace: 'Marktplätze',
  news_media: 'News & Medien',
  healthcare: 'Gesundheit',
  utilities: 'Tools & Sonstiges',
  other: 'Sonstiges',
};

const DOMAIN_CATEGORY_RULES: Array<{ test: RegExp; cat: CategoryKey }> = [
  // Onlineshops / Marktplätze
  { test: /(amazon|amazon\.[a-z]{2,}|amzn)/, cat: 'marketplace' },
  { test: /(ebay|kleinanzeigen|etsy|aliexpress|zalando|otto|shein|temu)/, cat: 'onlineshop' },
  // Banken & Finanzen
  { test: /(sparkasse|volksbank|n26|revolut|wise|comdirect|dkb|ing-diba|ing\.de|ing\.com|paypal)/, cat: 'bank_finance' },
  // Social
  { test: /(facebook|fb\.com|instagram|tiktok|snapchat|twitter|x\.com|linkedin|pinterest|reddit|discord)/, cat: 'social_media' },
  // Streaming
  { test: /(netflix|amazonvideo|primevideo|disney|hulu|paramount|wowtv|wow\.tv|sky|spotify|applemusic|music\.apple|youtube|youtubemusic)/, cat: 'streaming' },
  // Gaming
  { test: /(steam|epicgames|playstation|xbox|nintendo|riotgames|blizzard|origin|ea\.com)/, cat: 'gaming' },
  // Mail
  { test: /(gmail|googlemail|outlook|hotmail|live\.com|gmx|web\.de|yahoo)/, cat: 'email_provider' },
  // Cloud
  { test: /(dropbox|drive\.google|onedrive|icloud|box\.com|mega\.nz)/, cat: 'cloud_storage' },
  // Travel
  { test: /(booking|airbnb|expedia|skyscanner|ryanair|lufthansa|bahn|deutschebahn|flixbus|uber|bolt)/, cat: 'travel' },
  // Food
  { test: /(lieferando|doordash|ubereats|wolt|deliveroo|gorillas|flink)/, cat: 'food_delivery' },
  // News
  { test: /(nytimes|washingtonpost|guardian|spiegel|zeit|welt|faz|bbc|cnn|tagesschau)/, cat: 'news_media' },
  // Healthcare
  { test: /(doctolib|teleclinic|ada\.com|myfitnesspal|fitbit|withings)/, cat: 'healthcare' },
  // Utilities
  { test: /(github|gitlab|bitbucket|notion|slack|trello|asana|figma|canva)/, cat: 'utilities' },
];

function categorizeDomain(domain: string): CategoryKey {
  const d = domain.toLowerCase();
  for (const rule of DOMAIN_CATEGORY_RULES) {
    if (rule.test.test(d)) return rule.cat;
  }
  if (/(shop|store)/.test(d)) return 'onlineshop';
  return 'other';
}

/**
 * Detecto Community – Übersicht + Inline-Modal zum Erstellen eines Beitrags
 * V1: Ein Post = eine Domain, Freitext + 3 Sterne-Kriterien
 * Kriterien: Seriösität, Transparenz, Kundenerfahrung (je 1–5)
 */

type Post = {
  id: string;
  domain: string;
  content: string;
  avg_rating: number;
  rating_seriositaet: number;
  rating_transparenz: number;
  rating_kundenerfahrung: number;
  category?: CategoryKey; // optional for backward-compat
  created_at: string;
};
function getPostCategory(p: { domain: string; category?: CategoryKey }): CategoryKey {
  return (p.category as CategoryKey) ?? categorizeDomain(p.domain);
}

function classNames(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(' ');
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

function Favicon({ domain }: { domain: string }) {
  const url = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-5 w-5 rounded-sm opacity-80"
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
      className={classNames('transition', filled ? 'opacity-100' : 'opacity-60')}
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
            className={classNames(
              'w-8 h-8 rounded-md border flex items-center justify-center',
              n <= value ? 'bg-amber-400/80 text-black' : 'hover:bg-amber-400/20'
            )}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  const v = Math.round(value || 0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} filled={i < v} />
      ))}
      <span className="ml-2 text-xs opacity-70">({value?.toFixed ? value.toFixed(2) : value})</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-sm bg-white/10" />
        <div className="h-4 w-32 rounded bg-white/10" />
      </div>
      <div className="mt-3 h-4 w-24 rounded bg-white/10" />
      <div className="mt-3 h-16 rounded bg-white/10" />
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl bg-white/5">
      <p className="text-lg font-medium">Noch keine Beiträge</p>
      <p className="opacity-70 mt-1">Sei der/die Erste und teile deine Erfahrung zu einer Website.</p>
      <button
        onClick={onOpen}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:opacity-90"
      >
        <span>＋</span> Neuen Beitrag erstellen
      </button>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 hover:from-white/[0.10] hover:to-white/[0.04] transition shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Favicon domain={post.domain} />
          <span className="font-medium px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
            {post.domain}
          </span>
        </div>
        <span className="text-xs opacity-60">
          {new Date(post.created_at).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
          })}
        </span>
      </div>

      <div className="mt-2">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]">
          {CATEGORY_LABELS[getPostCategory(post)] ?? CATEGORY_LABELS.other}
        </span>
      </div>

      <div className="mt-2">
        <StarRow value={Number(post.avg_rating ?? 0)} />
      </div>

      <p className="mt-3 text-sm opacity-90 line-clamp-4">{post.content}</p>
    </motion.div>
  );
}

function CreatePostModal({
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
        setLoading(false);
        return;
      }

      const category = categorizeDomain(domain);
      let insertError = null;
      try {
        const { error } = await supabase.from('community_posts').insert({
          user_id: user.id,
          domain,
          content: content.trim(),
          rating_seriositaet: serio,
          rating_transparenz: transp,
          rating_kundenerfahrung: kunde,
          category,
        });
        insertError = error;
      } catch (e: any) {
        insertError = e;
      }
      if (insertError && (insertError.code === '42703' || String(insertError.message || insertError).toLowerCase().includes('column') && String(insertError.message || insertError).toLowerCase().includes('category'))) {
        // Fallback: insert without category (temporary)
        const { error: e2 } = await supabase.from('community_posts').insert({
          user_id: user.id,
          domain,
          content: content.trim(),
          rating_seriositaet: serio,
          rating_transparenz: transp,
          rating_kundenerfahrung: kunde,
        });
        if (e2) throw e2;
      } else if (insertError) {
        throw insertError;
      }

      onCreated();
      onClose();
      // reset
      setDomainInput('');
      setContent('');
      setSerio(3); setTransp(3); setKunde(3);
    } catch (e: any) {
      setErr(e.message ?? 'Unbekannter Fehler beim Speichern.');
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
              className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.04] p-6 shadow-2xl"
            >
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
                  <input
                    type="text"
                    placeholder="z. B. https://www.shop.de/produkt"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 outline-none focus:border-white/30"
                  />
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
                    className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 outline-none focus:border-white/30"
                  />
                  <p className="text-xs opacity-60 mt-1">
                    {content.trim().length} / 20 Zeichen min.
                  </p>
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

export default function CommunityPage() {
  const supabase = createClientComponentClient();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [onlyDomain, setOnlyDomain] = useState('');

  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | ''>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'best'>('newest');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      let data: any = null;
      let error: any = null;
      try {
        const resp = await supabase
          .from('community_posts')
          .select('id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, category, created_at')
          .order('created_at', { ascending: false });
        data = resp.data;
        error = resp.error;
      } catch (e: any) {
        error = e;
      }
      if (error && (error.code === '42703' || String(error.message || error).toLowerCase().includes('column') && String(error.message || error).toLowerCase().includes('category'))) {
        const resp2 = await supabase
          .from('community_posts')
          .select('id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, created_at')
          .order('created_at', { ascending: false });
        data = resp2.data;
        // no need to set error here
        error = null;
      }
      if (error) {
        if (active) setError(error.message ?? 'Fehler beim Laden der Beiträge.');
      } else {
        if (active) setPosts(data as Post[]);
      }
      if (active) setLoading(false);
    }
    load();
    // Optional: Realtime (kann später ergänzt werden)
    return () => { active = false; };
  }, [supabase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const d = normalizeDomain(onlyDomain);
    let arr = (posts ?? []).filter((p) => {
      const matchesQuery =
        !q ||
        p.domain.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q);
      const matchesDomain = !d || p.domain === d;
      const matchesCategory = !selectedCategory || getPostCategory(p) === selectedCategory;
      return matchesQuery && matchesDomain && matchesCategory;
    });

    if (sortBy === 'newest') {
      arr = arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sortBy === 'oldest') {
      arr = arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else if (sortBy === 'best') {
      arr = arr.sort((a, b) => Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0));
    }
    return arr;
  }, [posts, query, onlyDomain, selectedCategory, sortBy]);

  const refresh = async () => {
    let data: any = null;
    let error: any = null;
    try {
      const resp = await supabase
        .from('community_posts')
        .select('id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, category, created_at')
        .order('created_at', { ascending: false });
      data = resp.data;
      error = resp.error;
    } catch (e: any) {
      error = e;
    }
    if (error && (error.code === '42703' || String(error.message || error).toLowerCase().includes('column') && String(error.message || error).toLowerCase().includes('category'))) {
      const resp2 = await supabase
        .from('community_posts')
        .select('id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, created_at')
        .order('created_at', { ascending: false });
      data = resp2.data;
      // no need to set error here
      error = null;
    }
    if (!error) setPosts(data as Post[]);
    // else noop
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.04] p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/20 blur-3xl opacity-20" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Community</h1>
            <p className="mt-1 opacity-80">
              Teile deine Erfahrungen zu Webseiten &amp; Services. Hilf anderen, Risiken besser einzuschätzen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Sortierung */}
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-70">Sortieren</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'best')}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-white/30"
              >
                <option value="newest">Neueste</option>
                <option value="best">Beste Bewertung</option>
                <option value="oldest">Älteste</option>
              </select>
            </div>

            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/20"
            >
              ＋ Beitrag erstellen
            </button>
          </div>
        </div>

        {/* Kategorie-Pills */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('' as any)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${!selectedCategory ? 'border-white/40 bg-white/15' : 'border-white/10 hover:bg-white/10'}`}
          >
            Alle
          </button>
          {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSelectedCategory(k)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${selectedCategory === k ? 'border-white/40 bg-white/15' : 'border-white/10 hover:bg-white/10'}`}
            >
              {CATEGORY_LABELS[k]}
            </button>
          ))}
        </div>

        {/* Text/Domain Filter */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="col-span-1">
            <label className="text-xs opacity-70">Suche (Domain oder Text)</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="z. B. shop.de oder „Abo abgezockt“"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-white/30"
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs opacity-70">Exakte Domain</label>
            <input
              type="text"
              value={onlyDomain}
              onChange={(e) => setOnlyDomain(e.target.value)}
              placeholder="example.com"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-white/30"
            />
            {onlyDomain && (
              <p className="mt-1 text-[11px] opacity-60">
                Gefiltert nach: <span className="font-medium">{normalizeDomain(onlyDomain)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState onOpen={() => setOpen(true)} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <AnimatePresence>
              {filtered.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Modal */}
      <CreatePostModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={refresh}
      />
    </div>
  );
}
