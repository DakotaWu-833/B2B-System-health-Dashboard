package au.edu.sydney.elec5619.dashboard.system;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(
        name = "monitored_systems",
        indexes = @Index(name = "idx_monitored_systems_status", columnList = "status"))
public class MonitoredSystem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "system_id")
    private Long id;

    @NotBlank
    @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String name;

    @NotBlank
    @Size(max = 50)
    @Column(nullable = false, length = 50)
    private String type;

    @NotBlank
    @Size(max = 255)
    @Column(nullable = false, length = 255)
    private String host;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HealthStatus status;

    @Size(max = 1000)
    @Column(length = 1000)
    private String description;

    protected MonitoredSystem() {
    }

    public MonitoredSystem(
            String name,
            String type,
            String host,
            HealthStatus status,
            String description) {
        this.name = name;
        this.type = type;
        this.host = host;
        this.status = status;
        this.description = description;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getType() {
        return type;
    }

    public String getHost() {
        return host;
    }

    public HealthStatus getStatus() {
        return status;
    }

    public String getDescription() {
        return description;
    }

    public void updateDetails(String name, String type, String host, String description) {
        this.name = name;
        this.type = type;
        this.host = host;
        this.description = description;
    }

    public void changeStatus(HealthStatus status) {
        this.status = status;
    }
}
