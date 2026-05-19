import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized, forbidden } from '@/lib/auth/middleware';
import { db, getAdminClient } from '@/lib/supabase/server';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

/** GET /api/notes/trash — list all soft-deleted notes (admin/super_admin only) */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  if (!ADMIN_ROLES.has(auth.role)) return forbidden();

  const { data, error } = await db
    .from('notes')
    .select('id, title, content_md, workspace_id, deleted_at, updated_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
  return Response.json({ success: true, data: data ?? [] });
}

/** POST /api/notes/trash — restore or purge a trashed note (admin/super_admin only) */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  if (!ADMIN_ROLES.has(auth.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const { action, id } = body as { action: 'restore' | 'purge'; id: string };

  if (!id || !action) {
    return Response.json({ success: false, error: 'action and id are required.' }, { status: 400 });
  }

  // Verify the note is in the trash
  const { data: note } = await db
    .from('notes')
    .select('id, created_by, content_md, title')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .single();

  if (!note) return Response.json({ success: false, error: 'Not found in trash.' }, { status: 404 });

  if (action === 'restore') {
    const { error } = await db.from('notes').update({ deleted_at: null }).eq('id', id);
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
    return Response.json({ success: true, message: 'Note restored.' });
  }

  if (action === 'purge') {
    const adminDb = getAdminClient();
    const { error } = await adminDb.from('notes').delete().eq('id', id);
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
    return Response.json({ success: true, message: 'Note permanently deleted.' });
  }

  return Response.json({ success: false, error: 'Invalid action.' }, { status: 400 });
}
