import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-access-token')?.value
      ?? req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user from token
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only images allowed' }, { status: 415 });

    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('note-images')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      // Bucket might not exist — create it and retry
      await supabase.storage.createBucket('note-images', { public: false, allowedMimeTypes: ['image/*'] });
      const { error: e2 } = await supabase.storage.from('note-images').upload(path, file, { contentType: file.type });
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    // Generate a signed URL valid for 1 year (user-private)
    const { data: signed } = await supabase.storage
      .from('note-images')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    return NextResponse.json({ url: signed?.signedUrl ?? '', path });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
