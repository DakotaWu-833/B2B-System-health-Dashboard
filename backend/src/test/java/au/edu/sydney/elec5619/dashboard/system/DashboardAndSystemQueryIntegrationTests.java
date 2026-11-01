package au.edu.sydney.elec5619.dashboard.system;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "system-query-test-user", roles = "OPERATIONS")
class DashboardAndSystemQueryIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    @Autowired
    private SystemService systemService;

    @Test
    void listIncludesLatestReadingAndExplicitMissingData() throws Exception {
        MonitoredSystem first = createSystem("Fresh", HealthStatus.WARNING);
        MonitoredSystem second = createSystem("Stale", HealthStatus.HEALTHY);
        createSystem("Empty", HealthStatus.HEALTHY);
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        createMetric(first, "99", "88", 900L, false, now.minusSeconds(60));
        Metric latest = createMetric(first, "25", "35", 150L, true, now);
        createMetric(first, "90", "95", 900L, false, now.minusSeconds(120));
        createMetric(second, "10", "20", 100L, false, now.minusSeconds(600));
        mockMvc.perform(get("/api/systems"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].latestMetric.metricId").value(latest.getId()))
                .andExpect(jsonPath("$.data[0].latestMetric.cpuUsage").value(25))
                .andExpect(jsonPath("$.data[0].latestMetric.memoryUsage").value(35))
                .andExpect(jsonPath("$.data[0].latestMetric.responseTime").value(150))
                .andExpect(jsonPath("$.data[0].latestMetric.availability").value(true))
                .andExpect(jsonPath("$.data[0].lastUpdated").value(now.toString()))
                .andExpect(jsonPath("$.data[0].metricDataStatus").value("FRESH"))
                .andExpect(jsonPath("$.data[0].status").value("WARNING"))
                .andExpect(jsonPath("$.data[1].metricDataStatus").value("STALE"))
                .andExpect(jsonPath("$.data[2].latestMetric").doesNotExist())
                .andExpect(jsonPath("$.data[2].lastUpdated").doesNotExist())
                .andExpect(jsonPath("$.data[2].metricDataStatus").value("NO_DATA"));
    }

    @Test
    void equalTimestampsUseHigherMetricIdInListAndDetails() throws Exception {
        MonitoredSystem system = createSystem("Tied", HealthStatus.HEALTHY);
        Instant now = Instant.now();
        createMetric(system, "10", "20", 100L, true, now);
        Metric latest = createMetric(system, "30", "40", 200L, false, now);
        mockMvc.perform(get("/api/systems"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].latestMetric.metricId").value(latest.getId()));
        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latestMetric.metricId").value(latest.getId()));
    }

    @Test
    void listUsesTwoQueriesRegardlessOfSystemCount() {
        for (int i = 0; i < 12; i++) {
            MonitoredSystem system = createSystem("System " + i, HealthStatus.HEALTHY);
            createMetric(system, "10", "20", 100L, true, Instant.now());
        }
        entityManager.flush();
        entityManager.clear();
        org.hibernate.stat.Statistics statistics = entityManager.getEntityManagerFactory()
                .unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            org.assertj.core.api.Assertions.assertThat(systemService.getSystems()).hasSize(12);
            org.assertj.core.api.Assertions.assertThat(statistics.getPrepareStatementCount()).isEqualTo(2);
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }

    @Test
    void returnsZeroDashboardSummaryWhenDatabaseIsEmpty() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.total").value(0))
                .andExpect(jsonPath("$.data.healthy").value(0))
                .andExpect(jsonPath("$.data.warning").value(0))
                .andExpect(jsonPath("$.data.critical").value(0))
                .andExpect(jsonPath("$.data.offline").value(0));
    }

    @Test
    void countsEveryHealthStatusInDashboardSummary() throws Exception {
        Instant now = Instant.now();
        createMetric(createSystem("Healthy API", HealthStatus.HEALTHY), "20", "30", 100L, true, now);
        createMetric(createSystem("Warning API", HealthStatus.WARNING), "80", "30", 100L, true, now);
        createMetric(createSystem("Critical API", HealthStatus.CRITICAL), "95", "30", 100L, true, now);
        createMetric(createSystem("Offline API", HealthStatus.OFFLINE), "20", "30", 100L, false, now);

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(4))
                .andExpect(jsonPath("$.data.healthy").value(1))
                .andExpect(jsonPath("$.data.warning").value(1))
                .andExpect(jsonPath("$.data.critical").value(1))
                .andExpect(jsonPath("$.data.offline").value(1))
                .andExpect(jsonPath("$.data.noData").value(0))
                .andExpect(jsonPath("$.data.freshReadingCount").value(4))
                .andExpect(jsonPath("$.data.staleReadingCount").value(0));
    }

    @Test
    void listsSystemsAndReturnsAnEmptyArrayWhenThereAreNone() throws Exception {
        mockMvc.perform(get("/api/systems"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());

        MonitoredSystem system = createSystem("Orders API", HealthStatus.WARNING);

        mockMvc.perform(get("/api/systems"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(system.getId()))
                .andExpect(jsonPath("$.data[0].name").value("Orders API"))
                .andExpect(jsonPath("$.data[0].status").value("WARNING"));
    }

    @Test
    void returnsNoDataWhenSystemHasNoMetrics() throws Exception {
        MonitoredSystem system = createSystem("Empty API", HealthStatus.HEALTHY);

        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latestMetric").doesNotExist())
                .andExpect(jsonPath("$.data.metricDataStatus").value("NO_DATA"))
                .andExpect(jsonPath("$.data.statusReasons[0]")
                        .value("No metric data is available"));
    }

    @Test
    @WithMockUser(username = "management-query-test-user", roles = "MANAGEMENT")
    void returnsDefaultEvaluatedThresholdsForSystemDetails() throws Exception {
        MonitoredSystem system = createSystem("Threshold API", HealthStatus.HEALTHY);

        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.evaluatedThresholds.cpuWarning").value(75.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.cpuCritical").value(90.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.memoryWarning").value(75.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.memoryCritical").value(90.0))
                .andExpect(jsonPath("$.data.evaluatedThresholds.responseTimeWarning").value(500))
                .andExpect(jsonPath("$.data.evaluatedThresholds.responseTimeCritical").value(1000))
                .andExpect(jsonPath("$.data.metricDataStatus").value("NO_DATA"))
                .andExpect(jsonPath("$.data.statusReasons.length()").value(1))
                .andExpect(jsonPath("$.data.statusReasons[0]").value("No metric data is available"));
    }

    @Test
    void returnsLatestMetricWithThresholdReasons() throws Exception {
        MonitoredSystem system = createSystem("Payments API", HealthStatus.CRITICAL);
        createMetric(system, "95.00", "70.00", 250L, true, Instant.now());

        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.latestMetric.cpuUsage").value(95.0))
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"))
                .andExpect(jsonPath("$.data.statusReasons[0]")
                        .value("CPU usage reached the critical threshold"));
    }

    @Test
    void marksOldMetricAsStale() throws Exception {
        MonitoredSystem system = createSystem("Legacy API", HealthStatus.HEALTHY);
        createMetric(system, "20.00", "30.00", 100L, true, Instant.now().minusSeconds(600));

        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("STALE"))
                .andExpect(jsonPath("$.data.statusReasons[0]")
                        .value("Latest metric data is stale"));
    }

    @Test
    void returnsUnavailableReasonForOfflineSystem() throws Exception {
        MonitoredSystem system = createSystem("Offline API", HealthStatus.OFFLINE);
        createMetric(system, "95.00", "95.00", 5000L, false, Instant.now());

        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OFFLINE"))
                .andExpect(jsonPath("$.data.latestMetric.availability").value(false))
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"))
                .andExpect(jsonPath("$.data.statusReasons.length()").value(1))
                .andExpect(jsonPath("$.data.statusReasons[0]")
                        .value("System is unavailable"));
    }

    @Test
    void returnsNotFoundForUnknownSystem() throws Exception {
        mockMvc.perform(get("/api/systems/{id}", 999999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(get("/api/systems/{id}/metrics", 999999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void returnsRecentMetricsNewestFirst() throws Exception {
        MonitoredSystem system = createSystem("History API", HealthStatus.HEALTHY);
        Instant now = Instant.now();
        createMetric(system, "10.00", "20.00", 100L, true, now.minusSeconds(60));
        createMetric(system, "30.00", "40.00", 200L, true, now);

        mockMvc.perform(get("/api/systems/{id}/metrics", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].cpuUsage").value(30.0))
                .andExpect(jsonPath("$.data[1].cpuUsage").value(10.0));
    }

    private MonitoredSystem createSystem(String name, HealthStatus status) {
        return monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                name,
                "SERVICE",
                name.toLowerCase().replace(' ', '-') + ".internal.example",
                status,
                "Integration test system"));
    }

    private Metric createMetric(
            MonitoredSystem system,
            String cpu,
            String memory,
            Long responseTime,
            boolean availability,
            Instant recordedAt) {
        return metricRepository.saveAndFlush(new Metric(
                system,
                new BigDecimal(cpu),
                new BigDecimal(memory),
                responseTime,
                availability,
                recordedAt));
    }
}
