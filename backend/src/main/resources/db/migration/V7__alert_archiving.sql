ALTER TABLE alerts ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alerts ADD CONSTRAINT chk_alert_archive_resolved CHECK (archived = FALSE OR status = 'RESOLVED');
CREATE INDEX idx_alerts_archived_time ON alerts (archived, created_time, alert_id);
