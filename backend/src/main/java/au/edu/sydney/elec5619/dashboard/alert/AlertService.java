package au.edu.sydney.elec5619.dashboard.alert;

import java.math.BigDecimal;
import java.util.List;

import au.edu.sydney.elec5619.dashboard.common.InvalidPageRequestException;
import au.edu.sydney.elec5619.dashboard.common.PagedResponse;
import au.edu.sydney.elec5619.dashboard.metric.Metric;
import au.edu.sydney.elec5619.dashboard.system.HealthThresholdProperties;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertService {

    private static final List<AlertStatus> OPEN_STATUSES =
            List.of(AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED);
    private static final int MAX_PAGE_SIZE = 100;

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
    public PagedResponse<AlertResponse> getAlerts(
            AlertStatus status,
            Long systemId,
            int page,
            int size) {
        Pageable pageable = alertPage(page, size);
        Page<Alert> alerts;
        if (status != null && systemId != null) {
            alerts = alertRepository.findByMonitoredSystemIdAndStatus(
                    systemId,
                    status,
                    pageable);
        } else if (status != null) {
            alerts = alertRepository.findByStatus(status, pageable);
        } else if (systemId != null) {
            alerts = alertRepository.findByMonitoredSystemId(systemId, pageable);
        } else {
            alerts = alertRepository.findAll(pageable);
        }

        return PagedResponse.from(alerts.map(AlertResponse::from));
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
        return alertRepository.findByIdForUpdate(alertId)
                .orElseThrow(() -> new AlertNotFoundException(alertId));
    }

    private Pageable alertPage(int page, int size) {
        if (page < 0) {
            throw new InvalidPageRequestException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidPageRequestException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdTime")
                        .and(Sort.by(Sort.Direction.DESC, "id")));
    }
}
