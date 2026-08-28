package au.edu.sydney.elec5619.dashboard.alert;

import java.math.BigDecimal;
import java.util.List;

import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.system.HealthThresholdProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertService {

    private static final List<AlertStatus> OPEN_STATUSES =
            List.of(AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED);

    private final AlertRepository alertRepository;
    private final HealthThresholdProperties thresholds;

    public AlertService(
            AlertRepository alertRepository,
            HealthThresholdProperties thresholds) {
        this.alertRepository = alertRepository;
        this.thresholds = thresholds;
    }

    @Transactional
    public void recordAlertsForMetric(Metric metric) {
        if (!metric.isAvailable()) {
            recordAlert(
                    metric,
                    AlertType.SERVICE_UNAVAILABLE,
                    AlertSeverity.CRITICAL,
                    "System is unavailable");
            return;
        }

        recordPercentageAlert(
                metric,
                AlertType.HIGH_CPU,
                "CPU usage",
                metric.getCpuUsage(),
                thresholds.cpuWarning(),
                thresholds.cpuCritical());
        recordPercentageAlert(
                metric,
                AlertType.HIGH_MEMORY,
                "Memory usage",
                metric.getMemoryUsage(),
                thresholds.memoryWarning(),
                thresholds.memoryCritical());

        if (metric.getResponseTime() >= thresholds.responseTimeCritical()) {
            recordAlert(
                    metric,
                    AlertType.SLOW_RESPONSE,
                    AlertSeverity.CRITICAL,
                    "Response time reached the critical threshold");
        } else if (metric.getResponseTime() >= thresholds.responseTimeWarning()) {
            recordAlert(
                    metric,
                    AlertType.SLOW_RESPONSE,
                    AlertSeverity.WARNING,
                    "Response time reached the warning threshold");
        }
    }

    @Transactional(readOnly = true)
    public List<AlertResponse> getAlerts(AlertStatus status, Long systemId) {
        List<Alert> alerts;
        if (status != null && systemId != null) {
            alerts = alertRepository.findByMonitoredSystemIdAndStatusOrderByCreatedTimeDesc(
                    systemId,
                    status);
        } else if (status != null) {
            alerts = alertRepository.findByStatusOrderByCreatedTimeDesc(status);
        } else if (systemId != null) {
            alerts = alertRepository.findByMonitoredSystemIdOrderByCreatedTimeDesc(systemId);
        } else {
            alerts = alertRepository.findAllByOrderByCreatedTimeDesc();
        }

        return alerts.stream().map(AlertResponse::from).toList();
    }

    @Transactional
    public AlertResponse acknowledge(Long alertId) {
        Alert alert = getAlert(alertId);
        if (alert.getStatus() != AlertStatus.ACTIVE) {
            throw new InvalidAlertStatusTransitionException(
                    alertId,
                    alert.getStatus(),
                    AlertStatus.ACKNOWLEDGED);
        }
        alert.changeStatus(AlertStatus.ACKNOWLEDGED);
        return AlertResponse.from(alert);
    }

    @Transactional
    public AlertResponse resolve(Long alertId) {
        Alert alert = getAlert(alertId);
        if (alert.getStatus() != AlertStatus.ACTIVE
                && alert.getStatus() != AlertStatus.ACKNOWLEDGED) {
            throw new InvalidAlertStatusTransitionException(
                    alertId,
                    alert.getStatus(),
                    AlertStatus.RESOLVED);
        }
        alert.changeStatus(AlertStatus.RESOLVED);
        return AlertResponse.from(alert);
    }

    private void recordPercentageAlert(
            Metric metric,
            AlertType alertType,
            String metricName,
            BigDecimal value,
            BigDecimal warningThreshold,
            BigDecimal criticalThreshold) {
        if (value.compareTo(criticalThreshold) >= 0) {
            recordAlert(
                    metric,
                    alertType,
                    AlertSeverity.CRITICAL,
                    metricName + " reached the critical threshold");
        } else if (value.compareTo(warningThreshold) >= 0) {
            recordAlert(
                    metric,
                    alertType,
                    AlertSeverity.WARNING,
                    metricName + " reached the warning threshold");
        }
    }

    private void recordAlert(
            Metric metric,
            AlertType alertType,
            AlertSeverity severity,
            String message) {
        alertRepository
                .findFirstByMonitoredSystemIdAndAlertTypeAndStatusInOrderByCreatedTimeDesc(
                        metric.getMonitoredSystem().getId(),
                        alertType.name(),
                        OPEN_STATUSES)
                .ifPresentOrElse(
                        alert -> alert.escalate(severity, message),
                        () -> alertRepository.save(new Alert(
                                metric.getMonitoredSystem(),
                                alertType.name(),
                                severity,
                                message,
                                AlertStatus.ACTIVE,
                                metric.getRecordedAt())));
    }

    private Alert getAlert(Long alertId) {
        return alertRepository.findById(alertId)
                .orElseThrow(() -> new AlertNotFoundException(alertId));
    }
}
