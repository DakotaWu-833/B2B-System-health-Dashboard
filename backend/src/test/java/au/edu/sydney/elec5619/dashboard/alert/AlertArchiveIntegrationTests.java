package au.edu.sydney.elec5619.dashboard.alert;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import au.edu.sydney.elec5619.dashboard.system.HealthStatus;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
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
@WithMockUser(roles = "OPERATIONS")
class AlertArchiveIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired AlertRepository alerts;
    @Autowired MonitoredSystemRepository systems;

    @Test
    void archiveAndUndoPersistWithoutChangingResolutionAndCanBeRepeated() throws Exception {
        Alert alert = createAlert(AlertStatus.RESOLVED);
        for (int repeat = 0; repeat < 2; repeat++) {
            mvc.perform(patch("/api/alerts/{id}/archive", alert.getId()).with(csrf()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.archived").value(true))
                    .andExpect(jsonPath("$.data.status").value("RESOLVED"));
        }
        mvc.perform(get("/api/alerts").param("systemId", alert.getMonitoredSystem().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(0));
        mvc.perform(get("/api/alerts").param("archived", "true").param("status", "RESOLVED")
                        .param("systemId", alert.getMonitoredSystem().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].alertId").value(alert.getId()));
        assertThat(alerts.findById(alert.getId()).orElseThrow().isArchived()).isTrue();
        for (int repeat = 0; repeat < 2; repeat++) {
            mvc.perform(patch("/api/alerts/{id}/unarchive", alert.getId()).with(csrf()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.archived").value(false))
                    .andExpect(jsonPath("$.data.status").value("RESOLVED"));
        }
        mvc.perform(get("/api/alerts").param("systemId", alert.getMonitoredSystem().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        mvc.perform(get("/api/alerts").param("archived", "true")
                        .param("systemId", alert.getMonitoredSystem().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(0));
        assertThat(alerts.findById(alert.getId()).orElseThrow().isArchived()).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = AlertStatus.class, names = {"ACTIVE", "ACKNOWLEDGED"})
    void unresolvedAlertsCannotBeArchivedOrRestored(AlertStatus current) throws Exception {
        Alert alert = createAlert(current);
        for (String action : new String[]{"archive", "unarchive"}) {
            mvc.perform(patch("/api/alerts/{id}/{action}", alert.getId(), action).with(csrf()))
                    .andExpect(status().isConflict());
        }
        assertThat(alerts.findById(alert.getId()).orElseThrow().getStatus()).isEqualTo(current);
        assertThat(alerts.findById(alert.getId()).orElseThrow().isArchived()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"archive", "unarchive"})
    void archiveWritesRequireCsrfAndUnknownAlertsReturn404(String action) throws Exception {
        Alert alert = createAlert(AlertStatus.RESOLVED);
        mvc.perform(patch("/api/alerts/{id}/{action}", alert.getId(), action)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/alerts/{id}/{action}", 999999L, action).with(csrf())).andExpect(status().isNotFound());
        assertThat(alerts.findById(alert.getId()).orElseThrow().isArchived()).isFalse();
    }

    @Test
    void anArchivedResolvedIncidentDoesNotSuppressNewAlertsForTheSameSystem() throws Exception {
        Alert original = createAlert(AlertStatus.RESOLVED);
        mvc.perform(patch("/api/alerts/{id}/archive", original.getId()).with(csrf())).andExpect(status().isOk());
        mvc.perform(post("/api/systems/{id}/metrics", original.getMonitoredSystem().getId()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"cpuUsage":95,"memoryUsage":20,"responseTime":100,"availability":true}
                                """))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/alerts").param("systemId", original.getMonitoredSystem().getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.items[0].archived").value(false));
        assertThat(alerts.findById(original.getId()).orElseThrow().isArchived()).isTrue();
    }

    private Alert createAlert(AlertStatus status) {
        MonitoredSystem system = systems.saveAndFlush(new MonitoredSystem("Archive test API", "SERVICE", "archive.test", HealthStatus.HEALTHY, null));
        return alerts.saveAndFlush(new Alert(system, "HIGH_CPU", AlertSeverity.CRITICAL, "CPU needs review", status, Instant.now()));
    }
}
