package au.edu.sydney.elec5619.dashboard.metric;

import java.math.BigDecimal;
import java.time.Instant;

public record MetricReadingResponse(
        Long metricId,
        BigDecimal cpuUsage,
        BigDecimal memoryUsage,
        Long responseTime,
        boolean availability,
        Instant timestamp) {

    public static MetricReadingResponse from(Metric metric) {
        return new MetricReadingResponse(
                metric.getId(),
                metric.getCpuUsage(),
                metric.getMemoryUsage(),
                metric.getResponseTime(),
                metric.isAvailable(),
                metric.getRecordedAt());
    }
}
