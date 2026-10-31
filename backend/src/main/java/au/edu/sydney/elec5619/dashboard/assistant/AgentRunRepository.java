package au.edu.sydney.elec5619.dashboard.assistant;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRunRepository extends JpaRepository<AgentRun, String> {
    List<AgentRun> findTop20ByOwnerOrderByCreatedAtDesc(String owner);
}
