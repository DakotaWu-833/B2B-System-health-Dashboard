package au.edu.sydney.elec5619.dashboard.system;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.metric.MetricReadingResponse;

public record SystemDetailResponse(
        Long id,
        String name,
        String type,
        String host,
        HealthStatus status,
        String description,
        MetricReadingResponse latestMetric,
        MetricDataStatus metricDataStatus,
        List<String> statusReasons) {
}
