package au.edu.sydney.elec5619.dashboard.system;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@WithMockUser(username = "system-management-test-user", roles = "OPERATIONS")
class SystemManagementIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MonitoredSystemRepository monitoredSystemRepository;

    @Autowired
    private au.edu.sydney.elec5619.dashboard.metric.MetricRepository metricRepository;

    @Test
    void metadataUpdatePreservesLatestReadingAndReturnsIt() throws Exception {
        MonitoredSystem system = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Before", "SERVICE", "before.example", HealthStatus.WARNING, "Old description"));
        java.time.Instant timestamp = java.time.Instant.now()
                .truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        var metric = metricRepository.saveAndFlush(new au.edu.sydney.elec5619.dashboard.metric.Metric(
                system, new java.math.BigDecimal("80"), new java.math.BigDecimal("35"),
                150L, true, timestamp));
        mockMvc.perform(put("/api/systems/{id}", system.getId()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("After", "after.example")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("After"))
                .andExpect(jsonPath("$.data.status").value("WARNING"))
                .andExpect(jsonPath("$.data.latestMetric.metricId").value(metric.getId()))
                .andExpect(jsonPath("$.data.lastUpdated").value(timestamp.toString()))
                .andExpect(jsonPath("$.data.metricDataStatus").value("FRESH"));
        assertThat(metricRepository.count()).isEqualTo(1);
    }

    @Test
    void operationsUserCreatesSystemWithSafeInitialStatus() throws Exception {
        mockMvc.perform(post("/api/systems")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest(" Orders API ", "orders.internal.example")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.name").value("Orders API"))
                .andExpect(jsonPath("$.data.status").value("HEALTHY"))
                .andExpect(jsonPath("$.message").value("System created successfully"));

        assertThat(monitoredSystemRepository.findAll())
                .singleElement()
                .satisfies(system -> {
                    assertThat(system.getName()).isEqualTo("Orders API");
                    assertThat(system.getStatus()).isEqualTo(HealthStatus.HEALTHY);
                });
    }

    @Test
    void managementUserCannotCreateSystem() throws Exception {
        mockMvc.perform(post("/api/systems")
                        .with(user("management-test-user").roles("MANAGEMENT"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("Orders API", "orders.internal.example")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Access denied"));

        assertThat(monitoredSystemRepository.count()).isZero();
    }

    @Test
    void managementUserRetainsReadOnlySystemAccess() throws Exception {
        MonitoredSystem system = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Orders API",
                "SERVICE",
                "orders.internal.example",
                HealthStatus.HEALTHY,
                null));

        mockMvc.perform(get("/api/systems/{systemId}", system.getId())
                        .with(user("management-test-user").roles("MANAGEMENT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(system.getId()));
    }

    @Test
    @WithAnonymousUser
    void anonymousUserCannotReadOrManageSystems() throws Exception {
        mockMvc.perform(get("/api/systems"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required"));

        mockMvc.perform(post("/api/systems")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("Orders API", "orders.internal.example")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required"));
    }

    @Test
    void systemMutationRequiresCsrfToken() throws Exception {
        mockMvc.perform(post("/api/systems")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("Orders API", "orders.internal.example")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied"));

        assertThat(monitoredSystemRepository.count()).isZero();
    }

    @Test
    void rejectsInvalidSystemWithoutChangingDatabase() throws Exception {
        mockMvc.perform(post("/api/systems")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": " ",
                                  "type": "SERVICE",
                                  "host": " ",
                                  "description": null
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message", containsString("host")))
                .andExpect(jsonPath("$.message", containsString("name")));

        assertThat(monitoredSystemRepository.count()).isZero();
    }

    @Test
    void operationsUserUpdatesDetailsWithoutOverwritingCalculatedStatus() throws Exception {
        MonitoredSystem system = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Old name",
                "SERVICE",
                "old.internal.example",
                HealthStatus.CRITICAL,
                "Old description"));

        mockMvc.perform(put("/api/systems/{systemId}", system.getId())
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("New name", "new.internal.example")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("New name"))
                .andExpect(jsonPath("$.data.host").value("new.internal.example"))
                .andExpect(jsonPath("$.data.status").value("CRITICAL"))
                .andExpect(jsonPath("$.message").value("System updated successfully"));

        MonitoredSystem updated = monitoredSystemRepository.findById(system.getId()).orElseThrow();
        assertThat(updated.getName()).isEqualTo("New name");
        assertThat(updated.getStatus()).isEqualTo(HealthStatus.CRITICAL);
    }

    @Test
    void managementUserCannotUpdateSystem() throws Exception {
        MonitoredSystem system = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Orders API",
                "SERVICE",
                "orders.internal.example",
                HealthStatus.HEALTHY,
                null));

        mockMvc.perform(put("/api/systems/{systemId}", system.getId())
                        .with(user("management-test-user").roles("MANAGEMENT"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("Changed", "changed.internal.example")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Access denied"));

        assertThat(monitoredSystemRepository.findById(system.getId()))
                .get()
                .extracting(MonitoredSystem::getName)
                .isEqualTo("Orders API");
    }

    @Test
    void returnsNotFoundWhenUpdatingUnknownSystem() throws Exception {
        mockMvc.perform(put("/api/systems/{systemId}", 999999L)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("Unknown", "unknown.internal.example")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Monitored system 999999 was not found"));
    }

    @Test
    void createdSystemDetailsExplicitlyReportNoMetrics() throws Exception {
        String body = mockMvc.perform(post("/api/systems").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("New system", "new.example")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(body)
                .path("data").path("id").asLong();
        mockMvc.perform(get("/api/systems/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metricDataStatus").value("NO_DATA"));
    }

    @Test
    void invalidUpdatePreservesExistingDetails() throws Exception {
        MonitoredSystem system = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Original", "SERVICE", "original.example", HealthStatus.WARNING, null));
        mockMvc.perform(put("/api/systems/{id}", system.getId()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest(" ", "changed.example")))
                .andExpect(status().isBadRequest());
        assertThat(monitoredSystemRepository.findById(system.getId()).orElseThrow().getName())
                .isEqualTo("Original");
    }

    @Test
    void updateRequiresValidCsrfAndDoesNotChangeData() throws Exception {
        MonitoredSystem system = monitoredSystemRepository.saveAndFlush(new MonitoredSystem(
                "Original", "SERVICE", "original.example", HealthStatus.WARNING, null));
        mockMvc.perform(put("/api/systems/{id}", system.getId()).with(csrf().useInvalidToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("Changed", "changed.example")))
                .andExpect(status().isForbidden());
        assertThat(monitoredSystemRepository.findById(system.getId()).orElseThrow().getName())
                .isEqualTo("Original");
    }

    @Test
    void rejectsFieldsExceedingSchemaLimits() throws Exception {
        mockMvc.perform(post("/api/systems").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validRequest("x".repeat(121), "host.example")))
                .andExpect(status().isBadRequest());
        assertThat(monitoredSystemRepository.count()).isZero();
    }

    private String validRequest(String name, String host) {
        return """
                {
                  "name": "%s",
                  "type": "SERVICE",
                  "host": "%s",
                  "description": "Business-critical service"
                }
                """.formatted(name, host);
    }
}
