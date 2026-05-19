import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

import { forbidden } from '@/lib/auth/middleware';

async function checkAccess(id: string, auth: any) {
  const { data } = await db.from('calendar_events').select('workspace_id, created_by').eq('id', id).single();
  if (!data) return { allowed: false, error: 'Not found', status: 404 };
  if (auth.role === 'super_admin' || auth.role === 'admin') return { allowed: true };
  if (data.created_by === auth.userId) return { allowed: true };
  
  const { data: member } = await db.from('workspace_members').select('id').eq('workspace_id', data.workspace_id).eq('user_id', auth.userId).single();
  if (!member) return { allowed: false, error: 'Forbidden', status: 403 };
  return { allowed: true };
}

/** PATCH /api/calendar/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const { id } = await params;
  
  const access = await checkAccess(id, auth);
  if (!access.allowed) return Response.json({ success: false, error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const allowed = ['title', 'description', 'event_type', 'start_time', 'end_time', 'all_day', 'color'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) updates[k] = body[k]; }

  const { data, error } = await db.from('calendar_events').update(updates).eq('id', id).select().single();
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** DELETE /api/calendar/[id] */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const { id } = await params;
  
  const access = await checkAccess(id, auth);
  if (!access.allowed) return Response.json({ success: false, error: access.error }, { status: access.status });

  const { error } = await db.from('calendar_events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
