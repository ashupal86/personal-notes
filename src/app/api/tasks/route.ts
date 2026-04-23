import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

/** GET /api/tasks — super_admin, admin, or regular users for their workspace */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const status      = searchParams.get('status');

  let q = db.from('tasks').select('*, assigned_to_user:users!tasks_assigned_to_fkey(display_name, email)').is('deleted_at', null).order('created_at', { ascending: false });
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  if (status)      q = q.eq('status', status);

  // Personal tasks OR tasks bound to workspace
  if (auth.role !== 'super_admin' && auth.role !== 'admin') {
    q = q.or(`workspace_id.not.is.null,created_by.eq.${auth.userId},assigned_to.eq.${auth.userId}`);
  }

  const { data, error } = await q;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/** POST /api/tasks */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const rlResult = checkRateLimit(`create-task:${auth.userId}`, 30, 60 * 1000);
  const rlResponse = rateLimitResponse(rlResult);
  if (rlResponse) return rlResponse;

  const body = await req.json().catch(() => ({}));
  const { title, description, status = 'todo', priority = 'medium', due_date, workspace_id, assigned_to } = body;

  if (!title) {
    return Response.json({ success: false, error: 'title is required.' }, { status: 400 });
  }

  const { data, error } = await db.from('tasks')
    .insert({ title, description, status, priority, due_date, workspace_id: workspace_id || null, assigned_to, created_by: auth.userId })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data }, { status: 201 });
}
