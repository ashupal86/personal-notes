import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole, hasMinRole } from '@/lib/auth/rbac';
import { db, getAdminClient } from '@/lib/supabase/server';

/** GET /api/users — admin+ */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { data, error } = await db
    .from('users')
    .select('id, email, display_name, role, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/** POST /api/users — admin+ */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const rlResult = checkRateLimit(`create-user:${auth.userId}`, 10, 60 * 1000);
  const rlResponse = rateLimitResponse(rlResult);
  if (rlResponse) return rlResponse;

  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const { email, password, display_name, role = 'user', workspace_id } = body;

  if (!hasMinRole(auth, role)) {
    return Response.json({ success: false, error: 'Cannot create a user with a higher role than your own.' }, { status: 403 });
  }

  if (!email || !password || !display_name) {
    return Response.json({ success: false, error: 'Email, password and display_name required.' }, { status: 400 });
  }

  // Use admin client to bypass RLS for user creation (auth context)
  const adminDb = getAdminClient();
  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error } = await adminDb
    .from('users')
    .insert({
      email: email.toLowerCase().trim(),
      display_name: display_name.trim(),
      password_hash,
      role
    })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

  // Add to workspace if provided
  if (workspace_id) {
    await adminDb.from('workspace_members').insert({
      workspace_id,
      user_id: user.id,
      role: 'member'
    });
  } else {
    // Add to default workspace (General)
    const { data: genWs } = await adminDb.from('workspaces').select('id').eq('slug', 'general').single();
    if (genWs) {
      await adminDb.from('workspace_members').insert({
        workspace_id: genWs.id,
        user_id: user.id,
        role: 'member'
      });
    }
  }

  return Response.json({ success: true, data: user }, { status: 201 });
}
