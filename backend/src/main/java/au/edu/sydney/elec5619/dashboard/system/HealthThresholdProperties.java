package au.edu.sydney.elec5619.dashboard.system;

import java.math.BigDecimal;
import java.util.Objects;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.health.thresholds")
public record HealthThresholdProperties(
        BigDecimal cpuWarning,
        BigDecimal cpuCritical,
        BigDecimal memoryWarning,
        BigDecimal memoryCritical,
        long responseTimeWarning,
        long responseTimeCritical) {

    private static final BigDecimal MINIMUM_PERCENTAGE = BigDecimal.ZERO;
    private static final BigDecimal MAXIMUM_PERCENTAGE = new BigDecimal("100.0");

    public HealthThresholdProperties {
        Objects.requireNonNull(cpuWarning, "CPU warning threshold is required");
        Objects.requireNonNull(cpuCritical, "CPU critical threshold is required");
        Objects.requireNonNull(memoryWarning, "Memory warning threshold is required");
        Objects.requireNonNull(memoryCritical, "Memory critical threshold is required");

        validatePercentageThresholds("CPU", cpuWarning, cpuCritical);
        validatePercentageThresholds("Memory", memoryWarning, memoryCritical);

        if (responseTimeWarning < 0 || responseTimeWarning >= responseTimeCritical) {
            throw new IllegalArgumentException(
                    "Response-time thresholds must be non-negative and warning must be below critical");
        }
    }

    private static void validatePercentageThresholds(
            String metricName,
            BigDecimal warning,
            BigDecimal critical) {
        boolean outsidePercentageRange = warning.compareTo(MINIMUM_PERCENTAGE) < 0
                || warning.compareTo(MAXIMUM_PERCENTAGE) > 0
                || critical.compareTo(MINIMUM_PERCENTAGE) < 0
                || critical.compareTo(MAXIMUM_PERCENTAGE) > 0;
        if (outsidePercentageRange || warning.compareTo(critical) >= 0) {
            throw new IllegalArgumentException(
                    metricName
                            + " thresholds must be between 0 and 100 and warning must be below critical");
        }
    }
}
