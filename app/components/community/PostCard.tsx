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
    <article className="rounded-xl border p-4 hover:shadow-sm transition bg-white/60 dark:bg-neutral-900/60">
      <header className="flex items-center gap-2 mb-2">
        <Favicon domain={post.domain} />
        <div className="text-sm font-medium truncate">{post.domain || 'Unbekannte Domain'}</div>
        <div className="ml-auto text-xs opacity-60">
          {new Date(post.created_at).toLocaleString()}
        </div>
      </header>

      <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

      <footer className="mt-3 flex items-center gap-3 text-xs opacity-80">
        <span>Ø Bewertung: {a}</span>
        <span>•</span>
        <span>S: {post.rating_seriositaet ?? 0}</span>
        <span>T: {post.rating_transparenz ?? 0}</span>
        <span>K: {post.rating_kundenerfahrung ?? 0}</span>
        <span className="ml-auto">User: {post.user_id?.slice(0, 8) || '—'}</span>
      </footer>
    </article>
  )
}