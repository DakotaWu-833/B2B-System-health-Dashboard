package au.edu.sydney.elec5619.dashboard.alert;

import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(
        name = "alerts",
        indexes = {
            @Index(name = "idx_alerts_system_status", columnList = "system_id, status"),
            @Index(name = "idx_alerts_created_time", columnList = "created_time"),
            @Index(name = "idx_alerts_archived_time", columnList = "archived, created_time, alert_id"),
            @Index(name = "idx_alerts_status_time", columnList = "status, created_time, alert_id"),
            @Index(name = "idx_alerts_system_type_status_time", columnList = "system_id, alert_type, status, created_time, alert_id")
        })
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "alert_id")
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "system_id", nullable = false)
    private MonitoredSystem monitoredSystem;

    @NotBlank
    @Size(max = 50)
    @Column(name = "alert_type", nullable = false, length = 50)
    private String alertType;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertSeverity severity;

    @NotBlank
    @Size(max = 1000)
    @Column(nullable = false, length = 1000)
    private String message;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertStatus status;

    @Column(nullable = false)
    private boolean archived;

    @NotNull
    @Column(name = "created_time", nullable = false)
    private Instant createdTime;

    protected Alert() {
    }

    public Alert(
            MonitoredSystem monitoredSystem,
            String alertType,
            AlertSeverity severity,
            String message,
            AlertStatus status,
            Instant createdTime) {
        this.monitoredSystem = monitoredSystem;
        this.alertType = alertType;
        this.severity = severity;
        this.message = message;
        this.status = status;
        this.createdTime = createdTime;
    }

    public Long getId() {
        return id;
    }

    public MonitoredSystem getMonitoredSystem() {
        return monitoredSystem;
    }

    public String getAlertType() {
        return alertType;
    }

    public AlertSeverity getSeverity() {
        return severity;
    }

    public String getMessage() {
        return message;
    }

    public AlertStatus getStatus() {
        return status;
    }

    public Instant getCreatedTime() {
        return createdTime;
    }

    public boolean isArchived() {
        return archived;
    }

    void setArchived(boolean archived) {
        this.archived = archived;
    }

    public void changeStatus(AlertStatus status) {
        this.status = status;
    }

    public void escalate(AlertSeverity severity, String message) {
        if (this.severity == AlertSeverity.WARNING && severity == AlertSeverity.CRITICAL) {
            this.severity = severity;
            this.message = message;
            this.status = AlertStatus.ACTIVE;
        }
    }
}
