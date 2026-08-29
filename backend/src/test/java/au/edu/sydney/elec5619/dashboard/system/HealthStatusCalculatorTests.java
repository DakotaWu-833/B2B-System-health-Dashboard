package au.edu.sydney.elec5619.dashboard.system;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HealthStatusCalculatorTests {

    private HealthStatusCalculator calculator;

    @BeforeEach
    void setUp() {
        HealthThresholdProperties thresholds = new HealthThresholdProperties(
                new BigDecimal("75.0"),
                new BigDecimal("90.0"),
                new BigDecimal("75.0"),
                new BigDecimal("90.0"),
                500L,
                1000L);
        calculator = new HealthStatusCalculator(thresholds);
    }

    @Test
    void returnsOfflineWhenSystemIsUnavailable() {
        HealthStatus status = calculator.calculate(
                new BigDecimal("95.0"),
                new BigDecimal("95.0"),
                1500L,
                false);

        assertThat(status).isEqualTo(HealthStatus.OFFLINE);
    }

    @Test
    void returnsCriticalWhenAnyMetricReachesCriticalThreshold() {
        assertThat(calculator.calculate(
                new BigDecimal("90.0"),
                new BigDecimal("20.0"),
                100L,
                true)).isEqualTo(HealthStatus.CRITICAL);
        assertThat(calculator.calculate(
                new BigDecimal("20.0"),
                new BigDecimal("90.0"),
                100L,
                true)).isEqualTo(HealthStatus.CRITICAL);
        assertThat(calculator.calculate(
                new BigDecimal("20.0"),
                new BigDecimal("20.0"),
                1000L,
                true)).isEqualTo(HealthStatus.CRITICAL);
    }

    @Test
    void returnsWarningWhenAnyMetricReachesWarningThreshold() {
        assertThat(calculator.calculate(
                new BigDecimal("75.0"),
                new BigDecimal("20.0"),
                100L,
                true)).isEqualTo(HealthStatus.WARNING);
        assertThat(calculator.calculate(
                new BigDecimal("20.0"),
                new BigDecimal("75.0"),
                100L,
                true)).isEqualTo(HealthStatus.WARNING);
        assertThat(calculator.calculate(
                new BigDecimal("20.0"),
                new BigDecimal("20.0"),
                500L,
                true)).isEqualTo(HealthStatus.WARNING);
    }

    @Test
    void givesCriticalStatusPrecedenceOverWarning() {
        HealthStatus status = calculator.calculate(
                new BigDecimal("80.0"),
                new BigDecimal("95.0"),
                700L,
                true);

        assertThat(status).isEqualTo(HealthStatus.CRITICAL);
    }

    @Test
    void returnsHealthyWhenAllMetricsAreBelowWarningThresholds() {
        HealthStatus status = calculator.calculate(
                new BigDecimal("74.99"),
                new BigDecimal("74.99"),
                499L,
                true);

        assertThat(status).isEqualTo(HealthStatus.HEALTHY);
    }

    @Test
    void rejectsInvalidPercentageThresholdConfiguration() {
        assertThatIllegalArgumentException().isThrownBy(() -> new HealthThresholdProperties(
                new BigDecimal("90.0"),
                new BigDecimal("75.0"),
                new BigDecimal("75.0"),
                new BigDecimal("90.0"),
                500L,
                1000L));
    }

    @Test
    void rejectsInvalidResponseTimeThresholdConfiguration() {
        assertThatIllegalArgumentException().isThrownBy(() -> new HealthThresholdProperties(
                new BigDecimal("75.0"),
                new BigDecimal("90.0"),
                new BigDecimal("75.0"),
                new BigDecimal("90.0"),
                1000L,
                500L));
    }
}
