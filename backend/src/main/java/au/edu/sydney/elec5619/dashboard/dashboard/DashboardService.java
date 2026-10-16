package au.edu.sydney.elec5619.dashboard.dashboard;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.function.Function;

import au.edu.sydney.elec5619.dashboard.alert.AlertRepository;
import au.edu.sydney.elec5619.dashboard.alert.AlertStatus;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricFreshnessPolicy;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MetricDataStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private final MonitoredSystemRepository monitoredSystemRepository;
    private final AlertRepository alertRepository;
    private final MetricRepository metricRepository;
    private final MetricFreshnessPolicy freshnessPolicy;

    public DashboardService(
            MonitoredSystemRepository monitoredSystemRepository,
            AlertRepository alertRepository,
            MetricRepository metricRepository,
            MetricFreshnessPolicy freshnessPolicy) {
        this.monitoredSystemRepository = monitoredSystemRepository;
        this.alertRepository = alertRepository;
        this.metricRepository = metricRepository;
        this.freshnessPolicy = freshnessPolicy;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary() {
        Instant evaluatedAt = Instant.now();
        List<Metric> eligibleMetrics = metricRepository.findLatestForAllSystems().stream()
                .filter(Metric::isAvailable)
                .filter(metric -> freshnessPolicy.dataStatus(metric, evaluatedAt) == MetricDataStatus.FRESH)
                .toList();

        return new DashboardSummaryResponse(
                monitoredSystemRepository.count(),
                monitoredSystemRepository.countByStatus(HealthStatus.HEALTHY),
                monitoredSystemRepository.countByStatus(HealthStatus.WARNING),
                monitoredSystemRepository.countByStatus(HealthStatus.CRITICAL),
                monitoredSystemRepository.countByStatus(HealthStatus.OFFLINE),
                alertRepository.countByStatus(AlertStatus.ACTIVE),
                average(eligibleMetrics, Metric::getCpuUsage),
                average(eligibleMetrics, Metric::getMemoryUsage),
                average(eligibleMetrics, metric -> BigDecimal.valueOf(metric.getResponseTime())));
    }

    private BigDecimal average(List<Metric> metrics, Function<Metric, BigDecimal> value) {
        if (metrics.isEmpty()) {
            return null;
        }
        BigDecimal total = metrics.stream().map(value).reduce(BigDecimal.ZERO, BigDecimal::add);
        return total.divide(BigDecimal.valueOf(metrics.size()), 2, RoundingMode.HALF_UP);
    }
}
