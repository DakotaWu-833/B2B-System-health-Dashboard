package au.edu.sydney.elec5619.dashboard.system;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.stream.Stream;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {
        "app.health.thresholds.cpu-warning=60.0",
        "app.health.thresholds.cpu-critical=85.0",
        "app.health.thresholds.memory-warning=65.0",
        "app.health.thresholds.memory-critical=88.0",
        "app.health.thresholds.response-time-warning=400",
        "app.health.thresholds.response-time-critical=900"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "threshold-test-user", roles = "OPERATIONS")
class SystemThresholdIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

    @Autowired
    private HealthStatusCalculator healthStatusCalculator;

    @ParameterizedTest
    @MethodSource("thresholdBoundaries")
    void overriddenThresholdsAgreeWithHealthCalculationAndReasons(
            String cpu, String memory, long responseTime,
            HealthStatus expectedStatus, String expectedReason) throws Exception {
        MonitoredSystem system = createSystem();
        Metric metric = createMetric(system, cpu, memory, responseTime, true, Instant.now());
        HealthStatus calculatedStatus = healthStatusCalculator.calculate(metric);
        assertThat(calculatedStatus).isEqualTo(expectedStatus);
        system.changeStatus(calculatedStatus);
        monitoredSystemRepository.flush();

        ResultActions result = detailsWithOverriddenThresholds(system)
                .andExpect(jsonPath("$.data.status").value(expectedStatus.name()))
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"));
        if (expectedReason == null) {
            result.andExpect(jsonPath("$.data.statusReasons").isEmpty());
        } else {
            result.andExpect(jsonPath("$.data.statusReasons.length()").value(1))
                    .andExpect(jsonPath("$.data.statusReasons[0]").value(expectedReason));
        }
    }

    static Stream<Arguments> thresholdBoundaries() {
        return Stream.of(
                Arguments.of("59.99", "64.99", 399L, HealthStatus.HEALTHY, null),
                Arguments.of("60.00", "20.00", 100L, HealthStatus.WARNING,
                        "CPU usage reached the warning threshold"),
                Arguments.of("85.00", "20.00", 100L, HealthStatus.CRITICAL,
                        "CPU usage reached the critical threshold"),
                Arguments.of("20.00", "65.00", 100L, HealthStatus.WARNING,
                        "Memory usage reached the warning threshold"),
                Arguments.of("20.00", "88.00", 100L, HealthStatus.CRITICAL,
                        "Memory usage reached the critical threshold"),
                Arguments.of("20.00", "20.00", 400L, HealthStatus.WARNING,
                        "Response time reached the warning threshold"),
                Arguments.of("20.00", "20.00", 900L, HealthStatus.CRITICAL,
                        "Response time reached the critical threshold"));
    }

    @Test
    void exposesConfigurationWithoutInventingReasonsWhenMetricsAreMissing() throws Exception {
        detailsWithOverriddenThresholds(createSystem())
                .andExpect(jsonPath("$.data.latestMetric").doesNotExist())
                .andExpect(jsonPath("$.data.metricDataStatus").value("NO_DATA"))
                .andExpect(jsonPath("$.data.statusReasons.length()").value(1))
                .andExpect(jsonPath("$.data.statusReasons[0]").value("No metric data is available"));
    }

    @Test
    void exposesCurrentThresholdsAndPreservesStaleDataWarning() throws Exception {
        MonitoredSystem system = createSystem();
        createMetric(system, "60.00", "20.00", 100L, true, Instant.now().minusSeconds(600));

        detailsWithOverriddenThresholds(system)
                .andExpect(jsonPath("$.data.metricDataStatus").value("STALE"))
                .andExpect(jsonPath("$.data.statusReasons.length()").value(2))
                .andExpect(jsonPath("$.data.statusReasons[0]").value("Latest metric data is stale"))
                .andExpect(jsonPath("$.data.statusReasons[1]")
                        .value("CPU usage reached the warning threshold"));
    }

    @Test
    void offlineStillReturnsOnlyUnavailableReasonDespiteStaleAndHighMetrics() throws Exception {
        MonitoredSystem system = createSystem();
        Metric metric = createMetric(system, "99.00", "99.00", 5000L,
                false, Instant.now().minusSeconds(600));
        assertThat(healthStatusCalculator.calculate(metric)).isEqualTo(HealthStatus.OFFLINE);
        system.changeStatus(HealthStatus.OFFLINE);
        monitoredSystemRepository.flush();

        detailsWithOverriddenThresholds(system)
                .andExpect(jsonPath("$.data.status").value("OFFLINE"))
                .andExpect(jsonPath("$.data.metricDataStatus").value("STALE"))
                .andExpect(jsonPath("$.data.statusReasons.length()").value(1))
                .andExpect(jsonPath("$.data.statusReasons[0]").value("System is unavailable"));
    }

    private ResultActions detailsWithOverriddenThresholds(MonitoredSystem system) throws Exception {
        return mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.evaluatedThresholds.cpuWarning").value(60.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.cpuCritical").value(85.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.memoryWarning").value(65.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.memoryCritical").value(88.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.responseTimeWarning").value(400))
                .andExpect(jsonPath("$.data.evaluatedThresholds.responseTimeCritical").value(900));
    }

    private MonitoredSystem createSystem() {
        return monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Threshold API", "SERVICE", "threshold.internal.example", HealthStatus.HEALTHY, null));
    }

    private Metric createMetric(MonitoredSystem system, String cpu, String memory,
            long responseTime, boolean available, Instant recordedAt) {
        return metricRepository.saveAndFlush(new Metric(
                system, new BigDecimal(cpu), new BigDecimal(memory), responseTime, available, recordedAt));
    }
}
