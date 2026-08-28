package au.edu.sydney.elec5619.dashboard.metric;

import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.alert.AlertService;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.HealthStatusCalculator;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemNotFoundException;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import jakarta.validation.Valid;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class MetricService {

    private final MetricRepository metricRepository;
    private final MonitoredSystemRepository monitoredSystemRepository;
    private final HealthStatusCalculator healthStatusCalculator;
    private final AlertService alertService;

    public MetricService(
            MetricRepository metricRepository,
            MonitoredSystemRepository monitoredSystemRepository,
            HealthStatusCalculator healthStatusCalculator,
            AlertService alertService) {
        this.metricRepository = metricRepository;
        this.monitoredSystemRepository = monitoredSystemRepository;
        this.healthStatusCalculator = healthStatusCalculator;
        this.alertService = alertService;
    }

    @Transactional
    public MetricResponse submitMetric(Long systemId, @Valid MetricSubmissionRequest request) {
        MonitoredSystem monitoredSystem = monitoredSystemRepository.findById(systemId)
                .orElseThrow(() -> new MonitoredSystemNotFoundException(systemId));

        Metric metric = new Metric(
                monitoredSystem,
                request.cpuUsage(),
                request.memoryUsage(),
                request.responseTime(),
                request.availability(),
                Instant.now());

        HealthStatus healthStatus = healthStatusCalculator.calculate(metric);
        monitoredSystem.changeStatus(healthStatus);

        Metric savedMetric = metricRepository.save(metric);
        monitoredSystemRepository.save(monitoredSystem);
        alertService.recordAlertsForMetric(savedMetric);

        return MetricResponse.from(savedMetric, healthStatus);
    }
}
