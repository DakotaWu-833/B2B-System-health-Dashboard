package au.edu.sydney.elec5619.dashboard.metric;

import java.math.BigDecimal;
import java.time.Instant;

import au.edu.sydney.elec5619.dashboard.system.MonitoredSystem;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Entity
@Table(
        name = "metrics",
        indexes = @Index(
                name = "idx_metrics_system_recorded_at",
                columnList = "system_id, recorded_at"))
public class Metric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "metric_id")
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "system_id", nullable = false)
    private MonitoredSystem monitoredSystem;

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("100.0")
    @Column(name = "cpu_usage", nullable = false, precision = 5, scale = 2)
    private BigDecimal cpuUsage;

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("100.0")
    @Column(name = "memory_usage", nullable = false, precision = 5, scale = 2)
    private BigDecimal memoryUsage;

    @NotNull
    @PositiveOrZero
    @Column(name = "response_time", nullable = false)
    private Long responseTime;

    @Column(nullable = false)
    private boolean availability;

    @NotNull
    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected Metric() {
    }

    public Metric(
            MonitoredSystem monitoredSystem,
            BigDecimal cpuUsage,
            BigDecimal memoryUsage,
            Long responseTime,
            boolean availability,
            Instant recordedAt) {
        this.monitoredSystem = monitoredSystem;
        this.cpuUsage = cpuUsage;
        this.memoryUsage = memoryUsage;
        this.responseTime = responseTime;
        this.availability = availability;
        this.recordedAt = recordedAt;
    }

    public Long getId() {
        return id;
    }

    public MonitoredSystem getMonitoredSystem() {
        return monitoredSystem;
    }

    public BigDecimal getCpuUsage() {
        return cpuUsage;
    }

    public BigDecimal getMemoryUsage() {
        return memoryUsage;
    }

    public Long getResponseTime() {
        return responseTime;
    }

    public boolean isAvailable() {
        return availability;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }
}
