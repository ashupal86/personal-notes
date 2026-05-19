import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/auth/middleware';

/**
 * POST /api/auth/setup
 *
 * First-run bootstrap. If users already exist, redirects to /login.
 * Anyone can POST this — it self-guards by checking if users table is empty.
 *
 * GET /api/auth/setup — health check: returns whether setup is needed.
 */
export async function GET() {
  const db = getAdminClient();
  const { count } = await db.from('users').select('*', { count: 'exact', head: true });
  return Response.json({ setup_required: (count ?? 0) === 0 });
}

export async function POST(req: NextRequest) {
  const db = getAdminClient();

  // Guard: if users already exist, setup is done
  const { count } = await db.from('users').select('*', { count: 'exact', head: true });
  if ((count ?? 0) > 0) {
    return Response.json(
      { success: false, error: 'Setup already completed. Please sign in.' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, display_name } = body as {
    email?: string; password?: string; display_name?: string;
  };

  if (!email || !password || !display_name) {
    return Response.json({ success: false, error: 'email, password and display_name are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  // 1. Create super_admin
  const { data: user, error: userErr } = await db
    .from('users')
    .insert({ email: email.toLowerCase().trim(), display_name, password_hash, role: 'super_admin' })
    .select().single();

  if (userErr || !user) {
    console.error('[setup] user insert error:', userErr);
    return Response.json({ success: false, error: userErr?.message ?? 'Failed to create user.' }, { status: 500 });
  }

  // 2. Auto-create General workspace
  const { data: workspace, error: wsErr } = await db
    .from('workspaces')
    .insert({ name: 'General', slug: 'general', icon: '🌐', color: '#005fad', created_by: user.id, is_default: true })
    .select().single();

  if (wsErr || !workspace) {
    console.error('[setup] workspace error:', wsErr);
    return Response.json({ success: false, error: wsErr?.message ?? 'Failed to create workspace.' }, { status: 500 });
  }

  // 3. Add super_admin as workspace owner
  await db.from('workspace_members').insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

  // 4. Generate API key & set cookie
  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await db.from('api_keys').insert({ user_id: user.id, key_hash: keyHash, key_prefix: keyPrefix, label: 'Default', permissions: ['read','write'] });

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
  headers.set('Set-Cookie', `qa_api_key=${rawKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000; ${secureFlag}`);

  return new Response(JSON.stringify({ success: true, message: 'Super admin created.' }), { status: 200, headers });
}
