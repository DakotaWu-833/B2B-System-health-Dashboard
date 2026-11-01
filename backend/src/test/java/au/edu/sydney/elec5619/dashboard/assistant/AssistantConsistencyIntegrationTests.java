package au.edu.sydney.elec5619.dashboard.assistant;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import au.edu.sydney.elec5619.dashboard.alert.*;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.metric.MetricRepository;
import au.edu.sydney.elec5619.dashboard.system.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {"app.ai.enabled=true", "app.ai.embedding-model="})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AssistantConsistencyIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired MonitoredSystemRepository systems;
    @Autowired MetricRepository metrics;
    @Autowired AlertRepository alerts;
    @Autowired AlertService alertService;
    @Autowired AgentService agent;
    @Autowired AgentProposalRepository proposalRepository;
    @MockitoBean OllamaClient model;
    private MonitoredSystem system;
    private Alert active;

    @BeforeEach void setup() {
        system = systems.saveAndFlush(new MonitoredSystem("Consistency API", "SERVICE", "consistency.test", HealthStatus.HEALTHY, null));
        active = alerts.saveAndFlush(new Alert(system, "HIGH_CPU", AlertSeverity.WARNING, "Historical CPU warning", AlertStatus.ACTIVE, Instant.now().minusSeconds(600)));
        when(model.chat(anyList(), anyList(), eq(true), any())).thenReturn(answer("Observed current context [T1]"));
    }

    @Test void archivedAndOrdinaryViewsProvideDifferentServerEvidence() throws Exception {
        Alert archived = archivedAlert();
        chat(Map.of("page", "alerts", "archived", true))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.contextLabel").value("Archived alerts"))
                .andExpect(jsonPath("$.data.observations[0].data.totalElements").value(1))
                .andExpect(jsonPath("$.data.observations[0].data.items[0].alertId").value(archived.getId()))
                .andExpect(jsonPath("$.data.observations[0].data.items[0].archived").value(true));
        chat(Map.of("page", "alerts", "archived", false))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.contextLabel").value("Alert Center"))
                .andExpect(jsonPath("$.data.observations[0].data.totalElements").value(1))
                .andExpect(jsonPath("$.data.observations[0].data.items[0].alertId").value(active.getId()));
        assertThat(active.getStatus()).isEqualTo(AlertStatus.ACTIVE);
        assertThat(archived.getStatus()).isEqualTo(AlertStatus.RESOLVED);
    }

    @Test void emptyArchiveNeverFallsBackToOrdinaryAlerts() throws Exception {
        chat(Map.of("page", "alerts", "archived", true))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.observations[0].data.items").isEmpty())
                .andExpect(jsonPath("$.data.observations[0].data.totalElements").value(0));
        assertThat(alerts.findById(active.getId())).isPresent();
    }

    @Test void selectedArchivedAlertCanBeInspectedAndLegacySelectionInfersItsView() throws Exception {
        Alert archived = archivedAlert();
        for (boolean explicit : List.of(false, true)) {
            Map<String, Object> scope = new HashMap<>(Map.of("page", "alerts", "alertId", archived.getId()));
            if (explicit) scope.put("archived", true);
            chat(scope).andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.observations[0].data.alertId").value(archived.getId()))
                    .andExpect(jsonPath("$.data.observations[0].data.archived").value(true))
                    .andExpect(jsonPath("$.data.observations[1].data.currentAvailability").value("UNKNOWN"));
        }
    }

    @Test void inconsistentArchiveScopeIsRejectedBeforeInference() throws Exception {
        Alert archived = archivedAlert();
        chat(Map.of("page", "alerts", "alertId", active.getId(), "archived", true)).andExpect(status().isBadRequest());
        chat(Map.of("page", "alerts", "alertId", archived.getId(), "archived", false)).andExpect(status().isBadRequest());
        chat(Map.of("page", "dashboard", "archived", true)).andExpect(status().isBadRequest());
        verifyNoInteractions(model);
    }

    @Test void staleDashboardCannotClaimFreshDataEvenWithValidReferences() throws Exception {
        staleReading();
        when(model.chat(anyList(), anyList(), eq(true), any())).thenReturn(answer("Data freshness is confirmed for these observations. [T1]"));
        chat(Map.of("page", "dashboard"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("unverified_answer"))
                .andExpect(jsonPath("$.data.answer").isEmpty())
                .andExpect(jsonPath("$.data.observations[0].data.freshReadingCount").value(0))
                .andExpect(jsonPath("$.data.observations[0].data.staleReadingCount").value(1))
                .andExpect(jsonPath("$.data.freshnessNotice").isNotEmpty());
        verify(model, times(2)).chat(anyList(), anyList(), eq(true), any());
    }

    @Test void missingReadingsCannotBeReportedAsHealthyByTheModel() throws Exception {
        when(model.chat(anyList(), anyList(), eq(true), any())).thenReturn(answer("The dashboard has 1 healthy system and 0 systems with no data. [T1]"));
        chat(Map.of("page", "dashboard"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("unverified_answer"))
                .andExpect(jsonPath("$.data.answer").isEmpty())
                .andExpect(jsonPath("$.data.observations[0].data.healthy").value(0))
                .andExpect(jsonPath("$.data.observations[0].data.noData").value(1));
    }

    @Test void safeUnknownAvailabilityExplanationIsAcceptedAndIncludedInThePrompt() throws Exception {
        staleReading();
        when(model.chat(anyList(), anyList(), eq(true), any())).thenReturn(answer("There are no fresh readings. Current availability is unknown; health is the last reported state. [T1]"));
        chat(Map.of("page", "dashboard")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("generated_with_sources"));
        verify(model).chat(argThat(messages -> messages.toString().contains("Server-verified operational facts")
                && messages.toString().contains("freshReadingCount")), anyList(), eq(true), any());
    }

    @Test void oneCorrectionCanRepairAContradictoryAnswer() throws Exception {
        staleReading();
        when(model.chat(anyList(), anyList(), eq(true), any())).thenReturn(
                answer("Data freshness is confirmed for these observations. [T1]"),
                answer("No fresh readings are available; current availability is unknown. [T1]"));
        chat(Map.of("page", "dashboard")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("generated_with_sources"));
        verify(model, times(2)).chat(anyList(), anyList(), eq(true), any());
    }

    @Test void anAgentCannotConvertStaleReadingsIntoConfirmedCurrentDowntime() {
        staleReading();
        when(model.chat(anyList(), anyList(), anyBoolean(), any())).thenReturn(mapper.valueToTree(Map.of("content",
                "{\"summary\":\"The system is currently down. [T1]\",\"evidenceIds\":[\"T1\"]}")));
        var auth = new UsernamePasswordAuthenticationToken("consistency-ops", "", List.of(new SimpleGrantedAuthority("ROLE_OPERATIONS")));
        var report = agent.diagnose("Explain current availability", system.getId(), auth);
        assertThat(report.status()).isEqualTo("unverified_answer");
        assertThat(report.summary()).isNull();
        assertThat(report.proposals()).isEmpty();
        assertThat(active.getStatus()).isEqualTo(AlertStatus.ACTIVE);
    }

    @Test void contradictoryFinalReportDoesNotPersistToolDrafts() {
        staleReading();
        long initialProposals = proposalRepository.count();
        JsonNode invalidReport = mapper.valueToTree(Map.of("content",
                "{\"summary\":\"The system is currently down. [T1]\",\"evidenceIds\":[\"T1\"]}"));
        when(model.chat(anyList(), anyList(), anyBoolean(), any())).thenReturn(
                tool("list_alerts", Map.of()),
                tool("propose_alert_action", Map.of("alertId", active.getId(), "action", "ACKNOWLEDGE", "reason", "Inspect the historical warning")),
                invalidReport, invalidReport);
        var auth = new UsernamePasswordAuthenticationToken("consistency-ops", "", List.of(new SimpleGrantedAuthority("ROLE_OPERATIONS")));
        var report = agent.diagnose("Inspect this alert", system.getId(), auth);
        assertThat(report.trace()).anySatisfy(step -> {
            assertThat(step.tool()).isEqualTo("propose_alert_action");
            assertThat(step.output().path("draftOnly").asBoolean()).isTrue();
        });
        assertThat(report.status()).isEqualTo("unverified_answer");
        assertThat(report.proposals()).isEmpty();
        assertThat(proposalRepository.count()).isEqualTo(initialProposals);
        assertThat(active.getStatus()).isEqualTo(AlertStatus.ACTIVE);
    }

    private org.springframework.test.web.servlet.ResultActions chat(Map<String, Object> scope) throws Exception {
        return mvc.perform(post("/api/assistant/chat").with(user("consistency-ops").roles("OPERATIONS")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("question", "Explain the current view", "context", scope, "mode", "CHAT", "history", List.of()))));
    }
    private JsonNode answer(String text) { return mapper.valueToTree(Map.of("content", mapper.createObjectNode().put("answer", text).set("citationIds", mapper.valueToTree(List.of("T1"))).toString())); }
    private JsonNode tool(String name, Map<String, Object> arguments) {
        return mapper.valueToTree(Map.of("role", "assistant", "content", "", "tool_calls",
                List.of(Map.of("function", Map.of("name", name, "arguments", arguments)))));
    }
    private Alert archivedAlert() {
        Alert alert = alerts.saveAndFlush(new Alert(system, "HIGH_MEMORY", AlertSeverity.WARNING, "Resolved monitoring event", AlertStatus.RESOLVED, Instant.now().minusSeconds(300)));
        alertService.archive(alert.getId());
        return alert;
    }
    private void staleReading() {
        metrics.saveAndFlush(new Metric(system, new BigDecimal("44"), new BigDecimal("54"), 130L, true, Instant.now().minusSeconds(600)));
    }
}
