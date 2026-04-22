// ============================================
// Enums
// ============================================
export type UserRole = 'super_admin' | 'admin' | 'user';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EventType = 'meeting' | 'deadline' | 'reminder' | 'other';
export type WorkspaceMemberRole = 'owner' | 'editor' | 'viewer' | 'member';

// ============================================
// Database Models
// ============================================
export interface User {
  id: string;
  email: string;
  display_name: string;
  password_hash?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  label: string;
  permissions: string[];
  scoped_workspaces?: string[];
  expires_at?: string;
  last_used_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  slug: string;
  icon: string;
  color: string;
  created_by: string;
  is_default: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  joined_at: string;
}

export interface Note {
  id: string;
  title: string;
  content_md: string;
  content_json?: Record<string, unknown>;
  workspace_id: string;
  created_by: string;
  is_pinned: boolean;
  is_archived: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  workspace_id: string;
  assigned_to?: string;
  created_by: string;
  completed_at?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  all_day: boolean;
  workspace_id: string;
  created_by: string;
  color: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  workspace_id?: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ============================================
// Auth Context
// ============================================
export interface AuthContext {
  userId: string;
  role: UserRole;
  permissions: string[];
  scopedWorkspaces?: string[];
  user: User;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginResponse {
  user: Omit<User, 'password_hash'>;
  api_key: string;
  key_id: string;
}
