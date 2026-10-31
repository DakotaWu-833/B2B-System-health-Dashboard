package au.edu.sydney.elec5619.dashboard.knowledge;

import java.util.List;
import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
@RequestMapping("/api/knowledge/documents")
public class KnowledgeController {
    private final KnowledgeService service;
    public KnowledgeController(KnowledgeService service) { this.service = service; }
    @GetMapping public ApiResponse<List<KnowledgeService.Document>> list(Authentication auth) {
        return ApiResponse.success(service.list(auth), "Runbooks retrieved");
    }
    @GetMapping("/{id}") public ApiResponse<KnowledgeService.Document> get(@PathVariable Long id, Authentication auth) {
        return ApiResponse.success(service.get(id, auth), "Runbook retrieved");
    }
    @PostMapping public ApiResponse<KnowledgeService.Document> create(@Valid @RequestBody KnowledgeService.Input input) {
        return ApiResponse.success(service.save(null, input), "Runbook indexed");
    }
    @PutMapping("/{id}") public ApiResponse<KnowledgeService.Document> update(@PathVariable Long id, @Valid @RequestBody KnowledgeService.Input input) {
        return ApiResponse.success(service.save(id, input), "Runbook reindexed");
    }
    @DeleteMapping("/{id}") public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam @Min(0) long version) {
        service.delete(id, version);
        return ApiResponse.success(null, "Runbook deleted");
    }
}
