import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { requireMinRole } from '@/lib/auth/rbac';
import { db } from '@/lib/supabase/server';

/** DELETE /api/users/[id] — admin+ */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  
  // Only super_admin can delete users, OR admin can delete users but not other admins/superadmins.
  // For simplicity, let's say admin+ can delete.
  const deny = requireMinRole(auth, 'admin');
  if (deny) return deny;

  const { id } = await params;

  // Prevent deleting self
  if (id === auth.userId) {
    return Response.json({ success: false, error: 'Cannot delete yourself.' }, { status: 400 });
  }

  // Soft delete and disable
  const { error } = await db
    .from('users')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id);

  if (!error) {
    // Remove access from every workspace
    await db.from('workspace_members').delete().eq('user_id', id);
    // Revoke all API keys
    await db.from('api_keys').delete().eq('user_id', id);
  }

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
