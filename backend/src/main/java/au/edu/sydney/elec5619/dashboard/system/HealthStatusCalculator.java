package au.edu.sydney.elec5619.dashboard.system;

import java.math.BigDecimal;
import java.util.Objects;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import org.springframework.stereotype.Component;

@Component
public class HealthStatusCalculator {

    private final HealthThresholdProperties thresholds;

    public HealthStatusCalculator(HealthThresholdProperties thresholds) {
        this.thresholds = thresholds;
    }

    public HealthStatus calculate(Metric metric) {
        Objects.requireNonNull(metric, "Metric is required");
        return calculate(
                metric.getCpuUsage(),
                metric.getMemoryUsage(),
                metric.getResponseTime(),
                metric.isAvailable());
    }

    public HealthStatus calculate(
            BigDecimal cpuUsage,
            BigDecimal memoryUsage,
            Long responseTime,
            boolean available) {
        Objects.requireNonNull(cpuUsage, "CPU usage is required");
        Objects.requireNonNull(memoryUsage, "Memory usage is required");
        Objects.requireNonNull(responseTime, "Response time is required");

        if (!available) {
            return HealthStatus.OFFLINE;
        }

        if (reaches(cpuUsage, thresholds.cpuCritical())
                || reaches(memoryUsage, thresholds.memoryCritical())
                || responseTime >= thresholds.responseTimeCritical()) {
            return HealthStatus.CRITICAL;
        }

        if (reaches(cpuUsage, thresholds.cpuWarning())
                || reaches(memoryUsage, thresholds.memoryWarning())
                || responseTime >= thresholds.responseTimeWarning()) {
            return HealthStatus.WARNING;
        }

        return HealthStatus.HEALTHY;
    }

    private boolean reaches(BigDecimal value, BigDecimal threshold) {
        return value.compareTo(threshold) >= 0;
    }
}
