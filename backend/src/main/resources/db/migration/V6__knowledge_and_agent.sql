CREATE TABLE knowledge_documents (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    title VARCHAR(200) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    system_id BIGINT,
    operations_only BOOLEAN NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT fk_knowledge_system FOREIGN KEY (system_id) REFERENCES monitored_systems(system_id)
);
CREATE TABLE knowledge_chunks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    position INT NOT NULL,
    text VARCHAR(1000) NOT NULL,
    CONSTRAINT fk_chunk_document FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);
CREATE INDEX idx_knowledge_chunk_document ON knowledge_chunks(document_id);
CREATE TABLE agent_proposals (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    owner VARCHAR(100) NOT NULL,
    alert_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    snapshot VARCHAR(64) NOT NULL,
    evidence TEXT NOT NULL,
    expires_at TIMESTAMP(6) NOT NULL,
    confirmed_at TIMESTAMP(6),
    result_json TEXT
);
CREATE TABLE agent_runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    owner VARCHAR(100) NOT NULL,
    system_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    status VARCHAR(40) NOT NULL,
    report_json MEDIUMTEXT NOT NULL
);
CREATE INDEX idx_agent_run_owner_time ON agent_runs(owner, created_at);
