package au.edu.sydney.elec5619.dashboard.metric;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class RetentionScheduler {
    private static final Logger LOG = LoggerFactory.getLogger(RetentionScheduler.class);
    private final RetentionProperties properties;
    private final MetricRetentionService service;
    public RetentionScheduler(RetentionProperties properties, MetricRetentionService service) { this.properties = properties; this.service = service; }
    @Scheduled(fixedDelayString = "${app.metrics.retention.interval-ms:600000}")
    public void run() {
        if (!properties.enabled()) return;
        try { service.runBatch(); }
        catch (RuntimeException failure) { LOG.error("Metric archive batch failed and rolled back", failure); }
    }
}
