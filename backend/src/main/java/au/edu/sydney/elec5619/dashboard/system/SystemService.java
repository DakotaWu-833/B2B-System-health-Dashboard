package au.edu.sydney.elec5619.dashboard.system;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricReadingResponse;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SystemService {

    private final MonitoredSystemRepository monitoredSystemRepository;
    private final MetricRepository metricRepository;
    private final HealthThresholdProperties thresholds;
    private final Duration staleAfter;

    public SystemService(
            MonitoredSystemRepository monitoredSystemRepository,
            MetricRepository metricRepository,
            HealthThresholdProperties thresholds,
            @Value("${app.metrics.stale-after:PT5M}") Duration staleAfter) {
        this.monitoredSystemRepository = monitoredSystemRepository;
        this.metricRepository = metricRepository;
        this.thresholds = thresholds;
        this.staleAfter = staleAfter;
    }

    @Transactional(readOnly = true)
    public List<SystemListItemResponse> getSystems() {
        return monitoredSystemRepository.findAll().stream()
                .map(SystemListItemResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public SystemDetailResponse getSystem(Long systemId) {
        MonitoredSystem system = monitoredSystemRepository.findById(systemId)
                .orElseThrow(() -> new MonitoredSystemNotFoundException(systemId));
        Metric latestMetric = metricRepository
                .findFirstByMonitoredSystemIdOrderByRecordedAtDesc(systemId)
                .orElse(null);

        MetricDataStatus dataStatus = dataStatus(latestMetric);
        return new SystemDetailResponse(
                system.getId(),
                system.getName(),
                system.getType(),
                system.getHost(),
                system.getStatus(),
                system.getDescription(),
                latestMetric == null ? null : MetricReadingResponse.from(latestMetric),
                dataStatus,
                statusReasons(latestMetric, dataStatus));
    }

    private MetricDataStatus dataStatus(Metric metric) {
        if (metric == null) {
            return MetricDataStatus.NO_DATA;
        }
        Instant staleBefore = Instant.now().minus(staleAfter);
        return metric.getRecordedAt().isBefore(staleBefore)
                ? MetricDataStatus.STALE
                : MetricDataStatus.FRESH;
    }

    private List<String> statusReasons(Metric metric, MetricDataStatus dataStatus) {
        List<String> reasons = new ArrayList<>();
        if (metric == null) {
            reasons.add("No metric data is available");
            return reasons;
        }
        if (dataStatus == MetricDataStatus.STALE) {
            reasons.add("Latest metric data is stale");
        }
        if (!metric.isAvailable()) {
            reasons.add("System is unavailable");
        }
        if (metric.getCpuUsage().compareTo(thresholds.cpuCritical()) >= 0) {
            reasons.add("CPU usage reached the critical threshold");
        } else if (metric.getCpuUsage().compareTo(thresholds.cpuWarning()) >= 0) {
            reasons.add("CPU usage reached the warning threshold");
        }
        if (metric.getMemoryUsage().compareTo(thresholds.memoryCritical()) >= 0) {
            reasons.add("Memory usage reached the critical threshold");
        } else if (metric.getMemoryUsage().compareTo(thresholds.memoryWarning()) >= 0) {
            reasons.add("Memory usage reached the warning threshold");
        }
        if (metric.getResponseTime() >= thresholds.responseTimeCritical()) {
            reasons.add("Response time reached the critical threshold");
        } else if (metric.getResponseTime() >= thresholds.responseTimeWarning()) {
            reasons.add("Response time reached the warning threshold");
        }
        return List.copyOf(reasons);
    }
}
