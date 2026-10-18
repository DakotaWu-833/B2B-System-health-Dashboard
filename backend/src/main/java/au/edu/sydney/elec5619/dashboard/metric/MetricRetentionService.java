package au.edu.sydney.elec5619.dashboard.metric;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import au.edu.sydney.elec5619.dashboard.common.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class MetricRetentionService {
    private final MetricRepository metrics;
    private final JdbcTemplate jdbc;
    private final RetentionProperties properties;
    private final RetryingTransaction transaction;
    public MetricRetentionService(MetricRepository metrics, JdbcTemplate jdbc, RetentionProperties properties, RetryingTransaction transaction) {
        this.metrics = metrics; this.jdbc = jdbc; this.properties = properties; this.transaction = transaction;
    }
    public record Result(boolean enabled, Instant cutoff, long eligibleCount, int batchSize, int archivedCount) {}
    @Transactional(readOnly = true)
    public Result preview() {
        Instant cutoff = Instant.now().minus(properties.retainFor());
        return new Result(properties.enabled(), cutoff, metrics.countRetentionCandidates(cutoff), properties.batchSize(), 0);
    }
    public Result runBatch() {
        if (!properties.enabled()) throw new ApiProblemException(HttpStatus.CONFLICT, "Metric retention is disabled; preview is still available");
        return transaction.execute(() -> {
            // A single database row serializes workers across processes; never race archive/delete batches.
            jdbc.queryForObject("SELECT lock_id FROM maintenance_locks WHERE lock_id = 1 FOR UPDATE", Integer.class);
            Instant now = Instant.now();
            Instant cutoff = now.minus(properties.retainFor());
            List<Metric> rows = metrics.retentionCandidates(cutoff, PageRequest.of(0, properties.batchSize()));
            for (Metric row : rows) {
                jdbc.update("INSERT INTO metric_archive(metric_id,system_id,cpu_usage,memory_usage,response_time,availability,recorded_at,archived_at) VALUES (?,?,?,?,?,?,?,?)",
                        row.getId(), row.getMonitoredSystem().getId(), row.getCpuUsage(), row.getMemoryUsage(), row.getResponseTime(),
                        row.isAvailable(), Timestamp.from(row.getRecordedAt()), Timestamp.from(now));
            }
            metrics.deleteAllByIdInBatch(rows.stream().map(Metric::getId).toList());
            return new Result(true, cutoff, metrics.countRetentionCandidates(cutoff), properties.batchSize(), rows.size());
        });
    }
}
