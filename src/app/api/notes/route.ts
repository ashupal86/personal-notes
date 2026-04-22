import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { db } from '@/lib/supabase/server';

/** GET /api/notes — returns notes for the user's workspace(s) */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');

  let query = db
    .from('notes')
    .select('*')
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (auth.role === 'super_admin' || auth.role === 'admin') {
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
  } else {
    // regular user: only their workspaces
    const { data: memberships } = await db
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', auth.userId);
    const ids = (memberships ?? []).map((m: any) => m.workspace_id);
    if (ids.length === 0) return Response.json({ success: true, data: [] });
    query = query.in('workspace_id', workspaceId ? [workspaceId] : ids);
  }

  const { data, error } = await query;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** POST /api/notes */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { title = 'Untitled', content_md = '', workspace_id, is_pinned = false } = body;

  if (!workspace_id) return Response.json({ success: false, error: 'workspace_id required.' }, { status: 400 });

  // Verify user belongs to workspace (skip for super_admin)
  if (auth.role === 'user') {
    const { data: member } = await db
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', auth.userId)
      .single();
    if (!member) return Response.json({ success: false, error: 'Access denied to workspace.' }, { status: 403 });
  }

  const { data, error } = await db
    .from('notes')
    .insert({ title, content_md, workspace_id, created_by: auth.userId, is_pinned })
    .select()
    .single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data }, { status: 201 });
}
