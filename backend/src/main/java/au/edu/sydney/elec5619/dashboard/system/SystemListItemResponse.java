package au.edu.sydney.elec5619.dashboard.system;

import java.time.Instant;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricReadingResponse;

public record SystemListItemResponse(
        Long id,
        String name,
        String type,
        String host,
        HealthStatus status,
        String description,
        MetricReadingResponse latestMetric,
        Instant lastUpdated,
        MetricDataStatus metricDataStatus) {

    public static SystemListItemResponse from(MonitoredSystem system) {
        return from(system, null, MetricDataStatus.NO_DATA);
    }

    public static SystemListItemResponse from(
            MonitoredSystem system, Metric metric, MetricDataStatus dataStatus) {
        return new SystemListItemResponse(
                system.getId(),
                system.getName(),
                system.getType(),
                system.getHost(),
                system.getStatus(),
                system.getDescription(),
                metric == null ? null : MetricReadingResponse.from(metric),
                metric == null ? null : metric.getRecordedAt(),
                dataStatus);
    }
}
