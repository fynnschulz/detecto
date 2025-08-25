import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

export async function GET() {
  const { data, error } = await supabase
    .from('posts')
    .select(
      'id,user_id,content,domain,avg_rating,rating_seriositaet,rating_transparenz,rating_kundenerfahrung,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posts = (data ?? []).map((p) => ({
    id: p.id,
    user_id: typeof p.user_id === 'string' ? p.user_id : '',
    domain: typeof p.domain === 'string' ? p.domain : '',
    avg_rating: typeof p.avg_rating === 'number' ? p.avg_rating : 0,
    rating_seriositaet: typeof p.rating_seriositaet === 'number' ? p.rating_seriositaet : 0,
    rating_transparenz: typeof p.rating_transparenz === 'number' ? p.rating_transparenz : 0,
    rating_kundenerfahrung: typeof p.rating_kundenerfahrung === 'number' ? p.rating_kundenerfahrung : 0,
    content: p.content,
    created_at: p.created_at,
  }));

  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  // existing POST handler logic remains unchanged
}