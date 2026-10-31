package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "agent_proposals")
public class AgentProposal {
    @Id @Column(length = 36) String id;
    @Column(nullable = false, length = 100) String owner;
    @Column(name = "alert_id", nullable = false) Long alertId;
    @Column(nullable = false, length = 20) String action;
    @Column(nullable = false, length = 1000) String reason;
    @Column(nullable = false, length = 64) String snapshot;
    @Column(nullable = false, columnDefinition = "TEXT") String evidence;
    @Column(name = "expires_at", nullable = false) Instant expiresAt;
    @Column(name = "confirmed_at") Instant confirmedAt;
    @Column(name = "result_json", columnDefinition = "TEXT") String resultJson;
    protected AgentProposal() {}
}
