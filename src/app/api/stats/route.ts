import { NextRequest } from 'next/server';
import { authenticateRequest, unauthorized } from '@/lib/auth/middleware';
import { db } from '@/lib/supabase/server';

/** GET /api/stats — dashboard stats for the current user */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const isSuperAdmin = auth.role === 'super_admin';

  // Get user workspaces
  const { data: memberships } = await db
    .from('workspace_members').select('workspace_id').eq('user_id', auth.userId);
  const wsIds = (memberships ?? []).map((m: any) => m.workspace_id);

  const [notesRes, tasksRes, eventsRes, wsRes] = await Promise.all([
    // Notes count
    isSuperAdmin
      ? db.from('notes').select('*', { count: 'exact', head: true }).is('deleted_at', null)
      : wsIds.length
        ? db.from('notes').select('*', { count: 'exact', head: true }).is('deleted_at', null).in('workspace_id', wsIds)
        : Promise.resolve({ count: 0 }),

    // Tasks (super_admin only)
    isSuperAdmin
      ? db.from('tasks').select('*', { count: 'exact', head: true }).is('deleted_at', null).neq('status', 'done')
      : Promise.resolve({ count: null }),

    // Events (super_admin only)
    isSuperAdmin
      ? db.from('calendar_events').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('start_time', new Date().toISOString())
      : Promise.resolve({ count: null }),

    // Workspaces
    isSuperAdmin
      ? db.from('workspaces').select('*', { count: 'exact', head: true }).is('deleted_at', null)
      : Promise.resolve({ count: wsIds.length }),
  ]);

  return Response.json({
    success: true,
    data: {
      notes:      notesRes.count  ?? 0,
      tasks:      tasksRes.count  ?? null,
      events:     eventsRes.count ?? null,
      workspaces: wsRes.count     ?? wsIds.length,
    },
  });
}
