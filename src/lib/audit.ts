import { db } from '@/lib/supabase/server';

/**
 * Log an audit event
 */
export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.from('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      workspace_id: params.workspaceId,
      metadata: params.metadata || {},
      ip_address: params.ipAddress,
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('Audit log error:', error);
  }
}

/**
 * Extract IP address from request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}
