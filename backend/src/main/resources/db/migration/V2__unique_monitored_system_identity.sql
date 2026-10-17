-- Normalize legacy identities before enforcing the API's trimmed composite key.
-- If duplicates exist, migration stops: reconcile them explicitly; never delete
-- monitored systems (and their metrics/alerts) automatically.
UPDATE monitored_systems
SET name = TRIM(name), type = TRIM(type), host = TRIM(host);

ALTER TABLE monitored_systems
    ADD CONSTRAINT uk_monitored_systems_identity UNIQUE (name, type, host);
