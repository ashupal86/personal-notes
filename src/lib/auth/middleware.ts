import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { db } from '@/lib/supabase/server';
import type { AuthContext, UserRole } from '@/types';

/**
 * Generate a new API key
 * Returns: { rawKey, keyHash, keyPrefix }
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const rawKey = `qa_${randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 11); // "qa_" + 8 chars
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Authenticate a request using the API key from Authorization header.
 * Returns AuthContext or null if invalid.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');
  
  // Also check cookie for browser-based auth
  const cookieKey = req.cookies.get('qa_api_key')?.value;
  
  let rawKey: string | null = null;
  
  if (authHeader?.startsWith('Bearer ')) {
    rawKey = authHeader.substring(7);
  } else if (cookieKey) {
    rawKey = cookieKey;
  }
  
  if (!rawKey) return null;
  
  const keyHash = hashApiKey(rawKey);
  
  // Look up the API key and join with users
  const { data: keyRecord, error: keyError } = await db
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();
  
  if (keyError || !keyRecord) return null;
  
  // Check expiry
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return null;
  }
  
  // Get user
  const { data: user, error: userError } = await db
    .from('users')
    .select('*')
    .eq('id', keyRecord.user_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();
  
  if (userError || !user) return null;
  
  // Update last_used_at (fire-and-forget)
  db.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {});
  
  return {
    userId: user.id,
    role: user.role as UserRole,
    permissions: keyRecord.permissions || ['read', 'write'],
    scopedWorkspaces: keyRecord.scoped_workspaces,
    user,
  };
}

/**
 * Helper to create a JSON error response
 */
export function unauthorized(message = 'Unauthorized') {
  return Response.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function forbidden(message = 'Forbidden') {
  return Response.json(
    { success: false, error: message },
    { status: 403 }
  );
}
