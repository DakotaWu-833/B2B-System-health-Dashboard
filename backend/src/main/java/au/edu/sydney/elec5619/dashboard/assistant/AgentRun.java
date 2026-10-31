package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "agent_runs", indexes = @Index(name = "idx_agent_run_owner_time", columnList = "owner,created_at"))
public class AgentRun {
    @Id @Column(length = 36) String id;
    @Column(nullable = false, length = 100) String owner;
    @Column(name = "system_id", nullable = false) Long systemId;
    @Column(name = "created_at", nullable = false) Instant createdAt;
    @Column(nullable = false, length = 40) String status;
    @Column(name = "report_json", nullable = false, columnDefinition = "MEDIUMTEXT") String reportJson;
    protected AgentRun() {}
}
