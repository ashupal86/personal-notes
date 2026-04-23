import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

/** GET /api/calendar — super_admin, admin, or regular users for their workspace */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  let q = db.from('calendar_events').select('*').is('deleted_at', null).order('start_time', { ascending: true });
  if (workspaceId) q = q.eq('workspace_id', workspaceId);

  // Personal events OR events bound to workspace
  if (auth.role !== 'super_admin' && auth.role !== 'admin') {
    q = q.or(`workspace_id.not.is.null,created_by.eq.${auth.userId}`);
  }

  const { data, error } = await q;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/** POST /api/calendar */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const rlResult = checkRateLimit(`create-cal:${auth.userId}`, 20, 60 * 1000);
  const rlResponse = rateLimitResponse(rlResult);
  if (rlResponse) return rlResponse;

  const body = await req.json().catch(() => ({}));
  const { title, description, event_type = 'other', start_time, end_time, all_day = false, workspace_id, color = '#005fad' } = body;

  if (!title || !start_time || !end_time) {
    return Response.json({ success: false, error: 'title, start_time, and end_time required.' }, { status: 400 });
  }

  const { data, error } = await db.from('calendar_events')
    .insert({ title, description, event_type, start_time, end_time, all_day, workspace_id: workspace_id || null, color, created_by: auth.userId })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data }, { status: 201 });
}
