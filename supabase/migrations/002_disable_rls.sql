-- ============================================================
-- Disable RLS on all application tables
--
-- Security is enforced at the Next.js API layer via API keys.
-- RLS is not needed because we never expose the Supabase URL
-- directly to untrusted clients — all DB access goes through
-- authenticated API routes.
-- ============================================================

ALTER TABLE users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys           DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces         DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members  DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes              DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events    DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         DISABLE ROW LEVEL SECURITY;
