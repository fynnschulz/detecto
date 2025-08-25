'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import AuthModal from '@/app/components/AuthModal';
const TypedAuthModal = AuthModal as any;
import { useUsername } from '@/app/lib/useUsername';

import PostCard from '@/app/components/community/PostCard';
import EmptyState from '@/app/components/community/EmptyState';
import CreatePostModal from '@/app/components/community/CreatePostModal';
import { CATEGORY_LABELS, getPostCategory, normalizeDomain, type CategoryKey } from '@/app/lib/community';
import { useAuth } from "@/app/providers";

// Local fallback type (ensure this matches your DB schema)
export type Post = {
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
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'best'>('newest');

  // Current user id (for own post actions)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

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
    if (!isAuthReady) return;
    async function load() {
      setLoading(true);
      setError(null);
      let data: any = null;
      let errObj: any = null;
      try {
        // Primary select with explicit columns
        const resp = await supabase
          .from('community_posts')
          .select('id, user_id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, category, created_at')
          .order('created_at', { ascending: false });
        data = resp.data;
        errObj = resp.error;

        // Fallback if category column is missing
        if (errObj && (errObj.code === '42703' || String(errObj.message || errObj).toLowerCase().includes('column') && String(errObj.message || errObj).toLowerCase().includes('category'))) {
          const resp2 = await supabase
            .from('community_posts')
            .select('id, user_id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, created_at')
            .order('created_at', { ascending: false });
          data = resp2.data;
          errObj = resp2.error;
        }

        // Ultimate fallback: select * (in case of unexpected column schema)
        if (errObj) {
          const resp3 = await supabase
            .from('community_posts')
            .select('*')
            .order('created_at', { ascending: false });
          if (!resp3.error) {
            data = resp3.data;
            errObj = null;
          }
        }

        if (errObj) {
          if (active) setError(errObj.message ?? 'Fehler beim Laden der Beiträge.');
          if (active) setPosts([]);
          return;
        }

        const loaded = (data as Post[]) || [];
        if (active) setPosts(loaded);

        // Load author names (best-effort)
        try {
          const ids = Array.from(new Set(loaded.map(p => p.user_id))).filter(Boolean);
          if (ids.length) {
            const { data: profs, error: perr } = await supabase
              .from('profiles')
              .select('id, username, display_name, name')
              .in('id', ids);
            const map: Record<string, string> = {};
            if (!perr && profs) {
              for (const pr of profs as any[]) {
                map[pr.id] = pr.display_name || pr.username || pr.name || '';
              }
            }
            for (const id of ids) if (!map[id]) map[id] = `user-${id.slice(0, 6)}`;
            if (active) setAuthorNames(map);
          }
        } catch {
          // ignore profile errors
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Unbekannter Fehler beim Laden.');
        if (active) setPosts([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    // Load current user id for own post actions
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
    load();
    // Optional: Realtime (kann später ergänzt werden)
    return () => { active = false; };
  }, [isAuthReady]);

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
    setLoading(true);
    let data: any = null;
    let error: any = null;
    try {
      const resp = await supabase
        .from('community_posts')
        .select('id, user_id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, category, created_at')
        .order('created_at', { ascending: false });
      data = resp.data;
      error = resp.error;
    } catch (e: any) {
      error = e;
    }
    if (error && (error.code === '42703' || String(error.message || error).toLowerCase().includes('column') && String(error.message || error).toLowerCase().includes('category'))) {
      const resp2 = await supabase
        .from('community_posts')
        .select('id, user_id, domain, content, avg_rating, rating_seriositaet, rating_transparenz, rating_kundenerfahrung, created_at')
        .order('created_at', { ascending: false });
      data = resp2.data;
      // no need to set error here
      error = null;
    }
    // Ultimate fallback: select * (in case of unexpected column schema)
    if (error) {
      const resp3 = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!resp3.error) {
        data = resp3.data;
        error = null;
      }
    }
    if (!error) {
      setError(null);
      const loaded = (data as Post[]) || [];
      setPosts(loaded);
      try {
        const ids = Array.from(new Set(loaded.map(p => p.user_id))).filter(Boolean);
        if (ids.length) {
          const { data: profs, error: perr } = await supabase
            .from('profiles')
            .select('id, username, display_name, name')
            .in('id', ids);
          const map: Record<string, string> = {};
          if (!perr && profs) {
            for (const pr of profs as any[]) {
              map[pr.id] = pr.display_name || pr.username || pr.name || '';
            }
          }
          for (const id of ids) if (!map[id]) map[id] = `user-${id.slice(0, 6)}`;
          setAuthorNames(map);
        }
      } catch {
        // ignore
      }
    }
    // else noop
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
      {/* Background layers (hero-style) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(99,102,241,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_10%_20%,rgba(16,185,129,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_90%_80%,rgba(236,72,153,0.10),transparent)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.05] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
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
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30 backdrop-blur"
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
              <label className="text-xs opacity-70">Suche (Domain oder Text)</label>
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
                {filtered.map((p) => {
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
