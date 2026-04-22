import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

/** GET /api/workspaces — filtered by access */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  let query = db.from('workspaces').select('*, workspace_members!inner(role)').is('deleted_at', null);

  // Super Admin: sees all
  if (auth.role === 'super_admin') {
    const { data, error } = await db.from('workspaces').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
    return Response.json({ success: true, data });
  }

  // Admin & User: see workspaces they are members of (this includes created ones as POST adds creator as owner)
  const { data, error } = await db
    .from('workspaces')
    .select('*, workspace_members!inner(user_id)')
    .eq('workspace_members.user_id', auth.userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** POST /api/workspaces — admin+ */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const { name, description, icon = '📁', color = '#005fad' } = body;

  if (!name?.trim()) return Response.json({ success: false, error: 'name required.' }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

  const { data, error } = await db.from('workspaces')
    .insert({ name: name.trim(), description, slug, icon, color, created_by: auth.userId })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

  // Add creator as owner
  await db.from('workspace_members').insert({ workspace_id: data.id, user_id: auth.userId, role: 'owner' });

  return Response.json({ success: true, data }, { status: 201 });
}
