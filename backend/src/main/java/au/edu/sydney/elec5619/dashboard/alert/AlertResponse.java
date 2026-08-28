package au.edu.sydney.elec5619.dashboard.alert;

import java.time.Instant;

public record AlertResponse(
        Long alertId,
        Long systemId,
        String systemName,
        String alertType,
        AlertSeverity severity,
        String message,
        AlertStatus status,
        Instant createdTime) {

    public static AlertResponse from(Alert alert) {
        return new AlertResponse(
                alert.getId(),
                alert.getMonitoredSystem().getId(),
                alert.getMonitoredSystem().getName(),
                alert.getAlertType(),
                alert.getSeverity(),
                alert.getMessage(),
                alert.getStatus(),
                alert.getCreatedTime());
    }
}
