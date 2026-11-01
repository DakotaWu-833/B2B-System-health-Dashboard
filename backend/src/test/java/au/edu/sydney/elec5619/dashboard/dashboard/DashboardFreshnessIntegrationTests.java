package au.edu.sydney.elec5619.dashboard.dashboard;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "app.metrics.stale-after=PT30S")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "freshness-test-user", roles = "OPERATIONS")
class DashboardFreshnessIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private MetricRepository metricRepository;

    @Test
    void dashboardListDetailsAndUpdatesHonorTheSameOverriddenFreshnessWindow() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem stale = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Stale", "SERVICE", "stale.example", HealthStatus.HEALTHY, null));
        MonitoredSystem fresh = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Fresh", "SERVICE", "fresh.example", HealthStatus.HEALTHY, null));
        MonitoredSystem missing = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Missing", "SERVICE", "missing.example", HealthStatus.HEALTHY, null));
        metricRepository.saveAndFlush(new Metric(
                stale, new BigDecimal("60.00"), new BigDecimal("60.00"), 300L,
                true, now.minusSeconds(60)));
        metricRepository.saveAndFlush(new Metric(
                fresh, new BigDecimal("20.00"), new BigDecimal("30.00"), 100L,
                true, now));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(3))
                .andExpect(jsonPath("$.data.healthy").value(2))
                .andExpect(jsonPath("$.data.offline").value(0))
                .andExpect(jsonPath("$.data.noData").value(1))
                .andExpect(jsonPath("$.data.freshReadingCount").value(1))
                .andExpect(jsonPath("$.data.staleReadingCount").value(1))
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(30.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(100.0));

        mockMvc.perform(get("/api/systems"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(stale.getId()))
                .andExpect(jsonPath("$.data[0].metricDataStatus").value("STALE"))
                .andExpect(jsonPath("$.data[1].id").value(fresh.getId()))
                .andExpect(jsonPath("$.data[1].metricDataStatus").value("FRESH"))
                .andExpect(jsonPath("$.data[2].id").value(missing.getId()))
                .andExpect(jsonPath("$.data[2].metricDataStatus").value("NO_DATA"));

        mockMvc.perform(get("/api/systems/{id}", stale.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("STALE"))
                .andExpect(jsonPath("$.data.evaluatedThresholds.cpuWarning").value(75.0));
        mockMvc.perform(get("/api/systems/{id}", fresh.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"));
        mockMvc.perform(get("/api/systems/{id}", missing.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("NO_DATA"));

        mockMvc.perform(put("/api/systems/{id}", stale.getId()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Stale updated","type":"SERVICE","host":"stale.example"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Stale updated"))
                .andExpect(jsonPath("$.data.metricDataStatus").value("STALE"));
    }
}
