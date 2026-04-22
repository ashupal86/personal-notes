import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/supabase/server';

/** GET /api/me — returns current user with workspaces */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Get user workspaces
  const { data: memberships } = await db
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, slug, icon, color)')
    .eq('user_id', auth.userId);

  const workspaces = (memberships ?? [])
    .map((m: any) => m.workspaces)
    .filter(Boolean);

  return Response.json({
    success: true,
    data: {
      id: auth.user.id,
      email: auth.user.email,
      display_name: auth.user.display_name,
      role: auth.user.role,
      avatar_url: auth.user.avatar_url,
      workspaces,
    },
  });
}
