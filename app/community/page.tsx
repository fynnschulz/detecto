'use client';
// redeploy: no-op
// no-op change for deploy

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';
import AuthModal from '@/app/components/AuthModal';
const TypedAuthModal = AuthModal as any;
import { useUsername } from '@/app/lib/useUsername';

import dynamic from 'next/dynamic';
const PostCard: React.ComponentType<any> = dynamic(() => import('@/app/components/community/PostCard').then(m => (m as any).default ?? (m as any).PostCard), { ssr: false });
import EmptyState from '@/app/components/community/EmptyState';
import CreatePostModal from '@/app/components/community/CreatePostModal';
import { useAuth } from "@/app/providers";
import { getCommunityPosts as fetchCommunityPosts, type Post as ApiPost } from '@/app/lib/community';

// --- Local category utilities (kept in sync with PostCard) ---

// Inline Topbar (no import)

type Audience = "personal" | "business";
type NavItem = { label: string; href: string; highlight?: boolean };

function Topbar({ navItems, audience, className }: { navItems: NavItem[]; audience: Audience; className?: string }) {
  const pathname = usePathname();
  if (audience !== "personal") return null;
  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 pt-[max(env(safe-area-inset-top),0px)] md:pt-4 bg-transparent backdrop-blur-0 border-0 ${className ?? ""}`}
    >
      <div
        className="px-3 py-2 overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-normal [-webkit-overflow-scrolling:touch] md:flex md:justify-center"
        style={{ msOverflowStyle: "none" as any }}
      >
        <div className="inline-flex md:flex items-center gap-2 min-w-max md:min-w-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center px-5 py-2 text-sm font-medium rounded-full transition-all duration-300 relative 
            ${
              isActive
                ? "bg-blue-500/80 text-white shadow-[0_0_10px_rgba(0,200,255,0.6)]"
                : "bg-zinc-800/60 text-gray-300 hover:bg-blue-700/30 hover:text-white"
            }
            ${ (item as any).highlight ? "ring-2 ring-pink-400/80 shadow-[0_0_15px_rgba(255,20,147,0.55)]" : ""}
          `}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={`relative z-10 ${(item as any).highlight ? "bg-gradient-to-r from-pink-300 via-fuchsia-200 to-white bg-clip-text text-transparent" : ""}`}>{item.label}</span>
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-blue-500 opacity-10 blur-md animate-pulse" />
                )}
                {(item as any).highlight && !isActive && (
                  <span className="pointer-events-none absolute inset-0 rounded-full bg-pink-400/10 blur-md" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

const NAV_ITEMS = [
  { label: "Website-Scan", href: "/WebsiteScan" },
  { label: "Suchmaschine", href: "/search" },
  { label: "Community", href: "/community" },
  { label: "Datencheck", href: "/leak-check" },
  { label: "Protecto", href: "/protecto", highlight: true },
  { label: "VPN", href: "/vpn" },
];
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

function getPostCategory(p: { domain: string; category?: CategoryKey }): CategoryKey {
  return (p.category as CategoryKey) ?? categorizeDomain(p.domain);
}

function normalizeDomain(input: string): string {
  let s = (input || '').trim().toLowerCase();
  if (!s) return '';
  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const u = new URL(s);
      s = u.hostname;
    }
  } catch {}
  s = s.replace(/^www\./, '');
  return s.replace(/\/$/, '');
}

// Local fallback type (ensure this matches your DB schema)
type Post = {
  id: string;
  user_id: string;
  domain: string;
  content: string;
  avg_rating: number | null;
  rating_seriositaet: number;
  rating_transparenz: number;
  rating_kundenerfahrung: number;
  category?: CategoryKey;
  created_at: string;
};


function SkeletonCard() {
  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-sm bg-white/10" />
        <div className="h-4 w-32 rounded bg-white/10" />
      </div>
      <div className="mt-3 h-4 w-24 rounded bg-white/10" />
      <div className="mt-3 h-16 rounded bg-white/10" />
    </div>
  );
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [onlyDomain, setOnlyDomain] = useState('');

  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | ''>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'best' | 'likes'>('newest');
  const [showAll, setShowAll] = useState(false);

  // Domain aus URL-Query übernehmen (z. B. /community?domain=amazon.de)
  const searchParams = useSearchParams();
  useEffect(() => {
    const d = searchParams.get('domain');
    if (d) {
      setOnlyDomain(normalizeDomain(d));
    }
  }, [searchParams]);

  // Current user id (for own post actions)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Floating profile (hero-like)
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const { isAuthReady, session } = useAuth();
  const usernameHook = useUsername();
  const isLoggedIn = !!sessionUser;
  const displayName =
    (sessionUser?.user_metadata as any)?.username ||
    usernameHook ||
    (sessionUser?.email ? sessionUser.email.split("@")[0] : "Gast");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      let loaded: ApiPost[] = [];
      try {
        loaded = await fetchCommunityPosts();
      } catch (e: any) {
        if (active) {
          setError(e?.message || 'Fehler beim Laden der Beiträge.');
          setPosts([]);
          setLoading(false);
        }
        return;
      }

      // Map API posts → local Post shape
      const mapped: Post[] = (loaded || []).map((p: any) => ({
        id: String(p.id),
        user_id: String(p.user_id || p.author_id || ''),
        domain: typeof p.domain === 'string' ? p.domain : '',
        content: typeof p.content === 'string' ? p.content : '',
        avg_rating: typeof p.avg_rating === 'number' ? p.avg_rating : 0,
        rating_seriositaet: typeof p.rating_seriositaet === 'number' ? p.rating_seriositaet : 0,
        rating_transparenz: typeof p.rating_transparenz === 'number' ? p.rating_transparenz : 0,
        rating_kundenerfahrung: typeof p.rating_kundenerfahrung === 'number' ? p.rating_kundenerfahrung : 0,
        category: (p as any).category as CategoryKey | undefined,
        created_at: typeof p.created_at === 'string' ? p.created_at : new Date().toISOString(),
      }));

      if (active) setPosts(mapped);

      // Best-effort: Autoren-Namen aus profiles laden
      try {
        const ids = Array.from(new Set(mapped.map(p => p.user_id))).filter(Boolean);
        if (ids.length) {
          const { data: profs, error: perr } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('id', ids);
          const map: Record<string, string> = {};
          if (!perr && profs) {
            for (const pr of profs as any[]) {
              map[pr.id] = pr.username || pr.display_name || '';
            }
          }
          for (const id of ids) if (!map[id]) map[id] = `user-${String(id).slice(0, 6)}`;
          if (active) setAuthorNames(map);
        }
      } catch {
        // ignore profile errors
      }

      // Like-Zähler für die sichtbaren Posts sammeln
      try {
        const likeIds = mapped.map(p => p.id);
        if (likeIds.length) {
          const { data: likesRows } = await supabase
            .from('community_likes')
            .select('post_id')
            .in('post_id', likeIds);
          const lmap: Record<string, number> = {};
          for (const r of (likesRows as any[]) || []) {
            lmap[r.post_id] = (lmap[r.post_id] || 0) + 1;
          }
          if (active) setLikeCounts(lmap);
        }
      } catch {}

      if (active) setLoading(false);
    }

    // Load current user id for own post actions
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });

    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Mirror provider auth state locally for UI logic
    setSessionUser(session?.user ?? null);

    if (!isAuthReady) return;

    const hideAuthModal = typeof window !== 'undefined' ? localStorage.getItem("hideAuthModal") : null;
    const skipOnce = typeof window !== 'undefined' ? localStorage.getItem("skipLoginModalOnce") : null;

    if (!session) {
      if (skipOnce) {
        setTimeout(() => {
          try { localStorage.removeItem("skipLoginModalOnce"); } catch {}
        }, 5000);
      } else if (!hideAuthModal) {
        setShowAuthModal(true);
      }
    } else {
      setShowAuthModal(false);
      try {
        localStorage.setItem("hideAuthModal", "true");
        localStorage.removeItem("skipLoginModalOnce");
      } catch {}
    }

    setAuthChecked(true);
  }, [isAuthReady, session]);

  function scoreOf(p: Post): number {
    const num = (v: any) => (typeof v === 'number' ? v : Number.parseFloat(String(v ?? '')));
    const vals = [num(p.avg_rating), num(p.rating_seriositaet), num(p.rating_transparenz), num(p.rating_kundenerfahrung)]
      .map(v => (Number.isFinite(v) ? v : 0))
      .filter(v => v > 0);
    if (vals.length === 0) return 0;
    // If avg_rating is present and > 0, prefer it; otherwise average the sub-ratings
    const ar = num(p.avg_rating);
    if (Number.isFinite(ar) && ar > 0) return ar;
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum / vals.length;
  }

  const filtered = useMemo(() => {
    const q = query.trim();
    const d = normalizeDomain(onlyDomain);
    // Hilfsfunktion: Regex sicher escapen
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Für exakte Wort- oder Phrasensuche (Wortgrenzen, case-insensitive)
    const queryRegex = q ? new RegExp(`\\b${escapeRegExp(q)}\\b`, 'i') : null;
    let arr = (posts ?? []).filter((p) => {
      // Suche nur im Content nach exaktem Wortlaut (case-insensitive, Wortgrenzen)
      const matchesQuery = !q || (queryRegex ? queryRegex.test(p.content) : true);
      const matchesDomain = !d || p.domain === d;
      const matchesCategory = !selectedCategory || getPostCategory(p) === selectedCategory;
      return matchesQuery && matchesDomain && matchesCategory;
    });

    if (sortBy === 'newest') {
      arr = [...arr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sortBy === 'oldest') {
      arr = [...arr].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    } else if (sortBy === 'best') {
      arr = [...arr].sort((a, b) => scoreOf(b) - scoreOf(a));
    } else if (sortBy === 'likes') {
      arr = [...arr].sort((a, b) => (likeCounts[b.id] || 0) - (likeCounts[a.id] || 0));
    }
    return arr;
  }, [posts, query, onlyDomain, selectedCategory, sortBy, likeCounts]);

  useEffect(() => {
    setShowAll(false);
  }, [selectedCategory, query, onlyDomain]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchCommunityPosts();
      const mapped: Post[] = (loaded || []).map((p: any) => ({
        id: String(p.id),
        user_id: String(p.user_id || p.author_id || ''),
        domain: typeof p.domain === 'string' ? p.domain : '',
        content: typeof p.content === 'string' ? p.content : '',
        avg_rating: typeof p.avg_rating === 'number' ? p.avg_rating : 0,
        rating_seriositaet: typeof p.rating_seriositaet === 'number' ? p.rating_seriositaet : 0,
        rating_transparenz: typeof p.rating_transparenz === 'number' ? p.rating_transparenz : 0,
        rating_kundenerfahrung: typeof p.rating_kundenerfahrung === 'number' ? p.rating_kundenerfahrung : 0,
        category: (p as any).category as CategoryKey | undefined,
        created_at: typeof p.created_at === 'string' ? p.created_at : new Date().toISOString(),
      }));
      setPosts(mapped);

      // refresh author names
      try {
        const ids = Array.from(new Set(mapped.map(p => p.user_id))).filter(Boolean);
        if (ids.length) {
          const { data: profs, error: perr } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('id', ids);
          const map: Record<string, string> = {};
          if (!perr && profs) {
            for (const pr of profs as any[]) {
              map[pr.id] = pr.username || pr.display_name || '';
            }
          }
          for (const id of ids) if (!map[id]) map[id] = `user-${String(id).slice(0, 6)}`;
          setAuthorNames(map);
        }
      } catch {}

      // Like-Zähler aktualisieren
      try {
        const likeIds = mapped.map(p => p.id);
        if (likeIds.length) {
          const { data: likesRows } = await supabase
            .from('community_likes')
            .select('post_id')
            .in('post_id', likeIds);
          const lmap: Record<string, number> = {};
          for (const r of (likesRows as any[]) || []) {
            lmap[r.post_id] = (lmap[r.post_id] || 0) + 1;
          }
          setLikeCounts(lmap);
        }
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Fehler beim Laden der Beiträge.');
    }
    setLoading(false);
  };

  // Handler for deleting a post (stub, implement as needed)
  const handleDelete = async (id: string) => {
    // Optionally: Add confirmation here
    await supabase.from('community_posts').delete().eq('id', id);
    refresh();
  };

  return (
    <div className="relative">
      <Topbar navItems={NAV_ITEMS} audience="personal" />
      {/* Background layers (hero-style) */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(59,130,246,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_10%_20%,rgba(2,132,199,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_90%_80%,rgba(37,99,235,0.10),transparent)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-10 pt-24 md:pt-28">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.05] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
          <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/20 blur-3xl opacity-20" />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/60 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
                Community
              </h1>
              <p className="mt-2 text-sm md:text-base opacity-80 max-w-2xl">
                Teile deine Erfahrungen zu Webseiten &amp; Services. Hilf anderen, Risiken besser einzuschätzen.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Sortierung */}
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-70">Sortieren</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'best' | 'likes')}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30 backdrop-blur"
                >
                  <option value="newest">Neueste</option>
                  <option value="best">Beste Bewertung</option>
                  <option value="likes">Like‑Anzahl</option>
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
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${!selectedCategory ? 'border-white/50 bg-white/20 shadow-inner' : 'border-white/10 hover:bg-white/10'}`}
            >
              Alle
            </button>
            {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSelectedCategory(k)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${selectedCategory === k ? 'border-white/50 bg-white/20 shadow-inner' : 'border-white/10 hover:bg-white/10'}`}
              >
                {CATEGORY_LABELS[k]}
              </button>
            ))}
          </div>

          {/* Text/Domain Filter */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="col-span-1">
              <label className="text-xs opacity-70">suche konkreten Wortlaut</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="z. B. shop.de oder „Abo abgezockt“"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30 backdrop-blur"
              />
            </div>
            <div className="col-span-1">
              <label className="text-xs opacity-70">Exakte Domain</label>
              <input
                type="text"
                value={onlyDomain}
                onChange={(e) => setOnlyDomain(e.target.value)}
                placeholder="example.com"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30 backdrop-blur"
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
            <div className="grid grid-cols-1 gap-5 place-items-center">
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
              className="grid grid-cols-1 gap-5 place-items-center"
            >
              <AnimatePresence>
                {(showAll ? filtered : filtered.slice(0, 6)).map((p) => {
                  const normalizedPost = {
                    ...p,
                    // Ensure avg_rating is a number for components that expect a number
                    avg_rating: p.avg_rating ?? 0,
                    // Ensure category is always present for components that expect it
                    category: (p as any).category ?? getPostCategory(p),
                  } as Post;

                  return (
                    <PostCard
                      key={p.id}
                      post={normalizedPost as any}
                      currentUserId={currentUserId}
                      onDelete={handleDelete}
                      authorName={authorNames[p.user_id] || `user-${p.user_id.slice(0,6)}`}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
          {(!loading && !error && filtered.length > 6 && !showAll) && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowAll(true)}
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 hover:bg-white/20 transition"
              >
                Mehr laden
              </button>
            </div>
          )}
        </div>

        {/* Modal */}
        <CreatePostModal
          open={open}
          onClose={() => setOpen(false)}
          onCreated={refresh}
        />
        {/* Floating Profile Button bottom-left */}
        <div className="fixed left-4 md:left-6 bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] z-50">
          <div className="relative">
            <button
              className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition
${isLoggedIn
  ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/30"
  : "bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:shadow-cyan-500/20"}
`}
              onClick={() => setShowProfileMenu((prev) => !prev)}
              aria-label="Profil"
            >
              👤
            </button>

            {showProfileMenu && (
              <div className="absolute left-0 bottom-14 w-80 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden divide-y divide-zinc-800">
                {/* Soft top glow */}
                <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[140%] h-24 bg-gradient-to-b from-cyan-400/10 via-cyan-300/5 to-transparent blur-2xl" />

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center ring-1 ring-white/10 shadow-inner">👤</div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">
                      {displayName}
                    </div>
                    <div className="text-gray-400 text-xs truncate">{sessionUser?.email || (authChecked ? "" : "Prüfe Status…")}</div>
                    {sessionUser?.id && (
                      <p className="text-sm text-gray-400 mt-1">
                        ID: {sessionUser.id}
                      </p>
                    )}
                  </div>
                </div>

                {/* Links */}
                <div className="py-1">
                  <Link href="/einstellungen" className="group flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-zinc-800/70 transition relative" onClick={() => setShowProfileMenu(false)}>
                    <span className="mr-3">⚙️</span>
                    <span>Einstellungen</span>
                    <span className="ml-auto opacity-40 group-hover:opacity-80 transition">›</span>
                    <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                  </Link>
                  <Link href="/hilfe" className="group flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-zinc-800/70 transition relative" onClick={() => setShowProfileMenu(false)}>
                    <span className="mr-3">❓</span>
                    <span>Hilfe & Ressourcen</span>
                    <span className="ml-auto opacity-40 group-hover:opacity-80 transition">›</span>
                    <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                  </Link>
                  <Link href="/news" className="group flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-zinc-800/70 transition relative" onClick={() => setShowProfileMenu(false)}>
                    <span className="mr-3">📰</span>
                    <span>Neuigkeiten</span>
                    <span className="ml-auto opacity-40 group-hover:opacity-80 transition">›</span>
                    <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                  </Link>
                  <Link href="/billing" className="group flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-zinc-800/70 transition relative" onClick={() => setShowProfileMenu(false)}>
                    <span className="mr-3">💳</span>
                    <span>Abos & Tarife</span>
                    <span className="ml-auto opacity-40 group-hover:opacity-80 transition">›</span>
                    <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                  </Link>
                  <Link href="/purchases" className="group flex items-center px-4 py-3 text-sm text-gray-200 hover:bg-zinc-800/70 transition relative" onClick={() => setShowProfileMenu(false)}>
                    <span className="mr-3">🧾</span>
                    <span>Bisherige Einkäufe</span>
                    <span className="ml-auto opacity-40 group-hover:opacity-80 transition">›</span>
                    <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                  </Link>
                </div>

                {/* Footer */}
                <div className="py-1">
                  {!isLoggedIn ? (
                    <div className="flex">
                      <button
                        className="group flex-1 text-left px-4 py-3 hover:bg-zinc-800/70 text-blue-400 transition relative"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent("auth:openModal"));
                          }
                          setShowProfileMenu(false);
                        }}
                      >
                        <span className="mr-2">🔐</span>
                        Einloggen
                        <span className="ml-2 opacity-40 group-hover:opacity-80 transition">›</span>
                        <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                      </button>
                      <Link
                        href="/register"
                        className="group flex-1 px-4 py-3 text-blue-400 hover:bg-zinc-800/70 transition text-center relative"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <span className="mr-2">✍️</span>
                        Registrieren
                        <span className="ml-2 opacity-40 group-hover:opacity-80 transition">›</span>
                        <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                      </Link>
                    </div>
                  ) : (
                    <button
                      className="group w-full text-left px-4 py-3 hover:bg-zinc-800/70 text-red-400 transition relative"
                      onClick={async () => {
                        setShowAuthModal(false);
                        setShowProfileMenu(false);
                        await supabase.auth.signOut();
                        try { localStorage.removeItem("hideAuthModal"); } catch {}
                      }}
                    >
                      <span className="mr-2">🚪</span>
                      Abmelden
                      <span className="ml-2 opacity-40 group-hover:opacity-80 transition">›</span>
                      <span className="pointer-events-none absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/5 transition"></span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Auth modal */}
        <TypedAuthModal show={showAuthModal} setShow={setShowAuthModal} />
      </div>
    </div>
  );
}
