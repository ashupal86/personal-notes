import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

/** GET /api/tasks — super_admin only */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'super_admin');
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const status      = searchParams.get('status');

  let q = db.from('tasks').select('*, assigned_to_user:users!tasks_assigned_to_fkey(display_name, email)').is('deleted_at', null).order('created_at', { ascending: false });
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  if (status)      q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** POST /api/tasks — super_admin only */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'super_admin');
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const { title, description, status = 'todo', priority = 'medium', due_date, workspace_id, assigned_to } = body;

  if (!title || !workspace_id) {
    return Response.json({ success: false, error: 'title and workspace_id required.' }, { status: 400 });
  }

  const { data, error } = await db.from('tasks')
    .insert({ title, description, status, priority, due_date, workspace_id, assigned_to, created_by: auth.userId })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data }, { status: 201 });
}
