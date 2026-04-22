import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth/middleware';
import { db } from '@/lib/supabase/server';

async function getNote(id: string, userId: string, role: string) {
  const { data } = await db.from('notes').select('*').eq('id', id).is('deleted_at', null).single();
  if (!data) return { note: null, denied: false };
  if (role === 'super_admin' || role === 'admin') return { note: data, denied: false };
  // user: must be in the workspace
  const { data: m } = await db.from('workspace_members').select('id').eq('workspace_id', data.workspace_id).eq('user_id', userId).single();
  return { note: data, denied: !m };
}

/** GET /api/notes/[id] */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const { id } = await params;
  const { note, denied } = await getNote(id, auth.userId, auth.role);
  if (!note) return Response.json({ success: false, error: 'Not found.' }, { status: 404 });
  if (denied) return forbidden();
  return Response.json({ success: true, data: note });
}

/** PATCH /api/notes/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const { id } = await params;
  const { note, denied } = await getNote(id, auth.userId, auth.role);
  if (!note) return Response.json({ success: false, error: 'Not found.' }, { status: 404 });
  if (denied) return forbidden();

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if ('title' in body)      updates.title      = body.title;
  if ('content_md' in body) updates.content_md = body.content_md;
  if ('is_pinned' in body)  updates.is_pinned  = body.is_pinned;
  if ('is_archived' in body) updates.is_archived = body.is_archived;

  const { data, error } = await db.from('notes').update(updates).eq('id', id).select().single();
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** DELETE /api/notes/[id] — soft delete */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const { id } = await params;
  const { note, denied } = await getNote(id, auth.userId, auth.role);
  if (!note) return Response.json({ success: false, error: 'Not found.' }, { status: 404 });
  if (denied) return forbidden();

  const { error } = await db.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
