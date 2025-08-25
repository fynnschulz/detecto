import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Dynamic flags for Next.js app router
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Initialize Supabase client with no session persistence
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('Supabase URL or Service Role Key not set in environment variables.');
}
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// GET handler: fetch and minimally validate community posts
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('id,content,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }

    // Minimal validation and coercion for each post
    const posts = Array.isArray(data)
      ? data.filter((p) =>
          typeof p?.id === 'string'
        ).map((p) => ({
          id: p.id,
          content: typeof p.content === 'string' ? p.content : '',
          created_at: p.created_at,
        }))
      : [];

    return NextResponse.json(posts);
  } catch (err) {
    console.error('Unexpected error fetching community posts:', err);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}

// POST handler: insert a new community post
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      content,
      domain,
      avg_rating,
      rating_seriositaet,
      rating_transparenz,
      rating_kundenerfahrung,
    } = body || {};

    // Validate: content must be present and a string
    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required and must be a string.' }, { status: 400 });
    }

    // Optional fields: if not provided or not the right type, set to null
    const post = {
      content,
      domain: typeof domain === 'string' ? domain : null,
      avg_rating: typeof avg_rating === 'number' ? avg_rating : null,
      rating_seriositaet: typeof rating_seriositaet === 'number' ? rating_seriositaet : null,
      rating_transparenz: typeof rating_transparenz === 'number' ? rating_transparenz : null,
      rating_kundenerfahrung: typeof rating_kundenerfahrung === 'number' ? rating_kundenerfahrung : null,
    };

    const { data, error } = await supabase
      .from('community_posts')
      .insert([post])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, post: Array.isArray(data) ? data[0] : data },
      { status: 201 }
    );
  } catch (err) {
    console.error('Unexpected error inserting community post:', err);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }
}