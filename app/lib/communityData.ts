"use client";
import { supabase } from "@/app/lib/supabaseClient";

export async function togglePostLike(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");

  const { data: existing } = await supabase
    .from("post_likes")
    .select("user_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    return { liked: false };
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    return { liked: true };
  }
}

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
};

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommentRow[];
}

export async function addComment(postId: string, content: string, parentId: string | null = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt");
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    parent_id: parentId,
    content,
  });
  if (error) throw error;
}