package au.edu.sydney.elec5619.dashboard.alert;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;

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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "alert-test-user", roles = "OPERATIONS")
class AlertIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Test
    void abnormalMetricCreatesAlertsForEveryExceededThreshold() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Checkout API");

        submitMetric(monitoredSystem.getId(), "92.00", "80.00", 1200L, true);

        List<Alert> alerts = alertRepository
                .findByMonitoredSystemIdOrderByCreatedTimeDesc(monitoredSystem.getId());

        assertThat(alerts)
                .extracting(Alert::getAlertType, Alert::getSeverity, Alert::getStatus)
                .containsExactlyInAnyOrder(
                        tuple("HIGH_CPU", AlertSeverity.CRITICAL, AlertStatus.ACTIVE),
                        tuple("HIGH_MEMORY", AlertSeverity.WARNING, AlertStatus.ACTIVE),
                        tuple("SLOW_RESPONSE", AlertSeverity.CRITICAL, AlertStatus.ACTIVE));
    }

    @Test
    void unavailableMetricCreatesOnlyServiceUnavailableAlert() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Legacy CRM");

        submitMetric(monitoredSystem.getId(), "99.00", "99.00", 5000L, false);

        List<Alert> alerts = alertRepository
                .findByMonitoredSystemIdOrderByCreatedTimeDesc(monitoredSystem.getId());
        assertThat(alerts).singleElement().satisfies(alert -> {
            assertThat(alert.getAlertType()).isEqualTo("SERVICE_UNAVAILABLE");
            assertThat(alert.getSeverity()).isEqualTo(AlertSeverity.CRITICAL);
            assertThat(alert.getStatus()).isEqualTo(AlertStatus.ACTIVE);
        });
    }

    @Test
    void healthyMetricDoesNotCreateAlert() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Healthy API");

        submitMetric(monitoredSystem.getId(), "30.00", "40.00", 120L, true);

        assertThat(alertRepository
                .findByMonitoredSystemIdOrderByCreatedTimeDesc(monitoredSystem.getId()))
                .isEmpty();
    }

    @Test
    void repeatedConditionEscalatesOpenAlertInsteadOfCreatingDuplicate() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Orders API");

        submitMetric(monitoredSystem.getId(), "80.00", "40.00", 100L, true);
        Alert originalAlert = alertRepository
                .findByMonitoredSystemIdOrderByCreatedTimeDesc(monitoredSystem.getId())
                .getFirst();
        originalAlert.changeStatus(AlertStatus.ACKNOWLEDGED);
        alertRepository.saveAndFlush(originalAlert);

        submitMetric(monitoredSystem.getId(), "95.00", "40.00", 100L, true);

        List<Alert> alerts = alertRepository
                .findByMonitoredSystemIdOrderByCreatedTimeDesc(monitoredSystem.getId());
        assertThat(alerts).singleElement().satisfies(alert -> {
            assertThat(alert.getId()).isEqualTo(originalAlert.getId());
            assertThat(alert.getSeverity()).isEqualTo(AlertSeverity.CRITICAL);
            assertThat(alert.getStatus()).isEqualTo(AlertStatus.ACTIVE);
            assertThat(alert.getMessage()).contains("critical threshold");
        });
    }

    @Test
    void listsFilteredAlertsAndUpdatesTheirStatus() throws Exception {
        MonitoredSystem firstSystem = createSystem("Customer API");
        MonitoredSystem secondSystem = createSystem("Billing API");
        Alert activeAlert = alertRepository.saveAndFlush(new Alert(
                firstSystem,
                "HIGH_CPU",
                AlertSeverity.WARNING,
                "CPU usage reached the warning threshold",
                AlertStatus.ACTIVE,
                Instant.parse("2026-08-28T01:05:00Z")));
        alertRepository.saveAndFlush(new Alert(
                firstSystem,
                "SLOW_RESPONSE",
                AlertSeverity.WARNING,
                "Response time reached the warning threshold",
                AlertStatus.RESOLVED,
                Instant.parse("2026-08-28T01:00:00Z")));
        alertRepository.saveAndFlush(new Alert(
                secondSystem,
                "HIGH_MEMORY",
                AlertSeverity.CRITICAL,
                "Memory usage reached the critical threshold",
                AlertStatus.ACTIVE,
                Instant.parse("2026-08-28T01:10:00Z")));

        mockMvc.perform(get("/api/alerts")
                        .param("status", "ACTIVE")
                        .param("systemId", firstSystem.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].alertId").value(activeAlert.getId()))
                .andExpect(jsonPath("$.data[0].systemName").value("Customer API"))
                .andExpect(jsonPath("$.data[0].alertType").value("HIGH_CPU"));

        mockMvc.perform(patch("/api/alerts/{alertId}/acknowledge", activeAlert.getId())
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACKNOWLEDGED"));

        mockMvc.perform(patch("/api/alerts/{alertId}/resolve", activeAlert.getId())
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"));

        assertThat(alertRepository.findById(activeAlert.getId()))
                .get()
                .extracting(Alert::getStatus)
                .isEqualTo(AlertStatus.RESOLVED);
    }

    @Test
    void rejectsAcknowledgingResolvedAlertAndReturnsNotFoundForUnknownAlert() throws Exception {
        MonitoredSystem monitoredSystem = createSystem("Resolved API");
        Alert resolvedAlert = alertRepository.saveAndFlush(new Alert(
                monitoredSystem,
                "HIGH_CPU",
                AlertSeverity.WARNING,
                "CPU usage reached the warning threshold",
                AlertStatus.RESOLVED,
                Instant.now()));

        mockMvc.perform(patch("/api/alerts/{alertId}/acknowledge", resolvedAlert.getId())
                        .with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(
                        "Alert " + resolvedAlert.getId()
                                + " cannot change from RESOLVED to ACKNOWLEDGED"));

        mockMvc.perform(patch("/api/alerts/{alertId}/resolve", 999999L)
                        .with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Alert 999999 was not found"));
    }

    private MonitoredSystem createSystem(String name) {
        return monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                name,
                "SERVICE",
                name.toLowerCase().replace(' ', '-') + ".internal.example",
                HealthStatus.HEALTHY,
                null));
    }

    private void submitMetric(
            Long systemId,
            String cpuUsage,
            String memoryUsage,
            Long responseTime,
            boolean availability) throws Exception {
        mockMvc.perform(post("/api/systems/{systemId}/metrics", systemId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "cpuUsage": %s,
                                  "memoryUsage": %s,
                                  "responseTime": %d,
                                  "availability": %s
                                }
                                """.formatted(
                                cpuUsage,
                                memoryUsage,
                                responseTime,
                                availability)))
                .andExpect(status().isCreated());
    }
}
