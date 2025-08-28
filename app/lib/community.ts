// Shared community helpers
import { supabase } from '@/app/lib/supabaseClient';

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

export function categorizeDomain(domain: string): CategoryKey {
  const d = (domain || '').toLowerCase();
  for (const rule of DOMAIN_CATEGORY_RULES) {
    if (rule.test.test(d)) return rule.cat;
  }
  if (/(shop|store)/.test(d)) return 'onlineshop';
  return 'other';
}

export function getPostCategory(p: { domain: string; category?: CategoryKey }): CategoryKey {
  return (p.category as CategoryKey) ?? categorizeDomain(p.domain);
}

export function normalizeDomain(input: string) {
  if (!input) return '';
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  const slash = s.indexOf('/');
  if (slash !== -1) s = s.slice(0, slash);
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/^www\./, '');
  return s;
}
/**
 * Type representing a community post.
 */
export type Post = {
  id: string;
  user_id: string;
  domain: string;
  content: string;
  rating_seriositaet: number;
  rating_transparenz: number;
  rating_kundenerfahrung: number;
  created_at: string;
};

/**
 * Internal helper to robustly fetch with timeout and retries.
 * Always sets cache: 'no-store'.
 * @param url The URL to fetch.
 * @param opts Fetch options, with optional timeoutMs and retries.
 * @returns The fetch Response.
 */
async function robustFetch(
  url: string,
  opts: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const {
    timeoutMs = 8000,
    retries = 2,
    ...fetchOpts
  } = opts;
  let attempt = 0;
  let lastError: any = null;
  for (; attempt <= retries; ++attempt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        ...fetchOpts,
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        lastError = new Error(`HTTP error: ${resp.status}`);
        // Only retry on network errors, not on HTTP error? Let's retry on all failures.
      } else {
        return resp;
      }
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timeout);
    }
    // Backoff before retrying, except after last attempt
    if (attempt < retries) {
      const backoffMs = 400 * (attempt + 1);
      await new Promise((res) => setTimeout(res, backoffMs));
    }
  }
  throw lastError ?? new Error('robustFetch failed');
}

/**
 * Fetches community posts from the API and returns validated Post objects.
 * Accepts both { posts: [...] } and [...] response shapes.
 * Skips invalid items, coerces fields, and defaults missing values.
 * @returns Promise<Post[]>
 */
export async function getCommunityPosts(): Promise<Post[]> {
  const resp = await robustFetch('/api/community/posts', { timeoutMs: 10000, retries: 3 });
  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    return [];
  }
  let arr: any[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as any).posts)) {
    arr = (data as any).posts;
  }
  const posts: Post[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof (item as any).id === 'string' ? (item as any).id : undefined;
    if (!id) continue;

    const user_id = typeof (item as any).user_id === 'string' ? (item as any).user_id : '';
    const domain = typeof (item as any).domain === 'string' ? (item as any).domain : '';
    const content = typeof (item as any).content === 'string' ? (item as any).content : '';

    posts.push({
      id,
      user_id,
      domain,
      content,
      rating_seriositaet: typeof (item as any).rating_seriositaet === 'number' ? (item as any).rating_seriositaet : 0,
      rating_transparenz: typeof (item as any).rating_transparenz === 'number' ? (item as any).rating_transparenz : 0,
      rating_kundenerfahrung: typeof (item as any).rating_kundenerfahrung === 'number' ? (item as any).rating_kundenerfahrung : 0,
      created_at: typeof (item as any).created_at === 'string' ? (item as any).created_at : '',
    });
  }
  return posts;
}

// --- Comments & Likes ---
export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name?: string;
};

export async function getComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('id, post_id, user_id, content, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    content: c.content,
    created_at: c.created_at,
    author_name: 'User',
  }));
}

export async function addComment(postId: string, content: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Nicht eingeloggt');
  const { error } = await supabase.from('community_comments').insert({
    post_id: postId, user_id: user.id, content
  });
  if (error) throw error;
}

export async function getLikesCount(postId: string): Promise<{ count: number; likedByMe: boolean }> {
  const user = (await supabase.auth.getUser()).data.user;

  const [allResp, mineResp] = await Promise.all([
    supabase
      .from('community_likes')
      .select('post_id', { count: 'exact', head: true })
      .eq('post_id', postId),
    user
      ? supabase
          .from('community_likes')
          .select('post_id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const total = (allResp as any)?.count ?? 0;
  const likedByMe = Boolean((mineResp as any)?.data);
  return { count: total, likedByMe };
}

export async function toggleLike(postId: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Nicht eingeloggt');

  const { data: existing, error: selErr } = await supabase
    .from('community_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (selErr && selErr.code !== 'PGRST116') throw selErr; // ignore "No rows" code

  if (existing) {
    const { error } = await supabase
      .from('community_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);
    if (error) throw error;
    return { liked: false };
  } else {
    const { error } = await supabase
      .from('community_likes')
      .insert({ post_id: postId, user_id: user.id });
    if (error) throw error;
    return { liked: true };
  }
}