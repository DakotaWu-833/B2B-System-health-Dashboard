package au.edu.sydney.elec5619.dashboard.knowledge;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;

public interface KnowledgeChunkRepository extends JpaRepository<KnowledgeChunk, Long> {
    @Query("""
            select c from KnowledgeChunk c join fetch c.document d
            where (:operations = true or d.operationsOnly = false)
            and (:systemId is null or d.systemId is null or d.systemId = :systemId)
            order by c.id
            """)
    List<KnowledgeChunk> corpus(boolean operations, Long systemId, Pageable page);
}
