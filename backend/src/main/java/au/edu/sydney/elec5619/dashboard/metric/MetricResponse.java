package au.edu.sydney.elec5619.dashboard.metric;

import java.math.BigDecimal;
import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.system.HealthStatus;

public record MetricResponse(
        Long metricId,
        Long systemId,
        BigDecimal cpuUsage,
        BigDecimal memoryUsage,
        Long responseTime,
        boolean availability,
        Instant timestamp,
        HealthStatus systemStatus) {

    public static MetricResponse from(Metric metric, HealthStatus systemStatus) {
        return new MetricResponse(
                metric.getId(),
                metric.getMonitoredSystem().getId(),
                metric.getCpuUsage(),
                metric.getMemoryUsage(),
                metric.getResponseTime(),
                metric.isAvailable(),
                metric.getRecordedAt(),
                systemStatus);
    }
}
