package au.edu.sydney.elec5619.dashboard.metric;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record MetricSubmissionRequest(
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal cpuUsage,
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal memoryUsage,
        @NotNull @PositiveOrZero Long responseTime,
        @NotNull Boolean availability) {
}
