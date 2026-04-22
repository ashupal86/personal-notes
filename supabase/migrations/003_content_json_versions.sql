-- Add content_json column to notes for Tiptap JSON storage
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content_json JSONB DEFAULT NULL;

-- Add note_versions table for version history (#7)
CREATE TABLE IF NOT EXISTS note_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  content_md     TEXT DEFAULT '',
  content_json   JSONB,
  version_number INTEGER NOT NULL,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_num  ON note_versions(note_id, version_number);
ALTER TABLE note_versions DISABLE ROW LEVEL SECURITY;

-- Auto-snapshot on notes update (keeps last 50 versions per note)
CREATE OR REPLACE FUNCTION snapshot_note_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only snapshot when content changes
  IF OLD.content_md IS DISTINCT FROM NEW.content_md OR OLD.title IS DISTINCT FROM NEW.title THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO next_version
      FROM note_versions
     WHERE note_id = NEW.id;

    INSERT INTO note_versions (note_id, title, content_md, content_json, version_number, created_by)
    VALUES (NEW.id, OLD.title, OLD.content_md, OLD.content_json, next_version, NEW.created_by);

    -- Prune: keep only last 50 versions
    DELETE FROM note_versions
    WHERE note_id = NEW.id
      AND version_number <= next_version - 50;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_note_version_snapshot ON notes;
CREATE TRIGGER trg_note_version_snapshot
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION snapshot_note_version();

-- Notification table (#10)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  entity_id   UUID,
  entity_type TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id) WHERE read_at IS NULL;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Note shares table (#8)
CREATE TABLE IF NOT EXISTS note_shares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  share_token  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'base64url'),
  allow_edit   BOOLEAN DEFAULT false,
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_note_shares_token ON note_shares(share_token);
ALTER TABLE note_shares DISABLE ROW LEVEL SECURITY;
