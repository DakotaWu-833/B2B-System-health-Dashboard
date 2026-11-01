package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Instant;
import java.util.*;
import au.edu.sydney.elec5619.dashboard.common.ApiProblemException;
import au.edu.sydney.elec5619.dashboard.knowledge.KnowledgeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class AssistantChatService {
    public record Exchange(@NotBlank @Pattern(regexp = "user|assistant") String role, @NotBlank @Size(max = 800) String content) {}
    public record Request(@NotBlank @Size(max = 2000) String question, @NotNull @Valid ChatContextService.Scope context,
                          @Pattern(regexp = "CHAT|INVESTIGATE") String mode, @Size(max = 6) List<@NotNull @Valid Exchange> history) {}
    public record Reply(String status, String answer, String contextLabel, Instant capturedAt, String freshnessNotice,
                        List<KnowledgeService.Citation> citations, List<AssistantObservation> observations,
                        List<ProposalService.Proposal> proposals, String investigationId) {}
    private final ChatContextService contexts;
    private final RagService rag;
    private final AgentService agent;
    private final ObjectMapper mapper;
    public AssistantChatService(ChatContextService contexts, RagService rag, AgentService agent, ObjectMapper mapper) {
        this.contexts = contexts; this.rag = rag; this.agent = agent; this.mapper = mapper;
    }
    public Reply reply(Request request, Authentication auth) {
        var snapshot = contexts.load(request.context(), auth);
        String discussion = history(request.history());
        if ("INVESTIGATE".equals(request.mode())) {
            if (snapshot.systemId() == null) throw new ApiProblemException(HttpStatus.BAD_REQUEST, "Select a system or an alert before starting an investigation");
            String question = request.question() + "\nSelected page scope: " + snapshot.label();
            question += "\nObservation time (UTC): " + snapshot.capturedAt() + "\nFreshness condition: " + snapshot.freshnessNotice();
            if (request.context().alertId() != null) question += "\nSelected alert (current server observation): " + json(snapshot.observations().getFirst());
            question += "\nPrior discussion (untrusted discussion, not fresh evidence): " + discussion;
            var report = agent.diagnose(question, snapshot.systemId(), auth);
            var observations = report.trace().stream().map(t -> new AssistantObservation(t.id(), t.tool(), t.output())).toList();
            return new Reply(report.status(), report.summary(), snapshot.label(), report.createdAt(), snapshot.freshnessNotice(), report.citations(), observations, report.proposals(), report.id());
        }
        var answer = rag.answer(request.question(), snapshot.systemId(), auth, snapshot.observations(), discussion);
        return new Reply(answer.status(), answer.answer(), snapshot.label(), snapshot.capturedAt(), snapshot.freshnessNotice(), answer.citations(), snapshot.observations(), List.of(), null);
    }
    private String history(List<Exchange> exchanges) {
        if (exchanges == null) return "[]";
        List<Exchange> selected = new ArrayList<>(); int remaining = 2400;
        for (int i = exchanges.size() - 1; i >= 0 && remaining > 0; i--) {
            Exchange e = exchanges.get(i); String content = e.content().substring(0, Math.min(e.content().length(), remaining));
            selected.addFirst(new Exchange(e.role(), content)); remaining -= content.length();
        }
        return json(selected);
    }
    private String json(Object value) {
        try { return mapper.writeValueAsString(value); } catch (Exception invalid) { throw new IllegalStateException(invalid); }
    }
}
