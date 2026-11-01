package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Instant;
import java.util.*;
import au.edu.sydney.elec5619.dashboard.alert.*;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import au.edu.sydney.elec5619.dashboard.dashboard.DashboardService;
import au.edu.sydney.elec5619.dashboard.knowledge.KnowledgeService;
import au.edu.sydney.elec5619.dashboard.metric.*;
import au.edu.sydney.elec5619.dashboard.profile.ProfileService;
import au.edu.sydney.elec5619.dashboard.system.*;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChatContextService {
    public record Scope(@NotBlank @Pattern(regexp = "dashboard|system|alerts|profile|retention|assistant") String page,
                        @Positive Long systemId, @Positive Long alertId,
                        @Pattern(regexp = "ALL|ACTIVE|ACKNOWLEDGED|RESOLVED") String status) {}
    public record Snapshot(String label, Long systemId, List<AssistantObservation> observations, Instant capturedAt, String freshnessNotice) {}
    public record SystemEvidence(Long systemId, String name, String host, HealthStatus lastReportedHealthStatus,
                                 MetricDataStatus measurementFreshness, String currentAvailability,
                                 Instant lastMeasuredAt, MetricReadingResponse lastReportedReading,
                                 List<String> statusReasons, HealthThresholdProperties evaluatedThresholds) {}
    public record AlertEvidence(Long alertId, Long systemId, String systemName, String reportedCondition,
                                AlertSeverity severity, AlertStatus currentWorkflowStatus, String historicalMessage, Instant reportedAt) {}
    private final DashboardService dashboard;
    private final SystemService systems;
    private final AlertService alerts;
    private final AlertRepository alertRepository;
    private final MetricQueryService metrics;
    private final ProfileService profiles;
    private final MetricRetentionService retention;
    public ChatContextService(DashboardService dashboard, SystemService systems, AlertService alerts,
                              AlertRepository alertRepository, MetricQueryService metrics, ProfileService profiles,
                              MetricRetentionService retention) {
        this.dashboard = dashboard; this.systems = systems; this.alerts = alerts; this.alertRepository = alertRepository;
        this.metrics = metrics; this.profiles = profiles; this.retention = retention;
    }
    @Transactional(readOnly = true)
    public Snapshot load(Scope scope, Authentication auth) {
        String page = scope.page(); Long systemId = scope.systemId();
        if (scope.alertId() != null && !page.equals("alerts")) throw invalid("Select an alert from the Alert Center");
        if (systemId != null && !Set.of("system", "alerts").contains(page)) throw invalid("This page does not have a selected system");
        List<AssistantObservation> evidence = new ArrayList<>();
        String freshnessNotice = null;
        String label = switch (page) {
            case "dashboard" -> "Dashboard";
            case "system" -> "Systems";
            case "alerts" -> "Alert Center";
            case "profile" -> "My profile";
            case "retention" -> "Metric retention";
            default -> "Knowledge workspace";
        };
        if (scope.alertId() != null) {
            Alert alert = alertRepository.findById(scope.alertId()).orElseThrow(() -> new AlertNotFoundException(scope.alertId()));
            Long actual = alert.getMonitoredSystem().getId();
            if (systemId != null && !actual.equals(systemId)) throw invalid("Selected alert and system do not match");
            systemId = actual; add(evidence, "Selected alert: current workflow and historical monitoring event", new AlertEvidence(alert.getId(), actual,
                    alert.getMonitoredSystem().getName(), alert.getAlertType(), alert.getSeverity(), alert.getStatus(), alert.getMessage(), alert.getCreatedTime()));
            label += " · " + alert.getMonitoredSystem().getName() + " · Alert #" + alert.getId();
        }
        switch (page) {
            case "dashboard" -> {
                add(evidence, "Current dashboard summary", dashboard.getSummary());
                add(evidence, "Recent active alerts (up to 8)", alerts.getAlerts(AlertStatus.ACTIVE, null, 0, 8));
            }
            case "system", "alerts" -> {
                if (systemId != null) {
                    var system = systems.getSystem(systemId);
                    if (scope.alertId() == null) label += " · " + system.name();
                    boolean fresh = system.metricDataStatus() == MetricDataStatus.FRESH && system.latestMetric() != null;
                    String availability = fresh ? system.latestMetric().availability() ? "AVAILABLE" : "UNAVAILABLE" : "UNKNOWN";
                    add(evidence, "Selected system: last reported state and current evidence limits", new SystemEvidence(system.id(), system.name(), system.host(),
                            system.status(), system.metricDataStatus(), availability,
                            system.latestMetric() == null ? null : system.latestMetric().timestamp(), system.latestMetric(), system.statusReasons(), system.evaluatedThresholds()));
                    if (!fresh) freshnessNotice = "The latest measurements are " + (system.metricDataStatus() == MetricDataStatus.NO_DATA ? "missing" : "outdated")
                            + ". Current availability is unknown. Stored health and past alerts describe the last reported state, not confirmed current downtime.";
                    add(evidence, "Recent readings (up to 10, last seven days)", metrics.history(systemId, null, null, 10, null));
                } else if (page.equals("system")) {
                    add(evidence, "System inventory (first 10)", systems.getSystemsPage(0, 10));
                }
                AlertStatus filter = scope.status() == null || scope.status().equals("ALL") ? null : AlertStatus.valueOf(scope.status());
                add(evidence, "Recent alerts in the selected scope (up to 10)", alerts.getAlerts(filter, systemId, 0, 10));
            }
            case "profile" -> {
                var profile = profiles.current(auth.getName());
                // No email address, OTP, password or verification token is sent to the model.
                add(evidence, "Current account verification state", Map.of("role", profile.role(),
                        "emailConfigured", profile.email() != null, "emailVerified", profile.emailVerified()));
            }
            case "retention" -> {
                if (KnowledgeService.operations(auth)) add(evidence, "Read-only archive preview", retention.preview());
            }
            default -> { /* Knowledge excerpts are retrieved separately under the same role scope. */ }
        }
        add(evidence, "How to use this page", guide(page, KnowledgeService.operations(auth)));
        return new Snapshot(label, systemId, List.copyOf(evidence), Instant.now(), freshnessNotice);
    }
    private Map<String, Object> guide(String page, boolean operations) {
        String workflow = switch (page) {
            case "dashboard" -> "Review health counts, active alerts and averages. Averages use fresh, available readings; no data is different from a measured zero. Open a system to inspect its measurements.";
            case "system" -> "Select a system card for details, freshness, configured thresholds and metric history. Operations can add/edit systems and submit readings. Management has read-only access.";
            case "alerts" -> "Filter alerts by status or system. ACTIVE means unacknowledged; ACKNOWLEDGED means someone took ownership, not recovery. Operations can acknowledge/resolve; Management can inspect. Resolving an alert does not prove system recovery.";
            case "profile" -> "Save an email address, request a verification email, then enter the code yourself. Saving a changed address resets verification. Never share passwords or verification codes with the assistant.";
            case "retention" -> "Operations can preview and explicitly run a bounded archive batch. Preview does not delete data. Disabled maintenance cannot run. Management cannot access the maintenance preview or execute it.";
            default -> "Operations can add versioned text/Markdown runbooks, optionally scoped to a system and Operations-only. Q&A retrieves visible sources. System investigations read metrics, alerts and runbooks; proposed alert changes require separate confirmation.";
        };
        return Map.of("workflow", workflow, "role", operations ? "OPERATIONS" : "MANAGEMENT",
                "permissions", operations ? "Read monitoring data, manage systems, submit readings, manage runbooks, acknowledge/resolve alerts and explicitly run configured maintenance."
                        : "Read monitoring data and shared runbooks, and manage your own email profile. No system, metric, alert, runbook or maintenance writes.",
                "assistantActions", "Chat is read-only. Only an explicitly reviewed Operations proposal can change an alert. The assistant cannot change profile details or run archive maintenance.");
    }
    private void add(List<AssistantObservation> evidence, String title, Object data) {
        evidence.add(new AssistantObservation("T" + (evidence.size() + 1), title, data));
    }
    private ApiProblemException invalid(String message) { return new ApiProblemException(HttpStatus.BAD_REQUEST, message); }
}
