package au.edu.sydney.elec5619.dashboard.assistant;

import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;

public interface AgentProposalRepository extends JpaRepository<AgentProposal, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from AgentProposal p where p.id = :id")
    Optional<AgentProposal> lock(String id);
}
