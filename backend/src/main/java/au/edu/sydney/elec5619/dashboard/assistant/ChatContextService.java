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
                        @Pattern(regexp = "ALL|ACTIVE|ACKNOWLEDGED|RESOLVED") String status, Boolean archived) {}
    public record Snapshot(String label, Long systemId, List<AssistantObservation> observations, Instant capturedAt, String freshnessNotice) {}
    public record SystemEvidence(Long systemId, String name, String host, HealthStatus lastReportedHealthStatus,
                                 MetricDataStatus measurementFreshness, String currentAvailability,
                                 Instant lastMeasuredAt, MetricReadingResponse lastReportedReading,
                                 List<String> statusReasons, HealthThresholdProperties evaluatedThresholds) {}
    public record AlertEvidence(Long alertId, Long systemId, String systemName, String reportedCondition,
                                AlertSeverity severity, AlertStatus currentWorkflowStatus, String historicalMessage, Instant reportedAt, boolean archived) {}
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
        boolean archived = Boolean.TRUE.equals(scope.archived());
        if (scope.archived() != null && !page.equals("alerts")) throw invalid("Archived scope is only available in the Alert Center");
        if (scope.alertId() != null && !page.equals("alerts")) throw invalid("Select an alert from the Alert Center");
        if (systemId != null && !Set.of("system", "alerts").contains(page)) throw invalid("This page does not have a selected system");
        List<AssistantObservation> evidence = new ArrayList<>();
        String freshnessNotice = null;
        String label = switch (page) {
            case "dashboard" -> "Dashboard";
            case "system" -> "Systems";
            case "alerts" -> archived ? "Archived alerts" : "Alert Center";
            case "profile" -> "My profile";
            case "retention" -> "Metric retention";
            default -> "Knowledge workspace";
        };
        if (scope.alertId() != null) {
            Alert alert = alertRepository.findById(scope.alertId()).orElseThrow(() -> new AlertNotFoundException(scope.alertId()));
            Long actual = alert.getMonitoredSystem().getId();
            if (systemId != null && !actual.equals(systemId)) throw invalid("Selected alert and system do not match");
            if (scope.archived() != null && alert.isArchived() != archived) throw invalid("Selected alert does not belong to this alert view");
            archived = alert.isArchived();
            label = archived ? "Archived alerts" : "Alert Center";
            systemId = actual; add(evidence, "Selected alert: current workflow and historical monitoring event", new AlertEvidence(alert.getId(), actual,
                    alert.getMonitoredSystem().getName(), alert.getAlertType(), alert.getSeverity(), alert.getStatus(), alert.getMessage(), alert.getCreatedTime(), archived));
            label += " · " + alert.getMonitoredSystem().getName() + " · Alert #" + alert.getId();
        }
        switch (page) {
            case "dashboard" -> {
                var summary = dashboard.getSummary();
                add(evidence, "Current dashboard summary: health excludes systems without readings", summary);
                freshnessNotice = coverageNotice(summary.freshReadingCount(), summary.staleReadingCount(), summary.noData());
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
                    var sample = systems.getSystemsPage(0, 10);
                    add(evidence, "System inventory (first 10, not the full inventory)", sample);
                    freshnessNotice = "This is a sample of up to ten systems. Missing or outdated readings do not establish current availability; stored health is the last reported state.";
                } else {
                    freshnessNotice = "Alerts describe historical monitoring events. Acknowledgment, resolution and archiving do not establish current system availability. Select a system to check its measurement freshness.";
                }
                AlertStatus filter = scope.status() == null || scope.status().equals("ALL") ? null : AlertStatus.valueOf(scope.status());
                add(evidence, archived ? "Archived alerts in the selected scope (up to 10)" : "Unarchived alerts in the selected scope (up to 10)", alerts.getAlerts(filter, systemId, 0, 10, archived));
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
        add(evidence, "How to use this page", guide(page, KnowledgeService.operations(auth), archived));
        return new Snapshot(label, systemId, List.copyOf(evidence), Instant.now(), freshnessNotice);
    }
    private String coverageNotice(long fresh, long stale, long noData) {
        if (fresh == 0) return "There are no fresh metric readings. " + stale + " systems have outdated readings and " + noData
                + " have no readings. Current availability cannot be confirmed from last-reported health or alert workflow.";
        if (stale > 0 || noData > 0) return "Measurement coverage is partial: " + fresh + " fresh, " + stale + " outdated and " + noData
                + " without readings. Current availability remains unknown for systems with missing or outdated readings.";
        return null;
    }
    private Map<String, Object> guide(String page, boolean operations, boolean archived) {
        String workflow = switch (page) {
            case "dashboard" -> "Review last-reported health counts, No data, active alerts and averages. Healthy excludes systems without measurements. Averages use fresh, available readings. freshReadingCount and staleReadingCount describe measurement coverage; evaluatedAt is the summary calculation time, never a measurement timestamp. Open a system to inspect its measurements.";
            case "system" -> "Select a system card for details, freshness, configured thresholds and metric history. Operations can add/edit systems and submit readings. Management has read-only access.";
            case "alerts" -> (archived ? "The current view contains archived Resolved alerts only. " : "The current board contains unarchived Active, Acknowledged and Resolved alerts. ")
                    + "Click an alert for its system's Recent Metrics. Operations can archive a Resolved alert and Undo archive returns it to Resolved. Management can inspect. Acknowledgment means ownership; resolution and archiving are workflow states, not evidence of system recovery. Observations are bounded samples; local search text and sort order are not applied to this sample.";
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
