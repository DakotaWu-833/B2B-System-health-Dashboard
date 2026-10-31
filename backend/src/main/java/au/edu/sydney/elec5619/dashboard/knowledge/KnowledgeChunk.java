package au.edu.sydney.elec5619.dashboard.knowledge;

import jakarta.persistence.*;

@Entity
@Table(name = "knowledge_chunks", indexes = @Index(name = "idx_knowledge_chunk_document", columnList = "document_id"))
public class KnowledgeChunk {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false) KnowledgeDocument document;
    @Column(nullable = false) int position;
    @Column(nullable = false, length = 1000) String text;
    protected KnowledgeChunk() {}
    KnowledgeChunk(KnowledgeDocument document, int position, String text) {
        this.document = document; this.position = position; this.text = text;
    }
}
