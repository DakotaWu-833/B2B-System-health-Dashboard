package au.edu.sydney.elec5619.dashboard.knowledge;

import java.time.Instant;
import java.util.List;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import au.edu.sydney.elec5619.dashboard.system.MonitoredSystemRepository;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KnowledgeService {
    public record Input(@NotBlank @Size(max = 200) String title,
                        @NotBlank @Size(max = 32000) String content,
                        @Positive Long systemId, boolean operationsOnly, @PositiveOrZero Long version) {}
    public record Document(Long id, long version, String title, String content, Long systemId,
                           boolean operationsOnly, Instant updatedAt, int chunkCount) {}
    public record Citation(String id, Long documentId, long version, int chunk, String title,
                           String excerpt, String url, double score) {}
    private final KnowledgeDocumentRepository documents;
    private final MonitoredSystemRepository systems;
    public KnowledgeService(KnowledgeDocumentRepository documents, MonitoredSystemRepository systems) {
        this.documents = documents; this.systems = systems;
    }
    public static boolean operations(Authentication auth) {
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_OPERATIONS"));
    }
    @Transactional(readOnly = true)
    public List<Document> list(Authentication auth) {
        return documents.visible(operations(auth), PageRequest.of(0, 200)).stream().map(d -> response(d, false)).toList();
    }
    @Transactional(readOnly = true)
    public Document get(Long id, Authentication auth) {
        KnowledgeDocument d = documents.findById(id).orElseThrow(KnowledgeService::notFound);
        if (d.operationsOnly && !operations(auth)) throw notFound();
        return response(d, true);
    }
    @Transactional
    public Document save(Long id, Input input) {
        if (input.systemId() != null && !systems.existsById(input.systemId()))
            throw new ApiProblemException(HttpStatus.BAD_REQUEST, "Unknown system");
        KnowledgeDocument d = id == null ? new KnowledgeDocument() : documents.lock(id).orElseThrow(KnowledgeService::notFound);
        if (id != null && (input.version() == null || d.version != input.version()))
            throw new ApiProblemException(HttpStatus.CONFLICT, "Document changed. Reload before editing.");
        d.replace(input.title(), input.content(), input.systemId(), input.operationsOnly());
        return response(documents.saveAndFlush(d), true);
    }
    @Transactional
    public void delete(Long id, long version) {
        KnowledgeDocument d = documents.lock(id).orElseThrow(KnowledgeService::notFound);
        if (d.version != version) throw new ApiProblemException(HttpStatus.CONFLICT, "Document changed. Reload before deleting.");
        documents.delete(d);
    }
    @Transactional(readOnly = true)
    public boolean current(List<Citation> citations, Authentication auth) {
        return citations.stream().allMatch(c -> documents.findById(c.documentId()).map(d ->
                d.version == c.version() && (!d.operationsOnly || operations(auth))).orElse(false));
    }
    public void lockEvidence(List<Citation> citations) {
        citations.stream().map(Citation::documentId).distinct().sorted().forEach(id -> {
            KnowledgeDocument d = documents.lock(id).orElseThrow(() ->
                    new ApiProblemException(HttpStatus.CONFLICT, "A cited document was deleted. Diagnose again."));
            if (citations.stream().anyMatch(c -> c.documentId().equals(id) && c.version() != d.version))
                throw new ApiProblemException(HttpStatus.CONFLICT, "A cited document changed. Diagnose again.");
        });
    }
    private static ApiProblemException notFound() { return new ApiProblemException(HttpStatus.NOT_FOUND, "Document not found"); }
    private Document response(KnowledgeDocument d, boolean full) {
        return new Document(d.id, d.version, d.title, full ? d.content : null, d.systemId, d.operationsOnly, d.updatedAt, d.chunks.size());
    }
}
