import { db } from '@/lib/supabase/server';
import type { AuthContext } from '@/types';
import { forbidden } from './middleware';

/**
 * Verify that the current user has access to a specific workspace.
 * Super admins bypass this check.
 * Returns null if allowed, or a 403 Response if denied.
 */
export async function requireWorkspaceAccess(
  auth: AuthContext,
  workspaceId: string
): Promise<Response | null> {
  // Super admins can access any workspace
  if (auth.role === 'super_admin') return null;

  // Check if API key is scoped and workspace is in scope
  if (auth.scopedWorkspaces && auth.scopedWorkspaces.length > 0) {
    if (!auth.scopedWorkspaces.includes(workspaceId)) {
      return forbidden('API key does not have access to this workspace');
    }
  }

  // Check workspace membership
  const { data: member } = await db
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', auth.userId)
    .single();

  if (!member) {
    return forbidden('You do not have access to this workspace');
  }

  return null;
}

/**
 * Get all workspace IDs accessible to the current user.
 */
export async function getAccessibleWorkspaces(auth: AuthContext): Promise<string[]> {
  // Super admins can access all workspaces
  if (auth.role === 'super_admin') {
    const { data } = await db
      .from('workspaces')
      .select('id')
      .is('deleted_at', null);
    return (data || []).map(w => w.id);
  }

  // Check API key scope first
  if (auth.scopedWorkspaces && auth.scopedWorkspaces.length > 0) {
    return auth.scopedWorkspaces;
  }

  // Get workspaces from membership
  const { data } = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', auth.userId);

  return (data || []).map(m => m.workspace_id);
}

/**
 * Verify entity ownership — the entity must belong to the current user.
 */
export function requireOwnership(
  auth: AuthContext,
  entityCreatedBy: string
): Response | null {
  if (auth.role === 'super_admin') return null;
  if (auth.userId !== entityCreatedBy) {
    return forbidden('You can only modify your own resources');
  }
  return null;
}
