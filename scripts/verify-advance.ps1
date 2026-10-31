param([switch]$TestRedis, [int]$RedisPort = 6386)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBuild = Join-Path $taskRoot 'backend/target/advance-verify'
Push-Location (Join-Path $taskRoot 'backend')
try {
    $taskTests = '*Tests,H2FlywayMigrationIT'
    $taskArgs = @('-B', 'test', "-Ddashboard.build.directory=$taskBuild")
    if ($TestRedis) { $taskTests += ',RedisRuntimeIT'; $taskArgs += @('-Dredis.it=true', "-Dredis.port=$RedisPort") }
    $taskArgs += "-Dtest=$taskTests"
    & .\mvnw.cmd @taskArgs
    if ($LASTEXITCODE -ne 0) { throw 'Backend verification failed. Use Java 21 and check the test report.' }
} finally { Pop-Location }
Push-Location (Join-Path $taskRoot 'frontend')
try {
    & pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
    & pnpm test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
    & pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
Write-Output 'Advance verification passed.'
