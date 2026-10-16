package au.edu.sydney.elec5619.dashboard.dashboard;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    void dashboardAndDetailsHonorTheSameOverriddenFreshnessWindow() throws Exception {
        Instant now = Instant.now();
        MonitoredSystem stale = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Stale", "SERVICE", "stale.example", HealthStatus.HEALTHY, null));
        MonitoredSystem fresh = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Fresh", "SERVICE", "fresh.example", HealthStatus.HEALTHY, null));
        metricRepository.saveAndFlush(new Metric(
                stale, new BigDecimal("60.00"), new BigDecimal("60.00"), 300L,
                true, now.minusSeconds(60)));
        metricRepository.saveAndFlush(new Metric(
                fresh, new BigDecimal("20.00"), new BigDecimal("30.00"), 100L,
                true, now));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.averageCpuUsage").value(20.0))
                .andExpect(jsonPath("$.data.averageMemoryUsage").value(30.0))
                .andExpect(jsonPath("$.data.averageResponseTime").value(100.0));

        mockMvc.perform(get("/api/systems/{id}", stale.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("STALE"));
        mockMvc.perform(get("/api/systems/{id}", fresh.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"));
    }
}
