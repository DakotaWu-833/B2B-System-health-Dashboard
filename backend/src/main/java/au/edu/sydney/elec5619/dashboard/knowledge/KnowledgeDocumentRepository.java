package au.edu.sydney.elec5619.dashboard.knowledge;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;

public interface KnowledgeDocumentRepository extends JpaRepository<KnowledgeDocument, Long> {
    @Query("select d from KnowledgeDocument d where (:operations = true or d.operationsOnly = false) order by d.id desc")
    List<KnowledgeDocument> visible(boolean operations, Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from KnowledgeDocument d where d.id = :id")
    Optional<KnowledgeDocument> lock(Long id);
}
