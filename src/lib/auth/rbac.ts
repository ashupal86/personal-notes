import type { AuthContext, UserRole } from '@/types';
import { forbidden } from './middleware';

/**
 * Role hierarchy: super_admin > admin > user
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 3,
  admin: 2,
  user: 1,
};

/**
 * Check if the auth context has sufficient role level
 */
export function hasRole(auth: AuthContext, ...requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(auth.role);
}

/**
 * Check if auth context has at least the minimum role level
 */
export function hasMinRole(auth: AuthContext, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[auth.role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Enforce that the user has one of the required roles.
 * Returns a Response (403) if insufficient, or null if allowed.
 */
export function requireRole(auth: AuthContext, ...roles: UserRole[]): Response | null {
  if (!hasRole(auth, ...roles) && !hasMinRole(auth, roles[0])) {
    return forbidden(
      `Insufficient permissions. Required role: ${roles.join(' or ')}. Your role: ${auth.role}`
    );
  }
  return null;
}

/**
 * Enforce minimum role level.
 * Returns a Response (403) if insufficient, or null if allowed.
 */
export function requireMinRole(auth: AuthContext, minRole: UserRole): Response | null {
  if (!hasMinRole(auth, minRole)) {
    return forbidden(
      `Insufficient permissions. Minimum role required: ${minRole}. Your role: ${auth.role}`
    );
  }
  return null;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(auth: AuthContext, permission: string): boolean {
  return auth.permissions.includes(permission);
}

/**
 * Enforce a specific permission.
 */
export function requirePermission(auth: AuthContext, permission: string): Response | null {
  if (!hasPermission(auth, permission)) {
    return forbidden(`Missing required permission: ${permission}`);
  }
  return null;
}
