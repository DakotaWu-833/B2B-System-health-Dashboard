CREATE TABLE metric_archive (
    metric_id BIGINT NOT NULL,
    system_id BIGINT NOT NULL,
    cpu_usage DECIMAL(5,2) NOT NULL,
    memory_usage DECIMAL(5,2) NOT NULL,
    response_time BIGINT NOT NULL,
    availability BIT NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    archived_at DATETIME(6) NOT NULL,
    PRIMARY KEY (metric_id),
    CONSTRAINT fk_metric_archive_system FOREIGN KEY (system_id) REFERENCES monitored_systems(system_id)
) ENGINE=InnoDB;
CREATE INDEX idx_metric_archive_system_time ON metric_archive(system_id, recorded_at, metric_id);
CREATE TABLE maintenance_locks (lock_id INT NOT NULL PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO maintenance_locks(lock_id) VALUES (1);
