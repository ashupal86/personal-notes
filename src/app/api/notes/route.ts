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
    if (workspaceId && workspaceId !== 'personal') {
      query = query.eq('workspace_id', workspaceId);
    } else if (workspaceId === 'personal') {
      query = query.is('workspace_id', null).eq('created_by', auth.userId);
    }
  } else {
    // regular user
    if (workspaceId === 'personal') {
      query = query.is('workspace_id', null).eq('created_by', auth.userId);
    } else {
      const { data: memberships } = await db
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', auth.userId);
      const ids = (memberships ?? []).map((m: any) => m.workspace_id);
      
      if (workspaceId) {
        if (!ids.includes(workspaceId)) return Response.json({ success: true, data: [] });
        query = query.eq('workspace_id', workspaceId);
      } else {
        if (ids.length === 0) {
          query = query.is('workspace_id', null).eq('created_by', auth.userId);
        } else {
          query = query.or(`workspace_id.in.(${ids.join(',')}),and(workspace_id.is.null,created_by.eq.${auth.userId})`);
        }
      }
    }
  }

  const { data, error } = await query;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/** POST /api/notes */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const rlResult = checkRateLimit(`create-note:${auth.userId}`, 20, 60 * 1000);
  const rlResponse = rateLimitResponse(rlResult);
  if (rlResponse) return rlResponse;

  const body = await req.json().catch(() => ({}));
  const { title = 'Untitled', content_md = '', workspace_id, is_pinned = false } = body;

  // If no workspace_id is provided, it's a personal note
  if (!workspace_id) {
    const { data, error } = await db
      .from('notes')
      .insert({ title, content_md, created_by: auth.userId, is_pinned })
      .select()
      .single();

    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
    return Response.json({ success: true, data }, { status: 201 });
  }

  // Verify user belongs to workspace (skip for super_admin)
  if (auth.role === 'user' && workspace_id) {
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
