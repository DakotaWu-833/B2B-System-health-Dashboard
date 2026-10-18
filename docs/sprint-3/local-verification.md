# Local setup and database recovery

Use Java 21, Docker, Node 24+ and the declared pnpm 11.19.0. From the repository root run `bash scripts/verify.sh`. Docker is mandatory: tests create and remove dedicated MySQL 8.4 and Mailpit containers; they never connect to the project's configured database. Failsafe `*IT` checks run only with `-Pdatabase-integration`; a successful `test` alone is insufficient.

```sh
bash scripts/verify.sh
# Optional when a cloud-synced Documents directory duplicates compiled caches:
VERIFY_BUILD_DIRECTORY=/private/tmp/elec5619-build bash scripts/verify.sh
```

Do not run two builds against the same build directory. Reports default to `backend/target/{surefire-reports,failsafe-reports}`. With the override they live under that absolute directory. Capacity query plans are emitted to `backend/target/verification/capacity-plans.json`. Raw outputs contain test data and stay ignored. The GitHub workflow runs the same script on Ubuntu; a local success does not assert a remote Actions run.

## Isolated Docker browser acceptance

`docker-compose.verify.yml` provides MySQL at localhost:3308, SMTP at localhost:1026 and Mailpit at http://127.0.0.1:8026. All bindings use loopback, with no project data volume. Choose a unique Compose project and put a fresh random `VERIFY_DB_PASSWORD` in an ignored local environment file; do not reuse a project or production password.

```sh
# Set VERIFY_DB_PASSWORD in the current shell first.
docker compose -p dashboard-acceptance -f docker-compose.verify.yml up -d --wait
```

For the backend, export:

```sh
export DB_URL='jdbc:mysql://127.0.0.1:3308/dashboard_verification?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
export DB_USERNAME=dashboard_verify
export DB_PASSWORD="$VERIFY_DB_PASSWORD"
export DEMO_ACCOUNTS_ENABLED=true
# Supply distinct local passwords through DEMO_OPERATIONS_PASSWORD and DEMO_MANAGEMENT_PASSWORD.
export DEMO_DATA_SEED_ENABLED=true
export DEMO_LIVE_METRICS_ENABLED=true
export EMAIL_ENABLED=true
export SMTP_HOST=127.0.0.1
export SMTP_PORT=1026
cd backend
sh mvnw spring-boot:run
```

Default usernames are `demo.operations` and `demo.management`. Both passwords must be supplied, nonblank and at most 72 UTF-8 bytes. Existing matching-role accounts are preserved without resetting passwords; an existing username with a different role fails startup. Both seeding switches default off. Business data is seeded only into an empty monitored-system table. Optional live readings refresh only the three known demo systems every 30 seconds, avoiding all seeded metrics becoming STALE during a demonstration. This is synthetic data and is explicitly disabled by default.

Frontend: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, then `pnpm preview`. Development and production preview both proxy `/api` to port 8080 by default. Override `BACKEND_PROXY_TARGET` when using another backend port. Separately hosted clients can still use `VITE_API_BASE_URL` and must configure backend CORS appropriately. `.env` for Compose does not automatically export variables into Java; supply them in its launch environment.

After acceptance, stop the backend/frontend and remove only your isolated Compose project:

```sh
docker compose -p dashboard-acceptance -f docker-compose.verify.yml down -v --remove-orphans
```

## SMTP delivery

Normal startup has `EMAIL_ENABLED=false`; send attempts return 503 clearly. Mailpit accepts actual SMTP and exposes messages locally for tests. For a real provider, supply SMTP_HOST/PORT/USERNAME/PASSWORD and provider-required SMTP_AUTH/SMTP_STARTTLS settings, EMAIL_FROM, and enable delivery. No provider credentials are included. Verify a real recipient inbox separately before claiming external email delivery. Codes are never returned by the application API or intentionally logged. Local tests read Mailpit's isolated inbox only.

## Flyway upgrades

V1/V2 are the existing team migrations and remain unchanged. Additions are V3 (metric checks/alert indexes), V4 (email/challenge state), V5 (archive/maintenance lock). Never edit a migration already applied by another team member. A fresh database applies all five before JPA validation. A legacy V1 database retains users, systems, metrics, alerts and timestamps; existing users start with null email and false verification. The automated test also repeats startup without applying anything twice.

Before upgrading any shared database, take and verify a backup. Inspect normalized duplicate identities and invalid historical numbers:

```sql
SELECT TRIM(name), TRIM(type), TRIM(host), COUNT(*)
FROM monitored_systems
GROUP BY TRIM(name), TRIM(type), TRIM(host) HAVING COUNT(*) > 1;
SELECT metric_id, cpu_usage, memory_usage, response_time FROM metrics
WHERE cpu_usage < 0 OR cpu_usage > 100 OR memory_usage < 0
   OR memory_usage > 100 OR response_time < 0;
```

MySQL comparisons follow the existing collation, so case/accent equivalents can collide. Migration stops on duplicates or invalid historical data. It does not silently delete or merge evidence. Agree on canonical identities with the team, then explicitly rename conflicting systems or reconcile IDs and every dependent record while preserving history. MySQL DDL can commit partially: inspect the failed migration, current schema and Flyway history before retrying. `flyway repair` only repairs migration metadata; it does not undo DDL/data changes. Use it only after correcting the actual cause and confirming remaining SQL can safely run, then migrate and validate again. Restore the verified backup if schema effects are uncertain. Never apply Flyway `clean` to a shared/project database. The destructive clean in capacity tests is restricted to its newly created disposable container.

## Retention and archive

Default is disabled. Operations can GET `/api/admin/metrics-retention/preview` safely. To enable, explicitly set METRIC_RETENTION_ENABLED=true after agreeing the retention window; default is 30 days, batch 500 (maximum 1000), scheduled every ten minutes. One batch archives older, non-latest records and deletes their active-table copies in the same transaction. Latest readings are preserved even when old, so health/freshness evaluation survives. A database mutex serializes maintenance workers. Archive insert failure rolls back the entire batch. Repeating a completed batch does not duplicate history. Alert history is not deleted by this process. The archive is persistent data, not a backup; include it in backups/export policy. Active-history APIs intentionally do not query archived records.
