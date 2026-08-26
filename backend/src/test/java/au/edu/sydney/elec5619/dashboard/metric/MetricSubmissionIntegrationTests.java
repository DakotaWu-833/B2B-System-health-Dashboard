package au.edu.sydney.elec5619.dashboard.metric;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MetricSubmissionIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MetricRepository metricRepository;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Test
    void submitsMetricAndUpdatesSystemStatusInOneRequest() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Orders API");

        mockMvc.perform(post("/api/systems/{systemId}/metrics", monitoredSystem.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cpuUsage": 92.50,
                                  "memoryUsage": 64.00,
                                  "responseTime": 210,
                                  "availability": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.metricId").isNumber())
                .andExpect(jsonPath("$.data.systemId").value(monitoredSystem.getId()))
                .andExpect(jsonPath("$.data.systemStatus").value("CRITICAL"))
                .andExpect(jsonPath("$.data.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.message").value("Metric submitted successfully"));

        List<Metric> metrics = metricRepository
                .findTop100ByMonitoredSystemIdOrderByRecordedAtDesc(monitoredSystem.getId());
        MonitoredSystem updatedSystem = monitoredSystemRepository
                .findById(monitoredSystem.getId())
                .orElseThrow();

        assertThat(metrics).hasSize(1);
        assertThat(metrics.getFirst().getCpuUsage()).isEqualByComparingTo("92.50");
        assertThat(updatedSystem.getStatus()).isEqualTo(HealthStatus.CRITICAL);
    }

    @Test
    void rejectsInvalidMetricWithoutChangingDatabase() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Billing API");

        mockMvc.perform(post("/api/systems/{systemId}/metrics", monitoredSystem.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cpuUsage": 101.00,
                                  "memoryUsage": 50.00,
                                  "responseTime": -1,
                                  "availability": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.message", containsString("cpuUsage")))
                .andExpect(jsonPath("$.message", containsString("responseTime")));

        assertThat(metricRepository.count()).isZero();
        assertThat(monitoredSystemRepository.findById(monitoredSystem.getId()))
                .get()
                .extracting(MonitoredSystem::getStatus)
                .isEqualTo(HealthStatus.HEALTHY);
    }

    @Test
    void healthyReadingRestoresPreviouslyCriticalSystem() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Recovered API", HealthStatus.CRITICAL);

        mockMvc.perform(post("/api/systems/{systemId}/metrics", monitoredSystem.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cpuUsage": 30.00,
                                  "memoryUsage": 40.00,
                                  "responseTime": 120,
                                  "availability": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.systemStatus").value("HEALTHY"));

        assertThat(monitoredSystemRepository.findById(monitoredSystem.getId()))
                .get()
                .extracting(MonitoredSystem::getStatus)
                .isEqualTo(HealthStatus.HEALTHY);
    }

    @Test
    void returnsNotFoundWhenSubmittingMetricForUnknownSystem() throws Exception {
        mockMvc.perform(post("/api/systems/{systemId}/metrics", 999999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cpuUsage": 20.00,
                                  "memoryUsage": 30.00,
                                  "responseTime": 100,
                                  "availability": true
                                }
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.message").value(
                        "Monitored system 999999 was not found"));

        assertThat(metricRepository.count()).isZero();
    }

    private MonitoredSystem createSystem(String name) {
        return createSystem(name, HealthStatus.HEALTHY);
    }

    private MonitoredSystem createSystem(String name, HealthStatus status) {
        return monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                name,
                "SERVICE",
                name.toLowerCase().replace(' ', '-') + ".internal.example",
                status,
                null));
    }
}
