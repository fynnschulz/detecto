

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/app/lib/supabaseClient';
import { useAuth } from '@/app/providers';

// --- Types & category helpers (extracted 1:1, preserving behavior) ---
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

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
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
  const d = (domain || '').toLowerCase();
  for (const rule of DOMAIN_CATEGORY_RULES) {
    if (rule.test.test(d)) return rule.cat;
  }
  if (/(shop|store)/.test(d)) return 'onlineshop';
  return 'other';
}

export type Post = {
  id: string;
  user_id: string;
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

// --- Tiny UI helpers (extracted) ---
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

// --- PostCard component ---
export default function PostCard({
  post,
  currentUserId,
  onDelete,
  authorName,
}: {
  post: Post;
  currentUserId: string | null;
  onDelete: (id: string) => void;
  authorName: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { session, isAuthReady } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState<number | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!isAuthReady) return;
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        if (!cancelled) setLikeCount(typeof count === 'number' ? count : null);
      } catch (e) {
        // Table evtl. noch nicht vorhanden – Feature leise deaktivieren
        if (!cancelled) setLikeCount(null);
      }

      try {
        if (session?.user?.id) {
          const { data: mine } = await supabase
            .from('post_likes')
            .select('user_id')
            .eq('post_id', post.id)
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (!cancelled) setLiked(!!mine);
        } else {
          if (!cancelled) setLiked(false);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, post.id, session?.user?.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.975 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.6 }}
      className="group/card w-full max-w-2xl mx-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.04] p-5 hover:from-white/[0.12] hover:to-white/[0.06] transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_60px_-30px_rgba(0,0,0,0.45)] backdrop-blur-sm relative overflow-hidden"
    >
      {/* decorative sheen (purely visual) */}
      <div aria-hidden className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-700">
        <div className="absolute -inset-x-10 -top-16 h-24 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl rotate-6" />
      </div>

      <div className="flex items-center justify-between gap-3 relative">
        <div className="flex items-center gap-3 min-w-0">
          <Favicon domain={post.domain} />
          <span className="font-medium px-2 py-0.5 rounded-md bg-white/20 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] truncate max-w-[45%]">
            {post.domain}
          </span>
          <span className="text-xs opacity-70 truncate">
            • von <span className="font-medium">{authorName || `user-${post.user_id.slice(0,6)}`}</span>
            &nbsp;(<code className="opacity-80">{post.user_id.slice(0, 8)}</code>)
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs opacity-80 px-2 py-0.5 rounded-md bg-white/15 border border-white/20 shadow-sm">
            {new Date(post.created_at).toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
            })}
          </span>

          {currentUserId && post.user_id === currentUserId && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                title="Mehr"
                className="rounded-md border border-white/10 hover:bg-white/10 px-2 py-1 text-sm"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                ⋮
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    className="absolute right-0 mt-2 w-36 rounded-xl border border-white/10 bg-white/10 backdrop-blur shadow-lg overflow-hidden z-10"
                    role="menu"
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(post.id);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                      role="menuitem"
                    >
                      Löschen
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] shadow-inner">
          {CATEGORY_LABELS[getPostCategory(post)] ?? CATEGORY_LABELS.other}
        </span>
      </div>

      <div className="mt-2">
        <StarRow value={Number(post.avg_rating ?? 0)} />
      </div>

  <p className="mt-3 text-sm opacity-90 line-clamp-4">{post.content}</p>

  {/* Actions: Like + Kommentare-Link */}
  <div className="mt-4 flex items-center gap-3">
    <button
      onClick={async () => {
        if (!session) return alert('Bitte einloggen, um zu liken.');
        try {
          // Toggle like
          const { data: mine } = await supabase
            .from('post_likes')
            .select('user_id')
            .eq('post_id', post.id)
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (mine) {
            await supabase
              .from('post_likes')
              .delete()
              .eq('post_id', post.id)
              .eq('user_id', session.user.id);
            setLiked(false);
            setLikeCount((c) => (typeof c === 'number' ? Math.max(0, c - 1) : c));
          } else {
            await supabase
              .from('post_likes')
              .insert({ post_id: post.id, user_id: session.user.id });
            setLiked(true);
            setLikeCount((c) => (typeof c === 'number' ? c + 1 : c));
          }
        } catch (e) {
          // leise scheitern, falls Tabelle noch fehlt
        }
      }}
      className={`rounded-md border px-3 py-1.5 text-sm transition ${liked ? 'border-transparent text-white bg-gradient-to-r from-indigo-600/70 to-fuchsia-600/70' : 'border-zinc-700 hover:bg-zinc-800'}`}
    >
      {liked ? '♥ Geliked' : '♡ Like'}{typeof likeCount === 'number' ? ` (${likeCount})` : ''}
    </button>

    <a href={`#comments-${post.id}`} className="text-sm opacity-80 hover:opacity-100">Kommentare</a>
  </div>

  {/* Inline-Kommentare */}
  <div id={`comments-${post.id}`} className="mt-4">
    <CommentsInline postId={post.id} />
  </div>
    </motion.div>
  );
}

function CommentsInline({ postId }: { postId: string }) {
  const { session, isAuthReady } = useAuth();
  const [items, setItems] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('comments')
        .select('id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      setItems(data ?? []);
    } catch (e) {
      // Tabelle evtl. noch nicht vorhanden → still bleiben
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthReady) return;
    load();
  }, [isAuthReady, postId]);

  async function submit() {
    if (!session) return alert('Bitte einloggen, um zu kommentieren.');
    const value = text.trim();
    if (!value) return;
    setPosting(true);
    try {
      await supabase.from('comments').insert({ post_id: postId, user_id: session.user.id, content: value });
      setText('');
      await load();
    } catch (e) {
      // still
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={session ? 'Schreib einen Kommentar…' : 'Bitte einloggen, um zu kommentieren'}
          className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none focus:border-indigo-400/60 min-h-[70px]"
          disabled={!session}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={submit}
            disabled={!session || posting || !text.trim()}
            className="ml-auto rounded-lg border border-white/10 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white px-4 py-1.5 disabled:opacity-60 hover:from-indigo-400 hover:via-violet-400 hover:to-fuchsia-400"
          >
            Kommentieren
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm opacity-70">Kommentare werden geladen…</div>
      ) : items.length === 0 ? (
        <div className="text-sm opacity-70">Keine Kommentare bisher.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="text-xs opacity-70 mb-1">
                {new Date(c.created_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm whitespace-pre-wrap">{c.content}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}