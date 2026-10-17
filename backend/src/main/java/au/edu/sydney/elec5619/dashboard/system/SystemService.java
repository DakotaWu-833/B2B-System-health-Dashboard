package au.edu.sydney.elec5619.dashboard.system;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricReadingResponse;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataIntegrityViolationException;
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
        List<MonitoredSystem> systems = monitoredSystemRepository.findAll(Sort.by("id"));
        if (systems.isEmpty()) {
            return List.of();
        }
        Map<Long, Metric> latest = metricRepository.findLatestForAllSystems().stream()
                .collect(Collectors.toMap(m -> m.getMonitoredSystem().getId(), Function.identity()));
        Instant staleBefore = Instant.now().minus(staleAfter);
        return systems.stream()
                .map(system -> {
                    Metric metric = latest.get(system.getId());
                    return SystemListItemResponse.from(system, metric, dataStatus(metric, staleBefore));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public SystemDetailResponse getSystem(Long systemId) {
        MonitoredSystem system = monitoredSystemRepository.findById(systemId)
                .orElseThrow(() -> new MonitoredSystemNotFoundException(systemId));
        Metric latestMetric = metricRepository
                .findFirstByMonitoredSystemIdOrderByRecordedAtDescIdDesc(systemId)
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
                statusReasons(latestMetric, dataStatus),
                thresholds);
    }

    @Transactional
    public SystemListItemResponse createSystem(SystemMutationRequest request) {
        if (monitoredSystemRepository.existsByNameAndTypeAndHost(
                request.name().trim(), request.type().trim(), request.host().trim())) {
            throw new DuplicateMonitoredSystemException();
        }
        MonitoredSystem system = new MonitoredSystem(
                request.name().trim(),
                request.type().trim(),
                request.host().trim(),
                HealthStatus.HEALTHY,
                normaliseDescription(request.description()));
        return SystemListItemResponse.from(saveSystem(system));
    }

    @Transactional
    public SystemListItemResponse updateSystem(Long systemId, SystemMutationRequest request) {
        MonitoredSystem system = monitoredSystemRepository.findByIdForUpdate(systemId)
                .orElseThrow(() -> new MonitoredSystemNotFoundException(systemId));
        if (monitoredSystemRepository.existsByNameAndTypeAndHostAndIdNot(
                request.name().trim(), request.type().trim(), request.host().trim(), systemId)) {
            throw new DuplicateMonitoredSystemException();
        }
        system.updateDetails(
                request.name().trim(),
                request.type().trim(),
                request.host().trim(),
                normaliseDescription(request.description()));
        saveSystem(system);
        Metric latestMetric = metricRepository
                .findFirstByMonitoredSystemIdOrderByRecordedAtDescIdDesc(systemId).orElse(null);
        return SystemListItemResponse.from(system, latestMetric, dataStatus(latestMetric));
    }

    private MonitoredSystem saveSystem(MonitoredSystem system) {
        try {
            return monitoredSystemRepository.saveAndFlush(system);
        } catch (DataIntegrityViolationException exception) {
            // A concurrent request can insert the identity after the pre-check.
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause.getMessage() != null && cause.getMessage().toLowerCase(java.util.Locale.ROOT)
                        .contains("uk_monitored_systems_identity")) {
                    throw new DuplicateMonitoredSystemException();
                }
            }
            throw exception;
        }
    }

    private String normaliseDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        return description.trim();
    }

    private MetricDataStatus dataStatus(Metric metric) {
        return dataStatus(metric, Instant.now().minus(staleAfter));
    }

    private MetricDataStatus dataStatus(Metric metric, Instant staleBefore) {
        if (metric == null) {
            return MetricDataStatus.NO_DATA;
        }
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
            return List.of("System is unavailable");
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
