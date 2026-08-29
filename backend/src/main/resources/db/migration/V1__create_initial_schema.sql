CREATE TABLE monitored_systems (
    system_id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(50) NOT NULL,
    host VARCHAR(255) NOT NULL,
    status ENUM('HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE') NOT NULL,
    description VARCHAR(1000),
    PRIMARY KEY (system_id)
) ENGINE=InnoDB;

CREATE TABLE users (
    user_id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('OPERATIONS', 'MANAGEMENT') NOT NULL,
    PRIMARY KEY (user_id),
    CONSTRAINT uk_users_username UNIQUE (username)
) ENGINE=InnoDB;

CREATE TABLE metrics (
    metric_id BIGINT NOT NULL AUTO_INCREMENT,
    system_id BIGINT NOT NULL,
    cpu_usage DECIMAL(5, 2) NOT NULL,
    memory_usage DECIMAL(5, 2) NOT NULL,
    response_time BIGINT NOT NULL,
    availability BIT NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    PRIMARY KEY (metric_id),
    CONSTRAINT fk_metrics_system
        FOREIGN KEY (system_id) REFERENCES monitored_systems (system_id)
) ENGINE=InnoDB;

CREATE TABLE alerts (
    alert_id BIGINT NOT NULL AUTO_INCREMENT,
    system_id BIGINT NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity ENUM('WARNING', 'CRITICAL') NOT NULL,
    message VARCHAR(1000) NOT NULL,
    status ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL,
    created_time DATETIME(6) NOT NULL,
    PRIMARY KEY (alert_id),
    CONSTRAINT fk_alerts_system
        FOREIGN KEY (system_id) REFERENCES monitored_systems (system_id)
) ENGINE=InnoDB;

CREATE INDEX idx_monitored_systems_status
    ON monitored_systems (status);

CREATE INDEX idx_metrics_system_recorded_at
    ON metrics (system_id, recorded_at);

CREATE INDEX idx_alerts_system_status
    ON alerts (system_id, status);

CREATE INDEX idx_alerts_created_time
    ON alerts (created_time);
