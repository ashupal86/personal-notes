import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/auth/middleware';

/** POST /api/auth/login */
export async function POST(req: NextRequest) {
  const db = getAdminClient();
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return Response.json({ success: false, error: 'Email and password required.' }, { status: 400 });
  }

  // Find user
  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (!user) {
    return Response.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return Response.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
  }

  // Get or create API key
  const { data: existingKey } = await db
    .from('api_keys')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('expires_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let rawKey: string;

  if (existingKey) {
    // We can't recover the raw key — generate a fresh one
    const gen = generateApiKey();
    rawKey = gen.rawKey;
    await db.from('api_keys').insert({
      user_id: user.id, key_hash: gen.keyHash, key_prefix: gen.keyPrefix,
      label: 'Session', permissions: ['read', 'write'],
    });
  } else {
    const gen = generateApiKey();
    rawKey = gen.rawKey;
    await db.from('api_keys').insert({
      user_id: user.id, key_hash: gen.keyHash, key_prefix: gen.keyPrefix,
      label: 'Default', permissions: ['read', 'write'],
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Set-Cookie', `qa_api_key=${rawKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);

  return new Response(
    JSON.stringify({ success: true, data: { role: user.role, display_name: user.display_name } }),
    { status: 200, headers },
  );
}
