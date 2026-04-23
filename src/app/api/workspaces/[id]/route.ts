import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac'
import { db } from '@/lib/supabase/server';

/** PATCH /api/workspaces/[id] — admin+ (rename, update icon) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { name, icon, color, description } = body;

  const { data, error } = await db
    .from('workspaces')
    .update({ ...(name && { name }), ...(icon && { icon }), ...(color && { color }), ...(description !== undefined && { description }) })
    .eq('id', id)
    .select().single();

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

/** DELETE /api/workspaces/[id] — super_admin only */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'super_admin');
  if (deny) return deny;

  const { id } = await params;

  const { error } = await db
    .from('workspaces')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
