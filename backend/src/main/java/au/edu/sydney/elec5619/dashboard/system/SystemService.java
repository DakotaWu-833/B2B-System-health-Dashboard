package au.edu.sydney.elec5619.dashboard.system;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricFreshnessPolicy;
import au.edu.sydney.elec5619.dashboard.metric.MetricReadingResponse;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import org.springframework.stereotype.Service;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SystemService {

    private final MonitoredSystemRepository monitoredSystemRepository;
    private final MetricRepository metricRepository;
    private final HealthThresholdProperties thresholds;
    private final MetricFreshnessPolicy freshnessPolicy;

    public SystemService(
            MonitoredSystemRepository monitoredSystemRepository,
            MetricRepository metricRepository,
            HealthThresholdProperties thresholds,
            MetricFreshnessPolicy freshnessPolicy) {
        this.monitoredSystemRepository = monitoredSystemRepository;
        this.metricRepository = metricRepository;
        this.thresholds = thresholds;
        this.freshnessPolicy = freshnessPolicy;
    }

    @Transactional(readOnly = true)
    public List<SystemListItemResponse> getSystems() {
        List<MonitoredSystem> systems = monitoredSystemRepository.findTop501ByOrderByIdAsc();
        if (systems.size() > 500) throw new au.edu.sydney.elec5619.dashboard.common.InvalidPageRequestException("Use /api/systems/page for more than 500 systems");
        if (systems.isEmpty()) {
            return List.of();
        }
        Map<Long, Metric> latest = metricRepository.findLatestForSystems(systems.stream().map(MonitoredSystem::getId).toList()).stream()
                .collect(Collectors.toMap(m -> m.getMonitoredSystem().getId(), Function.identity()));
        Instant evaluatedAt = Instant.now();
        return systems.stream()
                .map(system -> {
                    Metric metric = latest.get(system.getId());
                    return SystemListItemResponse.from(
                            system, metric, freshnessPolicy.dataStatus(metric, evaluatedAt));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public au.edu.sydney.elec5619.dashboard.common.PagedResponse<SystemListItemResponse> getSystemsPage(int page, int size) {
        var request = au.edu.sydney.elec5619.dashboard.common.PageRequests.bounded(page, size, Sort.by("id"));
        var systems = monitoredSystemRepository.findAll(request);
        var ids = systems.getContent().stream().map(MonitoredSystem::getId).toList();
        Map<Long, Metric> latest = ids.isEmpty() ? Map.of() : metricRepository.findLatestForSystems(ids).stream()
                .collect(Collectors.toMap(m -> m.getMonitoredSystem().getId(), Function.identity()));
        Instant now = Instant.now();
        return au.edu.sydney.elec5619.dashboard.common.PagedResponse.from(systems.map(system ->
                SystemListItemResponse.from(system, latest.get(system.getId()), freshnessPolicy.dataStatus(latest.get(system.getId()), now))));
    }

    @Transactional(readOnly = true)
    public SystemDetailResponse getSystem(Long systemId) {
        MonitoredSystem system = monitoredSystemRepository.findById(systemId)
                .orElseThrow(() -> new MonitoredSystemNotFoundException(systemId));
        Metric latestMetric = metricRepository
                .findFirstByMonitoredSystemIdOrderByRecordedAtDescIdDesc(systemId)
                .orElse(null);

        MetricDataStatus dataStatus = freshnessPolicy.dataStatus(latestMetric, Instant.now());
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
        return SystemListItemResponse.from(
                system, latestMetric, freshnessPolicy.dataStatus(latestMetric, Instant.now()));
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
