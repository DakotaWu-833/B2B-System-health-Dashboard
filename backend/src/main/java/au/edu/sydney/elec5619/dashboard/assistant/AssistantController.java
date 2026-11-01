package au.edu.sydney.elec5619.dashboard.assistant;

import java.util.*;
import au.edu.sydney.elec5619.dashboard.alert.AlertResponse;
import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import au.edu.sydney.elec5619.dashboard.infrastructure.RedisStore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {
    public record Question(@NotBlank @Size(max = 2000) String question, @Positive Long systemId) {}
    public record Diagnosis(@NotBlank @Size(max = 2000) String question, @NotNull @Positive Long systemId) {}
    private final RagService rag;
    private final AgentService agent;
    private final ProposalService proposals;
    private final AiProperties ai;
    private final AiRuntimeProperties runtime;
    private final RedisStore redis;
    public AssistantController(RagService rag, AgentService agent, ProposalService proposals, AiProperties ai, AiRuntimeProperties runtime, RedisStore redis) {
        this.rag = rag; this.agent = agent; this.proposals = proposals; this.ai = ai; this.runtime = runtime; this.redis = redis;
    }
    @GetMapping("/status") public ApiResponse<Map<String, Object>> status() {
        return ApiResponse.success(Map.of("modelEnabled", ai.enabled(), "model", ai.model(), "embeddingModel", ai.embeddingModel(),
                "redisEnabled", redis.enabled(), "maxToolCalls", ai.maxToolCalls(),
                "runtime", Map.of("contextTokens", runtime.contextTokens(), "batchSize", runtime.batchSize(),
                        "embeddingContextTokens", runtime.embeddingContextTokens(), "keepAliveSeconds", runtime.keepAlive().toSeconds(),
                        "embeddingKeepAliveSeconds", runtime.embeddingKeepAlive().toSeconds())), "Assistant configuration");
    }
    @PostMapping("/ask") public ApiResponse<RagService.Answer> ask(@Valid @RequestBody Question input, Authentication auth) {
        return ApiResponse.success(rag.ask(input.question(), input.systemId(), auth), "Knowledge search completed");
    }
    @PostMapping("/diagnose") public ApiResponse<AgentService.Report> diagnose(@Valid @RequestBody Diagnosis input, Authentication auth) {
        return ApiResponse.success(agent.diagnose(input.question(), input.systemId(), auth), "Investigation completed");
    }
    @PostMapping("/proposals/{id}/confirm") public ApiResponse<AlertResponse> confirm(@PathVariable String id, Authentication auth) {
        return ApiResponse.success(proposals.confirm(id, auth), "Alert action confirmed");
    }
    @GetMapping("/runs") public ApiResponse<List<Map<String, Object>>> runs(Authentication auth) {
        return ApiResponse.success(agent.history(auth), "Recent investigations retrieved");
    }
}
