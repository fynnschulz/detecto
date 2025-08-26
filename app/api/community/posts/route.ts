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
      .select('id,user_id,content,domain,rating_seriositaet,rating_transparenz,rating_kundenerfahrung,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }

    // Return all relevant fields for each post
    const posts = Array.isArray(data)
      ? data.map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          content: typeof p.content === 'string' ? p.content : '',
          domain: typeof p.domain === 'string' ? p.domain : '',
          rating_seriositaet: typeof p.rating_seriositaet === 'number' ? p.rating_seriositaet : 0,
          rating_transparenz: typeof p.rating_transparenz === 'number' ? p.rating_transparenz : 0,
          rating_kundenerfahrung: typeof p.rating_kundenerfahrung === 'number' ? p.rating_kundenerfahrung : 0,
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
      user_id,
      content,
      domain,
      rating_seriositaet,
      rating_transparenz,
      rating_kundenerfahrung,
    } = body || {};

    // Validate: user_id must be present and a string
    if (typeof user_id !== 'string' || !user_id.trim()) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Validate: content must be present and a string
    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required and must be a string.' }, { status: 400 });
    }

    // Optional fields: if not provided or not the right type, set to null
    const post = {
      user_id,
      content,
      domain: typeof domain === 'string' ? domain : null,
      rating_seriositaet: typeof rating_seriositaet === 'number' ? Math.round(rating_seriositaet) : null,
      rating_transparenz: typeof rating_transparenz === 'number' ? Math.round(rating_transparenz) : null,
      rating_kundenerfahrung: typeof rating_kundenerfahrung === 'number' ? Math.round(rating_kundenerfahrung) : null,
    };

    const { data, error } = await supabase
      .from('community_posts')
      .insert([post])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, post: data }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error inserting community post:', err);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }
}