"use client";

import { useEffect, useMemo, useState } from "react";
import { addComment, fetchComments, CommentRow } from "@/app/lib/communityData";
import { useAuth } from "@/app/providers";

function buildTree(rows: CommentRow[]) {
  const map = new Map<string, CommentRow & { children: CommentRow[] }>();
  rows.forEach(r => map.set(r.id, { ...r, children: [] }));
  const roots: (CommentRow & { children: CommentRow[] })[] = [];
  rows.forEach(r => {
    const node = map.get(r.id)!;
    if (r.parent_id) {
      const parent = map.get(r.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export default function Comments({ postId }: { postId: string }) {
  const { isAuthReady, session } = useAuth();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchComments(postId);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthReady) return;
    load();
  }, [isAuthReady, postId]);

  const tree = useMemo(() => buildTree(rows), [rows]);

  async function handlePost() {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await addComment(postId, text.trim(), replyTo);
      setText("");
      setReplyTo(null);
      await load(); // refresh
    } finally {
      setPosting(false);
    }
  }

  const disabled = !session || posting;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#0b1220] p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={session ? (replyTo ? "Antworte..." : "Schreib einen Kommentar...") : "Bitte einloggen, um zu kommentieren"}
          className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 outline-none focus:border-indigo-400/60 min-h-[70px]"
          disabled={!session}
        />
        <div className="mt-2 flex items-center gap-2">
          {replyTo && (
            <button
              onClick={() => setReplyTo(null)}
              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 hover:bg-zinc-800"
            >
              Antwort abbrechen
            </button>
          )}
          <button
            onClick={handlePost}
            disabled={disabled || !text.trim()}
            className="ml-auto rounded-lg border border-white/10 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white px-4 py-1.5 disabled:opacity-60 hover:from-indigo-400 hover:via-violet-400 hover:to-fuchsia-400"
          >
            Kommentieren
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm opacity-70">Kommentare werden geladen…</div>
      ) : tree.length === 0 ? (
        <div className="text-sm opacity-70">Keine Kommentare bisher.</div>
      ) : (
        <div className="space-y-4">
          {tree.map((c) => (
            <CommentNode key={c.id} node={c} onReply={(id) => setReplyTo(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentNode({
  node,
  depth = 0,
  onReply,
}: {
  node: CommentRow & { children?: CommentRow[] };
  depth?: number;
  onReply: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="text-xs opacity-70 mb-1">
          {new Date(node.created_at).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-sm whitespace-pre-wrap">{node.content}</div>
        <div className="mt-2">
          <button
            onClick={() => onReply(node.id)}
            className="text-xs rounded-md border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
          >
            Antworten
          </button>
        </div>
      </div>
      {node.children && node.children.length > 0 && (
        <div className="pl-4 md:pl-6 border-l border-zinc-800 space-y-2">
          {node.children.map((child) => (
            <CommentNode key={child.id} node={child} depth={depth + 1} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}