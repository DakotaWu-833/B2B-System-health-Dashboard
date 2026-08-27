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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DashboardAndSystemQueryIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

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
        createSystem("Healthy API", HealthStatus.HEALTHY);
        createSystem("Warning API", HealthStatus.WARNING);
        createSystem("Critical API", HealthStatus.CRITICAL);
        createSystem("Offline API", HealthStatus.OFFLINE);

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(4))
                .andExpect(jsonPath("$.data.healthy").value(1))
                .andExpect(jsonPath("$.data.warning").value(1))
                .andExpect(jsonPath("$.data.critical").value(1))
                .andExpect(jsonPath("$.data.offline").value(1));
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
        createMetric(system, "20.00", "30.00", 100L, false, Instant.now());

        mockMvc.perform(get("/api/systems/{id}", system.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OFFLINE"))
                .andExpect(jsonPath("$.data.latestMetric.availability").value(false))
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"))
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
