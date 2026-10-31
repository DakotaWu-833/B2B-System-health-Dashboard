package au.edu.sydney.elec5619.dashboard.knowledge;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import jakarta.persistence.*;

@Entity
@Table(name = "knowledge_documents")
public class KnowledgeDocument {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;
    @Version long version;
    @Column(nullable = false, length = 200) String title;
    @Column(nullable = false, columnDefinition = "MEDIUMTEXT") String content;
    @Column(name = "system_id") Long systemId;
    @Column(name = "operations_only", nullable = false) boolean operationsOnly;
    @Column(name = "updated_at", nullable = false) Instant updatedAt;
    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC") List<KnowledgeChunk> chunks = new ArrayList<>();
    protected KnowledgeDocument() {}
    void replace(String title, String content, Long systemId, boolean operationsOnly) {
        this.title = title.trim(); this.content = content.trim(); this.systemId = systemId;
        this.operationsOnly = operationsOnly; updatedAt = Instant.now();
        chunks.clear();
        // Overlap preserves context at boundaries; persisted positions give stable citations per version.
        for (int start = 0, position = 0; start < this.content.length(); position++) {
            int end = Math.min(this.content.length(), start + 900);
            chunks.add(new KnowledgeChunk(this, position, this.content.substring(start, end)));
            if (end == this.content.length()) break;
            start = end - 120;
        }
    }
}
