-- Migration to make workspace_id optional for personal notes
ALTER TABLE notes ALTER COLUMN workspace_id DROP NOT NULL;
