'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { getComments, addComment, getLikesCount, toggleLike, type Comment } from '@/app/lib/community'
import { supabase } from '@/app/lib/supabaseClient'

export type CommunityPost = {
  id: string
  user_id: string
  domain: string
  content: string
  rating_seriositaet: number
  rating_transparenz: number
  rating_kundenerfahrung: number
  created_at: string
}

function avgRating(p: CommunityPost) {
  const vals = [p.rating_seriositaet, p.rating_transparenz, p.rating_kundenerfahrung]
    .map((n) => (typeof n === 'number' ? n : 0))
    .filter((n) => Number.isFinite(n))
  if (!vals.length) return 0
  const s = vals.reduce((a, b) => a + b, 0)
  return Math.round((s / vals.length) * 10) / 10
}

function Favicon({ domain }: { domain: string }) {
  const url = `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain || '')}`
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-5 w-5 rounded-sm opacity-90" loading="lazy" decoding="async" />
}

function normDomain(d: string) {
  const s = (d || '').trim().toLowerCase();
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return s.replace(/^www\./, ''); }
}

export default function PostCard({ post }: { post: CommunityPost }) {
  const a = avgRating(post)

  const [likes, setLikes] = useState(0)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [authorName, setAuthorName] = useState<string | null>(null)
  const [showDomainMenu, setShowDomainMenu] = useState(false)
  const domainMenuRef = useRef<HTMLDivElement | null>(null)

  async function refreshMeta() {
    const l = await getLikesCount(post.id)
    setLikes(l.count)
    setLiked(l.likedByMe)
    const c = await getComments(post.id)
    setComments(c)
  }

  useEffect(() => {
    refreshMeta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!showDomainMenu) return
      const el = domainMenuRef.current
      if (el && !el.contains(e.target as Node)) setShowDomainMenu(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showDomainMenu])

  useEffect(() => {
    let canceled = false
    async function loadAuthor() {
      if (!post?.user_id) return
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', post.user_id)
        .maybeSingle()
      if (!canceled) {
        if (error) {
          console.warn('Profilname konnte nicht geladen werden:', error)
          setAuthorName(null)
        } else {
          setAuthorName(data?.username || data?.display_name || null)
        }
      }
    }
    loadAuthor()
    return () => { canceled = true }
  }, [post?.user_id])

  async function handleToggleLike() {
    setBusy(true)
    try {
      const res = await toggleLike(post.id)
      setLiked(res.liked)
      const upd = await getLikesCount(post.id)
      setLikes(upd.count)
    } catch (err: any) {
      if (err.message?.includes('Nicht eingeloggt')) {
        alert('Bitte melde dich an, um Beiträge zu liken.')
      } else {
        console.error('Fehler beim Liken:', err)
        alert('Fehler beim Liken')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleAddComment() {
    const text = newComment.trim()
    if (!text) return
    setBusy(true)
    try {
      await addComment(post.id, text)
      setNewComment('')
      const c = await getComments(post.id)
      setComments(c)
    } catch (err: any) {
      if (err.message?.includes('Nicht eingeloggt')) {
        alert('Bitte melde dich an, um zu kommentieren.')
      } else {
        console.error('Fehler beim Kommentieren:', err)
        alert('Fehler beim Kommentieren')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="w-full max-w-3xl mx-auto rounded-2xl border border-white/10 p-4 bg-gradient-to-b from-neutral-800/70 via-neutral-800/50 to-neutral-900/70 backdrop-blur-md shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)] hover:shadow-[0_12px_36px_-12px_rgba(0,0,0,0.7)] transition">
      <header className="flex items-center gap-2 mb-3">
        <div className="relative" ref={domainMenuRef}>
          <button
            type="button"
            onClick={() => setShowDomainMenu(v => !v)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-[13px] leading-none text-white/90 border border-white/10 hover:bg-white/20"
            aria-haspopup="menu"
            aria-expanded={showDomainMenu}
            title="Aktionen zur Domain"
          >
            <Favicon domain={post.domain} />
            <span className="font-medium truncate">{normDomain(post.domain) || 'Unbekannte Domain'}</span>
            <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden className="opacity-70">
              <path d="M5 8l5 5 5-5" fill="currentColor"/>
            </svg>
          </button>

          {showDomainMenu && (
            <div
              role="menu"
              className="absolute z-20 mt-2 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur p-1 shadow-2xl"
            >
              <a
                href={`https://${normDomain(post.domain)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg px-3 py-2 text-sm hover:bg-white/10"
                role="menuitem"
                onClick={() => setShowDomainMenu(false)}
              >
                Zur Website
              </a>
              <Link
                href={`/WebsiteScan?domain=${encodeURIComponent(normDomain(post.domain))}`}
                className="block w-full rounded-lg px-3 py-2 text-sm hover:bg-white/10"
                role="menuitem"
                onClick={() => setShowDomainMenu(false)}
              >
                Zum Scan
              </Link>
            </div>
          )}
        </div>
        <div className="ml-auto text-xs px-2 py-1 rounded-md bg-white/5 text-white/70">
          {new Date(post.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </header>

      {/* Kategorie-Badge (falls vorhanden) */}
      {Boolean((post as any).category) && (
        <div className="mb-2">
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-white/10 text-white/80">{(post as any).category}</span>
        </div>
      )}

      {/* Sterne-Bewertung */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center" aria-label={`Bewertung ${a} von 5`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} viewBox="0 0 20 20" className={`h-4 w-4 ${i < Math.round(a) ? 'fill-yellow-400' : 'fill-transparent'} stroke-yellow-400`}>
              <path d="M10 2.5l2.472 4.91 5.418.787-3.92 3.823.925 5.395L10 14.9l-4.895 2.515.925-5.395L2.11 8.197l5.418-.787L10 2.5z"/>
            </svg>
          ))}
        </div>
        <span className="text-xs text-white/70">({a.toFixed(2)})</span>
      </div>

      <p className="text-base leading-relaxed whitespace-pre-wrap text-white/90">{post.content}</p>

      <footer className="mt-4 text-sm text-white/70">
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 rounded-md bg-white/5">Ø Bewertung: {a}</span>
          <span>•</span>
          <span>S: {post.rating_seriositaet ?? 0}</span>
          <span>T: {post.rating_transparenz ?? 0}</span>
          <span>K: {post.rating_kundenerfahrung ?? 0}</span>

          {/* Like-Button */}
          <button
            onClick={handleToggleLike}
            disabled={busy}
            className={`ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-md border transition ${liked ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            aria-pressed={liked}
            aria-label="Gefällt mir"
            title="Gefällt mir"
          >
            {/* Herz-Icon */}
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 21s-6.716-4.27-9.192-6.747C.91 12.355.91 8.99 3.05 6.85c2.14-2.14 5.505-2.14 7.646 0L12 8.154l1.304-1.304c2.14-2.14 5.506-2.14 7.646 0 2.14 2.14 2.14 5.505 0 7.646C18.716 16.73 12 21 12 21z"/>
            </svg>
            <span className="text-xs">{likes}</span>
          </button>

          {/* Comment-Button */}
          <button
            onClick={() => setShowComments((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition"
            aria-expanded={showComments}
            aria-controls={`comments-${post.id}`}
            title="Kommentare anzeigen"
          >
            {/* Sprechblasen-Icon */}
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M20 2H4a2 2 0 0 0-2 2v16l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
            </svg>
            <span className="text-xs">{comments.length}</span>
          </button>

          <span className="ml-auto px-2 py-1 rounded-md bg-white/5">
            User: {authorName ?? 'User'} · {post.user_id?.slice(0, 8) || '—'}
          </span>
        </div>

        {/* Kommentar-Sektion */}
        {showComments && (
          <div id={`comments-${post.id}`} className="mt-3 space-y-3">
            {/* Eingabezeile */}
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Kommentar schreiben…"
                className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 outline-none focus:border-white/30"
              />
              <button
                onClick={handleAddComment}
                disabled={busy || !newComment.trim()}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/20"
              >
                Senden
              </button>
            </div>
            {/* Liste */}
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs opacity-60 mb-1">{c.author_name ?? 'User'} · {new Date(c.created_at).toLocaleString()}</div>
                  <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                </div>
              ))}
              {!comments.length && (
                <div className="text-xs opacity-60">Noch keine Kommentare. Sei der Erste!</div>
              )}
            </div>
          </div>
        )}
      </footer>
    </article>
  )
}