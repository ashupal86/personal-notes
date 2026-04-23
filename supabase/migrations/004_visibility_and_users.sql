-- Migration to make workspace_id optional for personal tasks and events
ALTER TABLE tasks ALTER COLUMN workspace_id DROP NOT NULL;
ALTER TABLE calendar_events ALTER COLUMN workspace_id DROP NOT NULL;
