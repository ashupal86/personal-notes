import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db, getAdminClient } from '@/lib/supabase/server';

/** GET /api/workspaces/[id]/members — admin+ */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { id: workspaceId } = await params;

  const { data, error } = await db
    .from('workspace_members')
    .select('id, role, user_id, users(id, email, display_name, role)')
    .eq('workspace_id', workspaceId);

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** POST /api/workspaces/[id]/members — admin+ */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { id: workspaceId } = await params;
  const body = await req.json().catch(() => ({}));
  const { userId, role = 'member' } = body;

  if (!userId) return Response.json({ success: false, error: 'userId required.' }, { status: 400 });

  const adminDb = getAdminClient();
  const { data, error } = await adminDb
    .from('workspace_members')
    .upsert({ workspace_id: workspaceId, user_id: userId, role }, { onConflict: 'workspace_id,user_id' })
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** DELETE /api/workspaces/[id]/members?userId=xxx — admin+ */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { id: workspaceId } = await params;
  const userId = new URL(req.url).searchParams.get('userId');

  if (!userId) return Response.json({ success: false, error: 'userId required.' }, { status: 400 });

  const adminDb = getAdminClient();
  const { error } = await adminDb
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
