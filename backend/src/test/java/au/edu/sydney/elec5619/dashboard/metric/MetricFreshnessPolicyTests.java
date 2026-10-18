package au.edu.sydney.elec5619.dashboard.metric;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MetricDataStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import org.junit.jupiter.api.Test;

class MetricFreshnessPolicyTests {

    private static final Instant EVALUATED_AT = Instant.parse("2026-10-16T00:00:00Z");

    @Test
    void missingReadingIsNoData() {
        MetricFreshnessPolicy policy = new MetricFreshnessPolicy(Duration.ofMinutes(5));

        assertThat(policy.dataStatus(null, EVALUATED_AT)).isEqualTo(MetricDataStatus.NO_DATA);
    }

    @Test
    void cutoffIsInclusiveAndOlderReadingsAreStale() {
        MetricFreshnessPolicy policy = new MetricFreshnessPolicy(Duration.ofMinutes(5));
        Instant cutoff = EVALUATED_AT.minusSeconds(300);

        assertThat(policy.dataStatus(metricAt(cutoff), EVALUATED_AT)).isEqualTo(MetricDataStatus.FRESH);
        assertThat(policy.dataStatus(metricAt(cutoff.plusNanos(1)), EVALUATED_AT))
                .isEqualTo(MetricDataStatus.FRESH);
        assertThat(policy.dataStatus(metricAt(cutoff.minusNanos(1)), EVALUATED_AT))
                .isEqualTo(MetricDataStatus.STALE);
    }

    @Test
    void usesConfiguredFreshnessWindow() {
        MetricFreshnessPolicy policy = new MetricFreshnessPolicy(Duration.ofSeconds(30));

        assertThat(policy.dataStatus(metricAt(EVALUATED_AT.minusSeconds(60)), EVALUATED_AT))
                .isEqualTo(MetricDataStatus.STALE);
        assertThat(policy.dataStatus(metricAt(EVALUATED_AT.minusSeconds(10)), EVALUATED_AT))
                .isEqualTo(MetricDataStatus.FRESH);
    }

    @Test
    void rejectsZeroAndNegativeFreshnessWindows() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new MetricFreshnessPolicy(Duration.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new MetricFreshnessPolicy(Duration.ofSeconds(-1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Metric metricAt(Instant recordedAt) {
        MonitoredSystem system = new MonitoredSystem(
                "Freshness API", "SERVICE", "freshness.example", HealthStatus.HEALTHY, null);
        return new Metric(system, BigDecimal.ZERO, BigDecimal.ZERO, 0L, true, recordedAt);
    }
}
