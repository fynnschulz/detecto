'use client'

import React from 'react'

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

export default function PostCard({ post }: { post: CommunityPost }) {
  const a = avgRating(post)
  return (
    <article className="w-full max-w-3xl mx-auto rounded-2xl border border-white/10 p-4 bg-gradient-to-b from-neutral-800/70 via-neutral-800/50 to-neutral-900/70 backdrop-blur-md shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)] hover:shadow-[0_12px_36px_-12px_rgba(0,0,0,0.7)] transition">
      <header className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-[13px] leading-none text-white/90">
          <Favicon domain={post.domain} />
          <span className="font-medium truncate">{post.domain || 'Unbekannte Domain'}</span>
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

      <footer className="mt-4 flex items-center gap-3 text-sm text-white/70">
        <span className="px-2 py-1 rounded-md bg-white/5">Ø Bewertung: {a}</span>
        <span>•</span>
        <span>S: {post.rating_seriositaet ?? 0}</span>
        <span>T: {post.rating_transparenz ?? 0}</span>
        <span>K: {post.rating_kundenerfahrung ?? 0}</span>
        <span className="ml-auto px-2 py-1 rounded-md bg-white/5">User: {post.user_id?.slice(0, 8) || '—'}</span>
      </footer>
    </article>
  )
}