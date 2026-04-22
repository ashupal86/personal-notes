import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { getAdminClient } from '@/lib/supabase/server';

/** PATCH /api/users/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const adminDb = getAdminClient();

  const updates: Record<string, unknown> = {};
  if ('display_name' in body) updates.display_name = body.display_name;
  if ('is_active' in body)    updates.is_active = body.is_active;
  if ('role' in body && auth.role === 'super_admin') updates.role = body.role;
  if ('password' in body) updates.password_hash = await bcrypt.hash(body.password, 12);

  const { data, error } = await adminDb.from('users').update(updates).eq('id', id).select('id, email, display_name, role, is_active').single();
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

  // Handle workspace assignment
  if ('workspace_id' in body) {
    await adminDb.from('workspace_members').delete().eq('user_id', id);
    if (body.workspace_id) {
      await adminDb.from('workspace_members').insert({ workspace_id: body.workspace_id, user_id: id, role: 'member' });
    }
  }

  return Response.json({ success: true, data });
}

/** DELETE /api/users/[id] — super_admin only */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const deny = requireMinRole(auth, 'super_admin');
  if (deny) return deny;

  const { id } = await params;
  const { error } = await getAdminClient().from('users').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
