package au.edu.sydney.elec5619.dashboard.dashboard;

import java.math.BigDecimal;
import java.time.Instant;

public record DashboardSummaryResponse(
        long total,
        long healthy,
        long warning,
        long critical,
        long offline,
        long activeAlertCount,
        BigDecimal averageCpuUsage,
        BigDecimal averageMemoryUsage,
        BigDecimal averageResponseTime,
        Instant evaluatedAt) {
}
