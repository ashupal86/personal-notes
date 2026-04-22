import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

/** GET /api/calendar — super_admin only */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'super_admin');
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  let q = db.from('calendar_events').select('*').is('deleted_at', null).order('start_time', { ascending: true });
  if (workspaceId) q = q.eq('workspace_id', workspaceId);

  const { data, error } = await q;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** POST /api/calendar — super_admin only */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'super_admin');
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const { title, description, event_type = 'other', start_time, end_time, all_day = false, workspace_id, color = '#005fad' } = body;

  if (!title || !start_time || !end_time || !workspace_id) {
    return Response.json({ success: false, error: 'title, start_time, end_time, workspace_id required.' }, { status: 400 });
  }

  const { data, error } = await db.from('calendar_events')
    .insert({ title, description, event_type, start_time, end_time, all_day, workspace_id, color, created_by: auth.userId })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data }, { status: 201 });
}
