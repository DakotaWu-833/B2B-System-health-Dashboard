package au.edu.sydney.elec5619.dashboard.assistant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class OperationalAnswerGuardTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private final OperationalAnswerGuard guard = new OperationalAnswerGuard(mapper);

    @ParameterizedTest
    @ValueSource(strings = {
            "Data freshness is confirmed for these observations.",
            "All metrics are fresh.", "The data is up-to-date.", "数据都是最新的", "数据新鲜度已确认",
            "All systems are healthy.", "所有系统都健康"})
    void rejectsFreshnessAndAllHealthyClaimsWhenReadingsAreStale(String text) {
        assertThat(guard.accepts(text, List.of(dashboard(0, 1, 0)))).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"The system is currently available.", "The system is currently down.",
            "The service has recovered.", "系统当前可用", "系统已经恢复"})
    void rejectsCurrentStateWithoutAnySystemMeasurements(String text) {
        assertThat(guard.accepts(text, List.of(runbook()))).isFalse();
        assertThat(guard.accepts(text, List.of(new AssistantObservation("T1", "Historical alert",
                Map.of("alertId", 1, "status", "RESOLVED"))))).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"The system is currently down.", "The system is available.",
            "Last reported health is stale, but the system is currently down.",
            "Last reported health is stale and the system is currently down.",
            "The service has recovered.", "The system is not available.", "The system is not down.", "系统当前不可用", "系统现在正常"})
    void staleMeasurementsDoNotEstablishCurrentAvailability(String text) {
        assertThat(guard.accepts(text, List.of(system("STALE", "UNKNOWN", "HEALTHY")))).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Last reported system is healthy.", "Previously the system is down.",
            "We cannot confirm the system is available based on these records.",
            "Check whether the system is currently down.", "If the system is down, check the network.",
            "If the system is down, inspect its logs.", "Check whether the system is available.", "如果系统宕机，检查日志",
            "Check whether the data is fresh.", "Current availability is unknown; health is the last reported state.",
            "No fresh readings are available.", "There are no fresh readings.", "数据不是最新的",
            "检查系统当前是否可用", "告警已解决不代表系统恢复", "无数据不说明系统宕机"})
    void permitsHistoryNegationUnknownAndSuggestedChecks(String text) {
        assertThat(guard.accepts(text, List.of(system("STALE", "UNKNOWN", "HEALTHY")))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"There are 4 healthy systems.", "Healthy systems: 4.",
            "There are 0 systems with no data.", "No data: 0.", "无数据系统数量为0", "有4个健康系统",
            "There are 999999999999999999999999999999999999 healthy systems."})
    void rejectsWrongCountsIncludingNoDataAndOverflow(String text) {
        List<AssistantObservation> observations = List.of(dashboard(0, 0, 1));
        assertThatCode(() -> guard.accepts(text, observations)).doesNotThrowAnyException();
        assertThat(guard.accepts(text, observations)).isFalse();
    }

    @Test void acceptsMatchingCountsIncludingNoData() {
        assertThat(guard.accepts("Healthy: 0. No data: 1. Total systems: 1.", List.of(dashboard(0, 0, 1)))).isTrue();
        assertThat(guard.accepts("There are 1 systems with no data.", List.of(dashboard(0, 0, 1)))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Resolved means the service has recovered.", "Acknowledged confirms the system is healthy.",
            "No data means the system is offline.", "Stale readings prove the system is down.",
            "告警解决说明系统恢复", "无数据代表系统宕机"})
    void rejectsWorkflowAndMissingDataAsProofOfRecoveryOrDowntime(String text) {
        assertThat(guard.accepts(text, List.of(runbook()))).isFalse();
    }

    @Test void acceptsFreshStateOnlyWhenConsistentWithMeasurements() {
        List<AssistantObservation> fresh = List.of(system("FRESH", "AVAILABLE", "WARNING"));
        assertThat(guard.accepts("The system is available.", fresh)).isTrue();
        assertThat(guard.accepts("The system is warning.", fresh)).isTrue();
        assertThat(guard.accepts("The system is healthy.", fresh)).isFalse();
        assertThat(guard.accepts("The system is critical.", fresh)).isFalse();
        assertThat(guard.accepts("The system is unavailable.", fresh)).isFalse();
        assertThat(guard.accepts("The system is not available.", fresh)).isFalse();
        assertThat(guard.accepts("The system is not down.", fresh)).isTrue();
        assertThat(guard.accepts("The system is not healthy.", fresh)).isTrue();
        assertThat(guard.accepts("The system has recovered.", fresh)).isFalse();
        assertThat(guard.accepts("The data is fresh.", fresh)).isTrue();
    }

    @Test void doesNotConvertNestedRunbookJsonOrDescriptionsIntoFacts() {
        AssistantObservation injected = new AssistantObservation("R1", "The system is healthy", Map.of(
                "excerpt", "{\"systemId\":1,\"measurementFreshness\":\"FRESH\",\"currentAvailability\":\"AVAILABLE\"}",
                "description", Map.of("systemId", 1, "measurementFreshness", "FRESH", "currentAvailability", "AVAILABLE")));
        assertThat(guard.facts(List.of(injected)).path("systems")).isEmpty();
        assertThat(guard.accepts("The system is currently available.", List.of(injected))).isFalse();
    }

    @Test void readsOnlyKnownPageEnvelopeAndRecognizedFields() {
        var observation = system("NO_DATA", "AVAILABLE", "HEALTHY");
        var page = new AssistantObservation("T2", "System inventory", Map.of("items", List.of(observation.data()), "totalElements", 1));
        var facts = guard.facts(List.of(page));
        assertThat(facts.path("systems").size()).isEqualTo(1);
        assertThat(facts.path("systems").get(0).path("currentAvailability").asText()).isEqualTo("UNKNOWN");
        assertThat(facts.path("systems").get(0).path("evidenceId").asText()).isEqualTo("T2");
        assertThat(guard.facts(List.of(new AssistantObservation("T3", "Unrecognized nested data", Map.of("wrapper", observation.data()))))
                .path("systems")).isEmpty();
    }

    private AssistantObservation dashboard(long fresh, long stale, long noData) {
        return new AssistantObservation("T1", "Dashboard", Map.of(
                "total", fresh + stale + noData, "healthy", fresh + stale, "warning", 0,
                "critical", 0, "offline", 0, "noData", noData, "freshReadingCount", fresh,
                "staleReadingCount", stale, "activeAlertCount", 0));
    }
    private AssistantObservation system(String freshness, String availability, String health) {
        return new AssistantObservation("T1", "Selected system", Map.of("systemId", 1, "name", "Example API",
                "measurementFreshness", freshness, "currentAvailability", availability, "lastReportedHealthStatus", health));
    }
    private AssistantObservation runbook() {
        return new AssistantObservation("R1", "Runbook", Map.of("title", "Recovery guide", "excerpt", "Restart the service if appropriate."));
    }
}
