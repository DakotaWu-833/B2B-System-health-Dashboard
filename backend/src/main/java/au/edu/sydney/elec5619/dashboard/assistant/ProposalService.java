package au.edu.sydney.elec5619.dashboard.assistant;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import au.edu.sydney.elec5619.dashboard.alert.*;
import au.edu.sydney.elec5619.dashboard.common.*;
import au.edu.sydney.elec5619.dashboard.knowledge.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProposalService {
    public record Proposal(String id, Long alertId, String action, String reason, Instant expiresAt) {}
    private final AgentProposalRepository proposals;
    private final AlertRepository alerts;
    private final AlertService alertService;
    private final KnowledgeService knowledge;
    private final ObjectMapper mapper;
    private final RetryingTransaction transaction;
    public ProposalService(AgentProposalRepository proposals, AlertRepository alerts, AlertService alertService,
                           KnowledgeService knowledge, ObjectMapper mapper, RetryingTransaction transaction) {
        this.proposals = proposals; this.alerts = alerts; this.alertService = alertService;
        this.knowledge = knowledge; this.mapper = mapper; this.transaction = transaction;
    }
    @Transactional
    public Proposal draft(Long alertId, Long systemId, String action, String reason,
                          String snapshot, List<KnowledgeService.Citation> evidence, Authentication auth) {
        requireOperations(auth);
        if (!List.of("ACKNOWLEDGE", "RESOLVE").contains(action) || reason.isBlank() || reason.length() > 1000)
            throw new ApiProblemException(HttpStatus.BAD_REQUEST, "Invalid proposed action");
        Alert alert = alerts.findById(alertId).orElseThrow(() -> new AlertNotFoundException(alertId));
        if (!alert.getMonitoredSystem().getId().equals(systemId) || !fingerprint(alert).equals(snapshot))
            throw new ApiProblemException(HttpStatus.CONFLICT, "Alert changed. Diagnose again.");
        if (alert.getStatus() == AlertStatus.RESOLVED || (action.equals("ACKNOWLEDGE") && alert.getStatus() != AlertStatus.ACTIVE))
            throw new ApiProblemException(HttpStatus.CONFLICT, "Alert cannot accept this action");
        AgentProposal p = new AgentProposal(); p.id = UUID.randomUUID().toString(); p.owner = auth.getName();
        p.alertId = alertId; p.action = action; p.reason = reason; p.snapshot = snapshot;
        p.expiresAt = Instant.now().plusSeconds(600); p.evidence = json(evidence); proposals.save(p);
        return new Proposal(p.id, p.alertId, p.action, p.reason, p.expiresAt);
    }
    public AlertResponse confirm(String id, Authentication auth) {
        requireOperations(auth);
        return transaction.execute(() -> confirmInTransaction(id, auth));
    }
    private AlertResponse confirmInTransaction(String id, Authentication auth) {
        AgentProposal p = proposals.lock(id).filter(v -> v.owner.equals(auth.getName())).orElseThrow(() ->
                new ApiProblemException(HttpStatus.NOT_FOUND, "Proposal not found"));
        if (p.confirmedAt != null) {
            try { return mapper.readValue(p.resultJson, AlertResponse.class); }
            catch (Exception invalid) { throw new IllegalStateException("Invalid stored result", invalid); }
        }
        if (!p.expiresAt.isAfter(Instant.now())) throw new ApiProblemException(HttpStatus.CONFLICT, "Proposal expired. Diagnose again.");
        try { knowledge.lockEvidence(mapper.readValue(p.evidence, new TypeReference<List<KnowledgeService.Citation>>() {})); }
        catch (com.fasterxml.jackson.core.JsonProcessingException invalid) { throw new IllegalStateException(invalid); }
        Alert alert = alerts.findByIdForUpdate(p.alertId).orElseThrow(() -> new AlertNotFoundException(p.alertId));
        if (!p.snapshot.equals(fingerprint(alert))) throw new ApiProblemException(HttpStatus.CONFLICT, "Alert changed. Diagnose again.");
        AlertResponse result = p.action.equals("ACKNOWLEDGE") ? alertService.acknowledge(p.alertId) : alertService.resolve(p.alertId);
        p.confirmedAt = Instant.now(); p.resultJson = json(result);
        return result;
    }
    static String fingerprint(Alert alert) {
        return RetrievalService.hash(alert.getId() + "|" + alert.getStatus() + "|" + alert.getSeverity() + "|"
                + alert.getMessage() + "|" + alert.getCreatedTime());
    }
    private void requireOperations(Authentication auth) {
        if (!KnowledgeService.operations(auth)) throw new ApiProblemException(HttpStatus.FORBIDDEN, "Only Operations can propose or confirm alert actions");
    }
    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception invalid) { throw new IllegalStateException(invalid); }
    }
}
