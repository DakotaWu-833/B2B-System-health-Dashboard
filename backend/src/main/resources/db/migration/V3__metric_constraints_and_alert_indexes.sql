-- Abort on invalid legacy metrics rather than silently changing monitoring evidence.
ALTER TABLE metrics ADD CONSTRAINT chk_metrics_cpu CHECK (cpu_usage >= 0 AND cpu_usage <= 100);
ALTER TABLE metrics ADD CONSTRAINT chk_metrics_memory CHECK (memory_usage >= 0 AND memory_usage <= 100);
ALTER TABLE metrics ADD CONSTRAINT chk_metrics_response CHECK (response_time >= 0);
CREATE INDEX idx_alerts_status_time ON alerts (status, created_time, alert_id);
CREATE INDEX idx_alerts_system_type_status_time ON alerts (system_id, alert_type, status, created_time, alert_id);
