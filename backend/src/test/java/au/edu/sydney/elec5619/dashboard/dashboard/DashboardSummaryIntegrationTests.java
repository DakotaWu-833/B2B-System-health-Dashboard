package au.edu.sydney.elec5619.dashboard.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;

import com.fasterxml.jackson.databind.ObjectMapper;

import au.edu.sydney.elec5619.dashboard.alert.Alert;
import au.edu.sydney.elec5619.dashboard.alert.AlertRepository;
import au.edu.sydney.elec5619.dashboard.alert.AlertSeverity;
import au.edu.sydney.elec5619.dashboard.alert.AlertStatus;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "dashboard-test-user", roles = "OPERATIONS")
class DashboardSummaryIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void emptySummaryIncludesCurrentEvaluationTime() throws Exception {
        Instant beforeRequest = Instant.now();
        String response = noAverages(summary()).andReturn().getResponse().getContentAsString();
        Instant afterRequest = Instant.now();
        Instant evaluatedAt = Instant.parse(objectMapper.readTree(response)
                .path("data").path("evaluatedAt").asText());

        assertThat(evaluatedAt).isBetween(beforeRequest, afterRequest);
    }

    @Test
    void summaryEvaluationTimeIsIndependentOfMeasurementTime() throws Exception {
        Instant recordedAt = Instant.now().minusSeconds(60);
        createMetric(createSystem("Measured", HealthStatus.HEALTHY),
                "20.00", "30.00", 100L, true, recordedAt);

        Instant beforeRequest = Instant.now();
        String response = summary()
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0))
                .andReturn().getResponse().getContentAsString();
        Instant afterRequest = Instant.now();
        Instant evaluatedAt = Instant.parse(objectMapper.readTree(response)
                .path("data").path("evaluatedAt").asText());

        assertThat(evaluatedAt).isBetween(beforeRequest, afterRequest).isAfter(recordedAt);
    }

    @Test
    void emptyDatabaseReturnsZeroCountsAndExplicitlyNullAverages() throws Exception {
        noAverages(summary())
                .andExpect(jsonPath("$.data.total").value(0))
                .andExpect(jsonPath("$.data.healthy").value(0))
                .andExpect(jsonPath("$.data.warning").value(0))
                .andExpect(jsonPath("$.data.critical").value(0))
                .andExpect(jsonPath("$.data.offline").value(0))
                .andExpect(jsonPath("$.data.activeAlertCount").value(0));
    }

    @Test
    void systemsWithoutMetricsRemainCountedWithoutInventingAverages() throws Exception {
        createSystem("Healthy", HealthStatus.HEALTHY);
        createSystem("Warning", HealthStatus.WARNING);
        createSystem("Critical", HealthStatus.CRITICAL);
        createSystem("Offline", HealthStatus.OFFLINE);

        noAverages(summary())
                .andExpect(jsonPath("$.data.total").value(4))
                .andExpect(jsonPath("$.data.healthy").value(1))
                .andExpect(jsonPath("$.data.warning").value(1))
                .andExpect(jsonPath("$.data.critical").value(1))
                .andExpect(jsonPath("$.data.offline").value(1));
    }

    @Test
    void averagesLatestReadingPerSystemRatherThanAllHistoricalReadings() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem first = createSystem("First", HealthStatus.HEALTHY);
        MonitoredSystem second = createSystem("Second", HealthStatus.WARNING);
        createMetric(first, "99.00", "99.00", 999L, true, now.minusSeconds(60));
        createMetric(first, "98.00", "98.00", 998L, true, now.minusSeconds(30));
        createMetric(first, "20.00", "40.00", 100L, true, now);
        createMetric(second, "40.00", "80.00", 200L, true, now);

        summary()
                .andExpect(jsonPath("$.data.averageCpuUsage").value(30.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(60.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(150.0));
    }

    @Test
    void excludesMissingStaleAndUnavailableReadingsWithoutChangingStatusCounts() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem fresh = createSystem("Fresh", HealthStatus.HEALTHY);
        MonitoredSystem stale = createSystem("Stale", HealthStatus.WARNING);
        MonitoredSystem offline = createSystem("Offline", HealthStatus.OFFLINE);
        createSystem("Missing", HealthStatus.HEALTHY);
        createMetric(fresh, "20.00", "30.00", 100L, true, now);
        createMetric(stale, "99.00", "99.00", 9000L, true, now.minusSeconds(600));
        createMetric(offline, "99.00", "99.00", 9000L, false, now);

        summary()
                .andExpect(jsonPath("$.data.total").value(4))
                .andExpect(jsonPath("$.data.healthy").value(2))
                .andExpect(jsonPath("$.data.warning").value(1))
                .andExpect(jsonPath("$.data.offline").value(1))
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(30.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(100.0));
        assertThat(monitoredSystemRepository.findById(stale.getId()).orElseThrow().getStatus())
                .isEqualTo(HealthStatus.WARNING);
    }

    @Test
    void allStaleReadingsReturnNullAveragesButKeepActiveAlerts() throws Exception {
        MonitoredSystem system = createSystem("Stale", HealthStatus.WARNING);
        createMetric(system, "80.00", "80.00", 600L, true, Instant.now().minusSeconds(600));
        createAlert(system, AlertStatus.ACTIVE, Instant.now().minusSeconds(86400));

        noAverages(summary())
                .andExpect(jsonPath("$.data.warning").value(1))
                .andExpect(jsonPath("$.data.activeAlertCount").value(1));
    }

    @Test
    void allUnavailableReadingsReturnNullAverages() throws Exception {
        MonitoredSystem system = createSystem("Offline", HealthStatus.OFFLINE);
        createMetric(system, "99.00", "99.00", 9999L, false, Instant.now());

        noAverages(summary()).andExpect(jsonPath("$.data.offline").value(1));
    }

    @Test
    void measuredZeroValuesRemainNumbersRatherThanNull() throws Exception {
        MonitoredSystem system = createSystem("Idle", HealthStatus.HEALTHY);
        createMetric(system, "0.00", "0.00", 0L, true, Instant.now());

        summary()
                .andExpect(jsonPath("$.data.averageCpuUsage").value(0.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(0.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(0.0));
    }

    @Test
    void averagesUseDecimalHalfUpRounding() throws Exception {
        Instant now = Instant.now();
        createMetric(createSystem("First", HealthStatus.HEALTHY),
                "10.00", "20.00", 100L, true, now);
        createMetric(createSystem("Second", HealthStatus.HEALTHY),
                "10.01", "20.01", 101L, true, now);

        summary()
                .andExpect(jsonPath("$.data.averageCpuUsage").value(10.01))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(20.01))
                .andExpect(jsonPath("$.data.averageResponseTime").value(100.5));
    }

    @Test
    void higherMetricIdWinsWhenMeasurementTimesTie() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem system = createSystem("Tied", HealthStatus.HEALTHY);
        createMetric(system, "90.00", "90.00", 900L, true, now);
        createMetric(system, "20.00", "30.00", 100L, true, now);

        summary()
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(30.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(100.0));
    }

    @Test
    void lateArrivingOlderReadingDoesNotReplaceLatestMeasurement() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem system = createSystem("Late arrival", HealthStatus.HEALTHY);
        createMetric(system, "20.00", "30.00", 100L, true, now);
        createMetric(system, "99.00", "99.00", 9999L, true, now.minusSeconds(60));

        summary()
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(30.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(100.0));
    }

    @Test
    void unavailableLatestReadingDoesNotFallBackToOlderAvailableReading() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem system = createSystem("Offline", HealthStatus.OFFLINE);
        createMetric(system, "20.00", "30.00", 100L, true, now.minusSeconds(60));
        createMetric(system, "99.00", "99.00", 9999L, false, now);

        noAverages(summary());
    }

    @Test
    void countsAllActiveAlertsRatherThanSystemsOrCurrentPage() throws Exception {
        MonitoredSystem first = createSystem("First", HealthStatus.WARNING);
        MonitoredSystem second = createSystem("Second", HealthStatus.OFFLINE);
        Instant now = Instant.now();
        for (int i = 0; i < 6; i++) {
            createAlert(first, AlertStatus.ACTIVE, now);
            createAlert(second, AlertStatus.ACTIVE, now.minusSeconds(86400));
        }
        createAlert(first, AlertStatus.ACKNOWLEDGED, now);
        createAlert(second, AlertStatus.RESOLVED, now);

        noAverages(summary()).andExpect(jsonPath("$.data.activeAlertCount").value(12));
    }

    @Test
    void activeAlertCountReflectsAcknowledgementAndResolution() throws Exception {
        MonitoredSystem system = createSystem("Warning", HealthStatus.WARNING);
        Alert first = createAlert(system, AlertStatus.ACTIVE, Instant.now());
        Alert second = createAlert(system, AlertStatus.ACTIVE, Instant.now());
        summary().andExpect(jsonPath("$.data.activeAlertCount").value(2));

        mockMvc.perform(patch("/api/alerts/{id}/acknowledge", first.getId()).with(csrf()))
                .andExpect(status().isOk());
        summary().andExpect(jsonPath("$.data.activeAlertCount").value(1));

        mockMvc.perform(patch("/api/alerts/{id}/resolve", second.getId()).with(csrf()))
                .andExpect(status().isOk());
        summary().andExpect(jsonPath("$.data.activeAlertCount").value(0));
    }

    @Test
    @WithMockUser(username = "management-dashboard-user", roles = "MANAGEMENT")
    void managementCanReadNewSummaryFields() throws Exception {
        MonitoredSystem system = createSystem("Managed", HealthStatus.HEALTHY);
        createMetric(system, "20.00", "30.00", 100L, true, Instant.now());
        createAlert(system, AlertStatus.ACTIVE, Instant.now());

        summary()
                .andExpect(jsonPath("$.data.activeAlertCount").value(1))
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0));
    }

    @Test
    @WithAnonymousUser
    void anonymousUserCannotReadSummary() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Authentication required"));
    }

    @Test
    void queryCountDoesNotGrowWithNumberOfSystems() throws Exception {
        Instant now = Instant.now();
        for (int i = 0; i < 12; i++) {
            createMetric(createSystem("System " + i, HealthStatus.HEALTHY),
                    "20.00", "30.00", 100L, true, now);
        }
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        summary()
                .andExpect(jsonPath("$.data.total").value(12))
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0));

        assertThat(statistics.getPrepareStatementCount()).isEqualTo(7L);
    }

    private ResultActions summary() throws Exception {
        return mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.evaluatedAt").isNotEmpty())
                .andExpect(jsonPath("$.message").value("Dashboard summary retrieved successfully"));
    }

    private ResultActions noAverages(ResultActions result) throws Exception {
        return result
                .andExpect(jsonPath("$.data.averageCpuUsage").value(nullValue()))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(nullValue()))
                .andExpect(jsonPath("$.data.averageResponseTime").value(nullValue()));
    }

    private MonitoredSystem createSystem(String name, HealthStatus status) {
        return monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                name, "SERVICE", name.toLowerCase().replace(' ', '-') + ".example", status, null));
    }

    private Metric createMetric(MonitoredSystem system, String cpu, String memory,
            long responseTime, boolean available, Instant recordedAt) {
        return metricRepository.saveAndFlush(new Metric(
                system, new BigDecimal(cpu), new BigDecimal(memory), responseTime, available, recordedAt));
    }

    private Alert createAlert(MonitoredSystem system, AlertStatus status, Instant createdAt) {
        return alertRepository.saveAndFlush(new Alert(
                system, "HIGH_CPU", AlertSeverity.WARNING, "CPU warning", status, createdAt));
    }
}
